---
sidebar_position: 2
title: Log Transports
description: Where log records go — console, file, remote.
---

# Log Transports

A transport implements `ITransport` and receives a log object for
each line. Register transports via `LoggerModule.forRoot({ transports })`.

> ⚠️ **NEEDS REWRITE.** The built-in transport surface is currently
> minimal. The primary log destination is Pino's own output — the
> root logger writes JSON to an async `stdout` destination (and
> optional extra `destinations` streams). `ITransport` is a thin
> secondary hook; there is no built-in `FileTransport`, no
> per-transport `pretty`/`stderr`/`filter`/`bufferSize` options, and
> no `LogRecord` type. The sections below have been corrected to the
> actual surface; the framing of "transports as the main destination"
> still overstates their role.

## The `ITransport` interface

```typescript
interface ITransport {
  name: string;
  write(log: any): void | Promise<void>;
  flush?(): Promise<void>;
}
```

Only `name` and `write` are required; `flush` is optional. There is
no `dispose()` method on the interface, and `write` receives a plain
log object (not a typed `LogRecord`).

## Built-in transport

### `ConsoleTransport`

A minimal, test-oriented transport. Its constructor takes an
optional `ILogger`; `write(log)` forwards to `logger.info({ log }, …)`.
It does **not** accept a `pretty`, `stderr`, or `filter` option:

```typescript
import { ConsoleTransport } from '@omnitron-dev/titan/module/logger';

new ConsoleTransport();          // no-op unless given a logger
new ConsoleTransport(myLogger);  // forwards each record to myLogger.info(...)
```

For human-readable dev output and stdout routing, use the module's
`prettyPrint` option and Pino's stdout destination instead — see
[Logging Overview](./overview.md). To fan out JSON to additional
streams (e.g. a file), pass `destinations` to `LoggerModule.forRoot`:

```typescript
import { createWriteStream } from 'node:fs';

LoggerModule.forRoot({
  destinations: [
    { stream: createWriteStream('/var/log/myapp/app.log'), level: 'info' },
  ],
})
```

### Custom transports

```typescript
import { type ITransport } from '@omnitron-dev/titan/module/logger';

class HttpTransport implements ITransport {
  name = 'http';
  constructor(private readonly url: string) {}

  async write(log: any) {
    await fetch(this.url, { method: 'POST', body: JSON.stringify(log) });
  }

  async flush() { /* …drain pending writes… */ }
}

LoggerModule.forRoot({ transports: [new HttpTransport('https://logs.example/ingest')] });
```

Methods:

- `write(log)` — called per record. May be sync or async.
- `flush()` (optional) — `LoggerService.flush()` awaits every
  registered transport's `flush()`.

## Async stdout and shutdown

The root logger writes to an async Pino destination, so log calls do
not block the event loop on the `write()` syscall. A `beforeExit` /
`SIGTERM` / `SIGINT` hook calls `flushSync()` to recover buffered
lines on clean exit; `SIGKILL` still loses unflushed data. User
streams passed via `destinations` are wrapped so a slow consumer
can't stall Pino's hot path.

## Anti-patterns

- **Synchronous file writes.** Block the event loop. Prefer Pino's
  async stdout destination plus an OS-level log shipper.
- **Writing structured records as text.** A transport that does
  `String(log)` defeats structured logging. Pass the object.
- **Relying on a built-in `FileTransport` / rotation.** There isn't
  one. Use `destinations` with a rotating stream, or ship stdout.

→ Next: [Processors](./processors.md).
