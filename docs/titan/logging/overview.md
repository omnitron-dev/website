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
  // Six levels (Pino-compatible). Each is overloaded: object-first
  // (Pino v9 style) or message-first.
  trace(obj: object, msg?: string, ...args: any[]): void;
  trace(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  fatal(obj: object, msg?: string, ...args: any[]): void;
  fatal(msg: string, ...args: any[]): void;

  // Child logger with bound context
  child(bindings: object): ILogger;

  // Timing + level control
  time(label?: string): () => void;       // returns a stop() that logs elapsed ms
  isLevelEnabled(level: LogLevel): boolean;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}
```

> **Six levels.** `ILogger` exposes the full Pino set —
> `trace`, `debug`, `info`, `warn`, `error`, `fatal`. `LogLevel` is
> `'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'`.

> **Object-first signatures.** Following Pino v9, pass the structured
> data **first**, then the message: `logger.info({ userId }, 'login')`.
> A bare-string call also works: `logger.info('login')`.

## The minimal usage

```typescript
import { LoggerService } from '@omnitron-dev/titan/module/logger';

@Service({ name: 'users' })
class UsersService {
  constructor(private readonly logger: LoggerService) {}

  @Public()
  async findById(id: string) {
    this.logger.info({ id }, 'findById');   // object first, message second
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

## Output format (JSON, or pretty in dev)

By default the logger writes **structured JSON**, one record per line —
what log shippers (Loki, ELK, Datadog) expect. Keep this in production.

For human-friendly local output, set `prettyPrint` (or the `pretty`
alias, or the `logger.prettyPrint` ConfigService key). The logger then
uses [`pino-pretty`](https://github.com/pinojs/pino-pretty) — a declared
dependency — as its stdout destination, producing colorised,
human-readable lines. pino-pretty writes to fd 1 directly:

```typescript
LoggerModule.forRoot({
  prettyPrint: true,   // colorised human-readable output for dev
})
```

```yaml
# or via ConfigService
logger:
  prettyPrint: true
```

`LoggerService` chooses pretty output when `prettyPrint === true`, when
the `pretty` alias is true, or when the environment is `development` and
neither flag is explicitly `false`; otherwise it stays on structured
JSON (the `prettyPrint` branch of `LoggerService.initialize`,
`packages/titan/src/modules/logger/logger.service.ts`).
Leave it off (JSON) for production so log shippers can parse each line.

You can still pipe JSON output through `pino-pretty` externally if you
prefer (`node dist/main.js | npx pino-pretty`), since the logger's JSON
is `pino-pretty`-compatible.

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
