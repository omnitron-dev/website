---
sidebar_position: 3
title: Log Processors
description: Transform, filter, enrich records before they hit a transport.
---

# Log Processors

A processor receives a log record before it goes to any transport.
It can transform the record, drop it, or pass it through. Processors
chain.

## Built-in processors

### `RedactionProcessor`

Replaces sensitive field values with `***`:

```typescript
LoggerModule.forRoot({
  processors: [
    new RedactionProcessor({
      paths: [
        'password',
        'token',
        'apiKey',
        'headers.authorization',
        'creditCard.*',
      ],
    }),
  ],
})
```

Path syntax: dotted; `*` is a wildcard for one segment. The
processor walks every log record's fields and replaces matched
paths with `'***'` (configurable).

This is mandatory for any log infrastructure that ships beyond the
host. **Default redaction list should be set per-app** — Titan does
not redact by default because what counts as sensitive is
project-specific.

### `EnrichmentProcessor`

Add fields to every record:

```typescript
new EnrichmentProcessor({
  staticFields: {
    region:  'eu-west-1',
    podName: process.env.HOSTNAME,
  },
})
```

For dynamic enrichment (per-request fields), use a child logger
instead — see [Child Loggers](./child-loggers.md).

### Custom processors

```typescript
import { type ILogProcessor, type LogRecord } from '@omnitron-dev/titan/module/logger';

class TraceLevelProcessor implements ILogProcessor {
  process(record: LogRecord): LogRecord | null {
    if (record.level === LogLevel.Trace && record.service !== 'debug-target') {
      return null;        // drop
    }
    return record;
  }
}
```

Return `null` to drop. Return the record (modified or not) to pass
through.

## Order

Processors run in declaration order. The first dropped record skips
all subsequent processors and all transports.

Conventional order:

```typescript
processors: [
  new RedactionProcessor(...),     // redact first — even dropped logs are not stored
  new EnrichmentProcessor(...),    // add static metadata
  new RateLimitProcessor(...),     // drop if too noisy
  new SamplingProcessor(...),      // drop a fraction (volume control)
]
```

## When to processor vs at the call site

A processor is the right tool for **uniform** transformations:

- Redaction (every log record).
- Enrichment with environment metadata.
- Sampling for volume control.
- Filtering by level / service / context.

A processor is the wrong tool for **call-specific** transformations:

- Adding the user ID to a log line — use a child logger bound to
  the user.
- Adding a trace ID to a log line — automatic via tracing
  integration.

## Anti-patterns

- **Redaction as the only privacy guard.** Redaction at the logger
  is a defence-in-depth, not a primary control. Don't log secrets
  in the first place.
- **Heavy processors.** A processor runs for every log line. A 5 ms
  processor at 1000 logs/sec costs you 5 cores. Keep processors
  cheap.
- **Stateful processors that aren't thread-safe.** The logger may
  call `process()` from any async context. Use atomic counters /
  per-call state, not shared mutable maps.

→ Next: [Child Loggers](./child-loggers.md).
