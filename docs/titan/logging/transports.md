---
sidebar_position: 2
title: Log Transports
description: Where log records go — async stdout, extra destination streams, and the ITransport hook.
---

# Log Transports

Titan's logger is Pino. The **primary** destination for every log line
is therefore a Pino stream, not a Titan-specific transport object. The
`ITransport` interface exists as a thin, secondary, lifecycle-only hook
(its `flush()` is awaited on `LoggerService.flush()`), and `destinations`
is how you fan structured JSON out to additional streams such as a file.

This page documents both: the real write path first, then the
`ITransport` surface and its limits.

## The real write path: async Pino streams

When the module starts (`LoggerModule.forRoot(...)`), `LoggerService`
builds the root Pino logger in one of two shapes:

- **No `destinations` configured** — Pino writes to an **async stdout
  destination** (`pino.destination({ dest: 1, sync: false })`). Log
  calls do not block the event loop on the `write()` syscall. This is
  the default for almost every app.
- **`destinations` configured** — Pino writes through `multistream`
  over `process.stdout` **plus** every stream you supplied. Each
  user-supplied stream is wrapped in an async forwarder so a slow or
  fully-synchronous consumer can't stall Pino's hot path or its
  sibling streams.

Source: `packages/titan/src/modules/logger/logger.service.ts:204-249`
(stream selection) and `:23-44` (the `wrapAsyncStream` forwarder).

### Fanning out to extra streams with `destinations`

`destinations` is the supported way to send the same JSON log lines to
somewhere besides stdout — a file, a socket, a second sink. Each entry
is either a raw `WritableStream` or `{ stream, level }`:

```typescript
import { createWriteStream } from 'node:fs';

LoggerModule.forRoot({
  destinations: [
    { stream: createWriteStream('/var/log/myapp/app.log'), level: 'info' },
  ],
})
```

stdout is always included as the first stream; your entries are added
alongside it. Use `pino.destination()` or `fs.createWriteStream()` for
file targets. The option is typed on `ILoggerModuleOptions.destinations`
(`logger.types.ts:47-52`).

### Async stdout and shutdown

Because stdout is async, buffered lines can be lost if the process is
hard-killed. To recover what it can on a clean exit, `LoggerService`
installs a process-wide flush hook on `beforeExit`, `SIGTERM`, and
`SIGINT` that calls `flushSync()` on every registered async
destination (`logger.service.ts:278-307`). `SIGKILL` still loses
unflushed data — there is no user-space recovery for that.

The flush hook is installed **once per process** and tracks every
`LoggerService` instance's destination in a shared `Set`, so repeated
initialisations (tests, hot-reload) neither skip flushing nor
double-flush.

## The `ITransport` interface

```typescript
interface ITransport {
  name: string;
  write(log: any): void | Promise<void>;
  flush?(): Promise<void>;
}
```

Only `name` and `write` are required; `flush` is optional. There is no
`dispose()` method, no `filter` hook, no `bufferSize`/`flushEveryMs`
options, and `write` receives a plain log object — there is no typed
`LogRecord`. (Definition: `logger.types.ts:58-62`.)

> **`write()` is not on the hot path.** `LoggerService` collects the
> transports you register (via `forRoot({ transports })` or
> `addTransport`) but routes actual logging straight through Pino — it
> never calls a transport's `write()`. The only transport method the
> service invokes is `flush()`, which `LoggerService.flush()` awaits
> across every registered transport
> (`logger.service.ts:423-425`). Treat `ITransport` as a
> **flush-lifecycle hook**, not as a log sink. To actually receive
> every line, add a stream via `destinations` (above), which Pino
> writes to directly.

## Built-in transport

### `ConsoleTransport`

The one built-in transport. It is test-oriented: its constructor takes
an **optional** `ILogger` (positional — there is no options object, and
no `pretty`/`stderr`/`filter` option), and `write(log)` forwards to
`logger?.info({ log }, 'Console transport log')`. With no logger it is a
no-op. (Source: `logger.module.ts:197-208`.)

```typescript
import { ConsoleTransport } from '@omnitron-dev/titan/module/logger';

new ConsoleTransport();          // no-op — no logger bound
new ConsoleTransport(myLogger);  // write(log) → myLogger.info({ log }, ...)
```

Note that, like any `ITransport`, its `write()` is only ever called if
*you* call it. The module will not drive it on the log path. For routine
output you don't need a transport at all — stdout is the default sink,
and `destinations` covers extra streams.

There is **no `FileTransport`** and no built-in rotation. Use
`destinations` with a rotating write stream, or (the common production
choice) write JSON to stdout and let an OS-level shipper handle files
and rotation.

## Custom transports

You can implement `ITransport` for the `flush()` lifecycle — e.g. to
drain a batch you accumulate yourself — but be aware that the logger
will not feed records into `write()` for you. If your goal is to
*observe every log line*, register a stream through `destinations`
instead:

```typescript
import { Writable } from 'node:stream';

class HttpSinkStream extends Writable {
  constructor(private readonly url: string) { super(); }
  _write(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
    fetch(this.url, { method: 'POST', body: chunk }).then(() => cb(), cb);
  }
}

LoggerModule.forRoot({
  destinations: [{ stream: new HttpSinkStream('https://logs.example/ingest') }],
});
```

Each such stream receives Pino-formatted JSON lines and is automatically
wrapped so it can't block the logging hot path.

## Anti-patterns

- **Expecting `ITransport.write()` to receive log lines.** It won't —
  the logger never calls it. Use `destinations`.
- **Synchronous file writes.** They block the event loop. Prefer an
  async `destinations` stream plus an OS-level log shipper.
- **Writing structured records as text.** A sink that does
  `String(log)` defeats structured logging. Keep the JSON intact.
- **Relying on a built-in `FileTransport` / rotation.** There isn't
  one. Use `destinations` with a rotating stream, or ship stdout.

→ Next: [Processors](./processors.md).
