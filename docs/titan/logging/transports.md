---
sidebar_position: 2
title: Log Transports
description: Where log records go — async stdout, extra destination streams, and the async ITransport sink.
---

# Log Transports

Titan's logger is Pino. Every log line goes to stdout (async, or
through `multistream` when there are extra sinks). On top of that you
have **two** ways to fan records elsewhere:

- **`destinations`** — raw Pino streams. Each receives the serialised
  JSON line as a `Buffer`/chunk and is plugged straight into Pino's
  `multistream`.
- **`transports`** (`ITransport`) — objects whose `write(log)` receives
  each **fully-serialised record parsed back to an object**, delivered
  **off** Pino's hot path and **isolated** in try/catch. `flush()` is
  awaited by `LoggerService.flush()`.

Both are functional. This page covers the write path, then `destinations`,
then `transports`, and finally when to use which.

## The real write path: async Pino streams

When the module starts (`LoggerModule.forRoot(...)`), `LoggerService`
builds the root Pino logger in one of these shapes:

- **No `destinations`, no `transports`, JSON output** — Pino writes to
  an **async stdout destination** (`pino.destination({ dest: 1, sync:
  false })`). Log calls do not block the event loop on the `write()`
  syscall. This is the default for almost every production app.
- **Pretty output, no extra sinks** — Pino writes through a `pino-pretty`
  stream straight to stdout (see [Output format](./overview.md)).
- **`destinations` and/or `transports` configured** — Pino writes
  through `multistream` over the stdout stream **plus** every
  `destinations` stream **plus** (when any transport is registered) a
  single fan-out stream that drives the `ITransport` sinks. Each
  user-supplied `destinations` stream is wrapped in an async forwarder
  so a slow or fully-synchronous consumer can't stall Pino's hot path
  or its sibling streams.

Source: `packages/titan/src/modules/logger/logger.service.ts:243-299`
(stream selection) and `:24-45` (the `wrapAsyncStream` forwarder).

### Fanning out to extra streams with `destinations`

`destinations` is the raw-stream way to send the same JSON log lines to
somewhere besides stdout — a file, a socket, a second sink. Each entry
is either a raw `WritableStream` or `{ stream, level }`, and it receives
Pino-formatted JSON as a chunk:

```typescript
import { createWriteStream } from 'node:fs';

LoggerModule.forRoot({
  destinations: [
    { stream: createWriteStream('/var/log/myapp/app.log'), level: 'info' },
  ],
})
```

The stdout stream is always included as the first stream; your entries
are added alongside it. Use `pino.destination()` or
`fs.createWriteStream()` for file targets. The option is typed on
`ILoggerModuleOptions.destinations` (`logger.types.ts:47-52`).

### Async stdout and shutdown

When stdout is the async destination, buffered lines can be lost if the
process is hard-killed. To recover what it can on a clean exit,
`LoggerService` installs a process-wide flush hook on `beforeExit`,
`SIGTERM`, and `SIGINT` that calls `flushSync()` on every registered
async destination (`logger.service.ts:341-357`). `SIGKILL` still loses
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
`dispose()` method, no `filter` hook, and no `bufferSize`/`flushEveryMs`
options. (Definition: `logger.types.ts:58-62`.)

### How `write()` is driven

A registered transport's `write()` **is called for every log line**,
with these guarantees (`logger.service.ts:529-565`):

- **It receives the fully-serialised record, parsed back to an object.**
  The fan-out stream sits in Pino's `multistream`, so it gets exactly
  what Pino emits — JSON, which the service `JSON.parse`s before calling
  `write(record)`. (If a line somehow isn't valid JSON, the raw string
  is passed instead.)
- **Post-processor, post-level-filter.** Records arrive after the
  [processor pipeline](./processors.md) has transformed/dropped them,
  and only for logs that passed the level filter.
- **Off the hot path.** Delivery is deferred a macrotask
  (`setImmediate`), so a slow or synchronous `transport.write` can
  never block Pino's hot path (`logger.service.ts:540-559`).
- **Error-isolated.** Each transport runs in its own try/catch, and
  rejected promises are swallowed — a throwing or rejecting transport
  can never break logging or affect sibling transports
  (`logger.service.ts:547-558`).

```typescript
import type { ITransport } from '@omnitron-dev/titan/module/logger';

class HttpSinkTransport implements ITransport {
  name = 'http-sink';
  private buf: any[] = [];
  constructor(private readonly url: string) {}

  write(record: any) {
    // record is a parsed object: { level, time, msg, ...fields }
    this.buf.push(record);
    if (this.buf.length >= 100) return this.drain();
  }

  async flush() { await this.drain(); }   // awaited by LoggerService.flush()

  private async drain() {
    if (this.buf.length === 0) return;
    const batch = this.buf.splice(0);
    await fetch(this.url, { method: 'POST', body: JSON.stringify(batch) });
  }
}

LoggerModule.forRoot({
  transports: [new HttpSinkTransport('https://logs.example/ingest')],
})
```

### `flush()`

`LoggerService.flush()` awaits `flush()` across every registered
transport that defines one (`logger.service.ts:587-589`). Call it on
shutdown to drain anything a transport has buffered.

### Caveat: configure transports at `forRoot`

The fan-out stream that drives transports is created **at init**, and
only when at least one transport was registered at that point — it is
the multistream branch that wires it in (`logger.service.ts:275-279`).
Consequences:

- **Configure transports at `forRoot`** (or via the constructor) for
  guaranteed delivery. The live `this.transports` list is read on every
  write, so transports added at init all receive records.
- **`addTransport()` after init** is honoured **only if the logger was
  initialised with at least one transport** (that's what created the
  fan-out stream; the live list it reads then includes the new one). If
  the logger started with **zero** transports, there is no fan-out
  stream, so a later `addTransport()` will collect the transport (and
  its `flush()` still runs) but its `write()` won't receive records.
  When in doubt, register transports up front.

## Built-in transport

### `ConsoleTransport`

The one bundled example transport. Its constructor takes an
**optional** `ILogger` (positional — there is no options object, and no
`pretty`/`stderr`/`filter` option), and `write(log)` forwards to
`logger?.info({ log }, 'Console transport log')`. With no logger it is a
no-op. (Source: `logger.module.ts:197-208`.)

```typescript
import { ConsoleTransport } from '@omnitron-dev/titan/module/logger';

// Registered at forRoot, its write() receives every record off the hot path:
LoggerModule.forRoot({ transports: [new ConsoleTransport(myLogger)] });
```

It is a reference implementation more than a production sink — for
routine output you don't need a transport at all (stdout is the default,
and `destinations` covers extra raw streams). There is **no
`FileTransport`** and no built-in rotation: use `destinations` with a
rotating write stream, or (the common production choice) write JSON to
stdout and let an OS-level shipper handle files and rotation.

## `destinations` vs `transports`: which to use

Both fan records out; they differ in what they receive and how they run:

| | `destinations` | `transports` (`ITransport`) |
| --- | --- | --- |
| Receives | raw serialised JSON chunk (`Buffer`) | parsed record **object** |
| Wiring | a Pino `multistream` branch | a fan-out stream → `write(record)` |
| Scheduling | Pino's multistream (user streams async-wrapped) | always deferred a macrotask |
| Error handling | a throwing `_write` surfaces as a stream error | isolated per-transport try/catch |
| Lifecycle | `flushSync()` on exit (async stdout only) | `flush()` awaited by `LoggerService.flush()` |
| Dynamic add | n/a (set at `forRoot`) | `addTransport()` works **iff** ≥1 transport at init |
| Best for | high-throughput raw byte sinks (files, sockets) | structured sinks needing the parsed object + error isolation |

Rule of thumb: reach for **`destinations`** when you want the raw JSON
bytes on a stream (file rotation, a socket, an OS shipper); reach for
**`transports`** when you want the parsed record object, want delivery
isolated from the hot path and from sibling sinks, or need a `flush()`
lifecycle hook.

## Anti-patterns

- **Adding the first transport after init.** With zero transports at
  `forRoot`, no fan-out stream exists, so a later `addTransport()`
  won't deliver `write()`. Register at least one transport up front.
- **Heavy synchronous work in `write()`.** Delivery is off the hot path,
  but a transport that blocks still ties up the event loop on its
  macrotask. Batch and ship asynchronously (see `flush()`).
- **Synchronous file writes in a `destinations` stream.** They block
  the event loop. Prefer an async stream plus an OS-level log shipper.
- **Writing structured records as text.** A sink that does `String(log)`
  defeats structured logging. Keep the JSON / object intact.
- **Relying on a built-in `FileTransport` / rotation.** There isn't one.
  Use `destinations` with a rotating stream, or ship stdout.

→ Next: [Processors](./processors.md).
