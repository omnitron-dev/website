---
sidebar_position: 3
title: Log Processors
description: Transform, filter, enrich records before they hit a transport.
---

# Log Processors

A processor implements `ILogProcessor` — a single `process(log)`
method that can transform a log object, or return `null` to drop it.

```typescript
interface ILogProcessor {
  process(log: any): any | null;
}
```

> ⚠️ **NEEDS REWRITE.** Processors registered via
> `LoggerModule.forRoot({ processors })` are currently **stored but
> not applied** to log output — the root logger is Pino, and the
> processor list is not run in its write path. The reliable redaction
> mechanism today is Pino's native `redact` option (see below). The
> `ILogProcessor` interface and the `RedactionProcessor` class exist,
> but treat the "processor pipeline" framing as aspirational until the
> wiring lands. The signatures below are corrected to the real API.

## Redaction (the mechanism that works today)

Use the module's `redact` option, which is forwarded to Pino:

```typescript
LoggerModule.forRoot({
  redact: ['password', 'token', 'apiKey', 'headers.authorization', '*.creditCard'],
})
```

Pino redaction supports its own path syntax (including `*` wildcards)
and replaces matched values with `[Redacted]` by default. **Set the
redaction list per-app** — Titan does not redact by default because
what counts as sensitive is project-specific.

### `RedactionProcessor` (interface-level)

The built-in `RedactionProcessor` takes a **positional** `string[]`
of dotted paths (not an options object) and replaces matched leaf
values with the literal string `'[REDACTED]'`. Paths are literal
dotted segments — there is no `*` wildcard support in this class:

```typescript
import { RedactionProcessor } from '@omnitron-dev/titan/module/logger';

new RedactionProcessor(['password', 'token', 'headers.authorization']);
```

Note the caveat above: until the processor pipeline is wired into the
write path, prefer the `redact` module option for actual redaction.

### Custom processors

```typescript
import { type ILogProcessor } from '@omnitron-dev/titan/module/logger';

class DropTraceProcessor implements ILogProcessor {
  process(log: any): any | null {
    if (log.level === 'trace' && log.service !== 'debug-target') {
      return null;        // drop
    }
    return log;
  }
}
```

Return `null` to drop. Return the log (modified or not) to pass
through. There is no `LogRecord` type — `process` receives a plain
object.

## When to use a processor vs the call site

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
