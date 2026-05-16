---
sidebar_position: 1
title: Logging
description: Structured, contextual, transport-agnostic logging built on pino.
---

# Logging

`LoggerModule` is the second core module auto-loaded by every Titan
app (the other is `ConfigModule`). It wraps pino, adds structured
context, and routes through pluggable transports and processors.

This page is the entry point. Detail in:

- [Transports](./transports.md) — destinations (console, file,
  remote).
- [Processors](./processors.md) — transformations (redaction,
  enrichment, filtering).
- [Child Loggers](./child-loggers.md) — bound context per service.

## Why a structured logger

Three reasons:

1. **Searchability.** A log line is a JSON object with named fields.
   `level=error service=users method=findById userId=u_42` is
   queryable; a free-text string is not.
2. **Context propagation.** A child logger inherits its parent's
   context. A request-scoped logger automatically tags every log
   with the trace ID, the user ID, the call ID.
3. **Performance.** pino is asynchronous and avoids JSON
   serialisation in the hot path (it writes already-serialised
   strings).

## The minimal usage

```typescript
import { LoggerService } from '@omnitron-dev/titan/module/logger';

@Service('users@1.0.0')
class UsersService {
  constructor(private readonly logger: LoggerService) {}

  @Public()
  async findById(id: string) {
    this.logger.info('findById', { id });
    return this.repo.findById(id);
  }
}
```

Output:

```json
{"level":"info","time":"2026-05-15T20:00:00.000Z","service":"users","method":"findById","msg":"findById","id":"u_42"}
```

Two contextual fields appear automatically: `service` (from the class
name) and `time` (UTC timestamp).

## Levels

| Level    | Use for                                                          |
| -------- | ---------------------------------------------------------------- |
| `trace`  | Verbose detail for one specific debugging session                |
| `debug`  | Diagnostic info; off in production by default                    |
| `info`   | Normal operational events; on in production                     |
| `warn`   | Recoverable issues that someone should look at                  |
| `error`  | Failures that affected at least one user / call                 |
| `fatal`  | Process-level failures; usually accompanied by shutdown         |

The `info` level is the right default for production. Promote to
`debug` only when investigating.

## Setting the level

```typescript
LoggerModule.forRoot({
  level: process.env.LOG_LEVEL ?? 'info',
})
```

Per-service level overrides:

```typescript
LoggerModule.forRoot({
  level: 'info',
  levelOverrides: {
    'users':  'debug',     // verbose for users service only
    'redis':  'warn',      // quiet down a chatty integration
  },
})
```

## Hot-reloading the level

The logger subscribes to `config:changed` for `logging.level`. Bump
the level via config without restarting:

```yaml
# config/development.yaml
logging:
  level: debug
```

Edit the file → ConfigWatcher re-reads → emits `config:changed` →
LoggerService updates → next log line uses the new level.

## Integration with the lifecycle

Log lines from inside lifecycle hooks carry a `phase` field:

```json
{"level":"info","phase":"onInit","service":"DatabaseService","msg":"connected","durationMs":120}
```

Useful for finding slow boots and dependency-order surprises.

## Integration with tracing

If a trace context is active, every log line in the same async scope
carries `traceId` and `spanId`:

```json
{"level":"info","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","service":"orders","msg":"created"}
```

Correlate logs across services by `traceId` in your log aggregator.

## Read on

- [Transports](./transports.md) — pluggable destinations.
- [Processors](./processors.md) — transform / filter pipeline.
- [Child Loggers](./child-loggers.md) — bound context.

→ Next: [Transports](./transports.md).
