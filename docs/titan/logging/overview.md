---
sidebar_position: 1
title: Logging
description: Structured pino-based logging with child loggers, transports, and processors.
---

# Logging

`LoggerModule` is one of the two core modules auto-loaded with every
Titan app (the other is `ConfigModule`). Disable with
`disableCoreModules: true` if you need to provide your own.

```typescript
import {
  LoggerModule,
  LoggerService,
  ConsoleTransport,
  RedactionProcessor,
  Logger,
  Log,
  Monitor,
  LOGGER_TOKEN,
  LOGGER_SERVICE_TOKEN,
  type ILogger,
  type ILoggerOptions,
  type ILoggerModuleOptions,
  type ITransport,
  type ILogProcessor,
} from '@omnitron-dev/titan/module/logger';
```

## The `ILogger` interface

```typescript
interface ILogger {
  // Levels — only four
  debug(msg: string | object, meta?: Record<string, any>): void;
  info(msg: string | object,  meta?: Record<string, any>): void;
  warn(msg: string | object,  meta?: Record<string, any>): void;
  error(msg: string | object | Error, meta?: Record<string, any>): void;

  // Child logger with bound context
  child(meta: Record<string, any>): ILogger;

  // Underlying pino instance (escape hatch)
  pino?: any;
}
```

> **Four levels only.** Unlike some loggers that ship `trace` and
> `fatal`, `ILogger` exposes `debug`, `info`, `warn`, `error`. Map
> "trace" needs to `debug`; map "fatal" needs to `error` plus an
> explicit shutdown.

## The minimal usage

```typescript
import { LoggerService } from '@omnitron-dev/titan/module/logger';

@Service({ name: 'users' })
class UsersService {
  constructor(private readonly logger: LoggerService) {}

  @Public()
  async findById(id: string) {
    this.logger.info('findById', { id });
    return this.repo.findById(id);
  }
}
```

Output (JSON, with pino formatting):

```json
{"level":"info","time":"2026-05-15T20:00:00.000Z","service":"users","msg":"findById","id":"u_42"}
```

## Why a structured logger

Three reasons:

1. **Searchability.** A log line is a JSON object with named
   fields. `level=error service=users method=findById userId=u_42`
   is queryable; a free-text string is not.
2. **Context propagation.** A child logger inherits its parent's
   context. A request-scoped logger automatically tags every log
   with the trace ID, the user ID, the call ID.
3. **Performance.** Pino is asynchronous and avoids JSON
   serialisation in the hot path.

## Setting the level

```typescript
LoggerModule.forRoot({
  level: process.env.LOG_LEVEL ?? 'info',
})
```

Per-context level overrides through child loggers (`child` accepts
an options bag that includes `level` on pino).

## Pretty mode (dev)

The console transport accepts a `pretty` flag for development:

```typescript
LoggerModule.forRoot({
  transports: [
    new ConsoleTransport({ pretty: process.env.NODE_ENV !== 'production' }),
  ],
})
```

`pretty: false` (production default) writes JSON one-per-line —
what log shippers expect. `pretty: true` renders human-friendly
lines (colours, indentation).

## Decorators

```typescript
import { Logger, Log, Monitor } from '@omnitron-dev/titan/module/logger';

@Service({ name: 'users' })
class UsersService {
  @Logger() private readonly logger!: ILogger;          // property injection

  @Public()
  @Log()                                                 // auto-log entry/exit
  async findById(id: string) { /* … */ }

  @Public()
  @Monitor()                                             // track performance
  async heavyMethod(input: Input) { /* … */ }
}
```

## Integration with tracing

If a trace context is active, every log line in the same async
scope can carry `traceId` and `spanId`. Wire this up via a
`ILogProcessor` that reads `currentTrace()`:

```typescript
import { currentTrace } from '@omnitron-dev/titan/tracing';
import type { ILogProcessor } from '@omnitron-dev/titan/module/logger';

const TraceContextProcessor: ILogProcessor = {
  process(record) {
    const trace = currentTrace();
    if (trace) {
      record.traceId = trace.traceId;
      record.spanId  = trace.spanId;
    }
    return record;
  },
};

LoggerModule.forRoot({ processors: [TraceContextProcessor] });
```

Correlate logs across services by `traceId` in your log aggregator.

## Helpers

- `createNullLogger()` — returns an `ILogger` that discards
  everything. Useful in tests.
- `isLogger(value)` — type guard.

## Tokens

| Token                          | Purpose                              |
| ------------------------------ | ------------------------------------ |
| `LOGGER_TOKEN`                 | The default `ILogger`                |
| `LOGGER_SERVICE_TOKEN`         | The `LoggerService` wrapper          |
| `LOGGER_OPTIONS_TOKEN`         | Resolved options bundle              |
| `LOGGER_TRANSPORTS_TOKEN`      | Registered transports                |
| `LOGGER_PROCESSORS_TOKEN`      | Registered processors                |

## Read on

- [Transports](./transports.md) — pluggable destinations.
- [Processors](./processors.md) — transform / filter pipeline.
- [Child Loggers](./child-loggers.md) — bound context.

→ Next: [Transports](./transports.md).
