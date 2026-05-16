---
sidebar_position: 2
title: Log Transports
description: Where log records go — console, file, remote.
---

# Log Transports

A transport receives serialised log records and writes them
somewhere. Multiple transports can run in parallel; each gets every
log line.

## Built-in transports

### `ConsoleTransport`

Writes to `stdout` / `stderr`. The default if no transport is
configured.

```typescript
LoggerModule.forRoot({
  transports: [
    new ConsoleTransport({
      pretty: process.env.NODE_ENV === 'development',     // human-readable in dev
      stderr: 'error',                                    // route error+ to stderr
    }),
  ],
})
```

`pretty: true` renders human-friendly lines (colours, indentation).
`pretty: false` writes JSON one-per-line — what production log
shippers expect.

### `FileTransport`

Writes to a file (with rotation):

```typescript
new FileTransport({
  path:        '/var/log/myapp/app.log',
  maxSizeMB:   100,
  maxFiles:    10,
  rotation:    'size',         // 'size' | 'daily' | 'hourly'
  compression: 'gzip',         // compress rotated files
})
```

Rarely needed in containerised deployments — pods stream stdout to a
log shipper. Useful for long-running daemons on bare hosts.

### Custom transports

```typescript
import { type ITransport, type LogRecord } from '@omnitron-dev/titan/module/logger';

class HttpTransport implements ITransport {
  constructor(private readonly url: string) {}

  async write(record: LogRecord) {
    await fetch(this.url, {
      method: 'POST',
      body:   JSON.stringify(record),
    });
  }

  async flush()    { /* …drain pending writes… */ }
  async dispose() { /* cleanup */ }
}
```

Methods:

- `write(record)` — called for every log line. Async; the framework
  awaits.
- `flush()` — called during shutdown's `Flush` phase. Drain any
  buffered writes.
- `dispose()` — called during the `Final` phase. Close
  connections / file handles.

## Routing by level / context

Transports can opt out of records by level or by context:

```typescript
new ConsoleTransport({
  filter: (record) => record.level >= LogLevel.Info,    // info+
})

new HttpTransport({
  filter: (record) => record.service === 'orders',      // only orders service
})
```

This is cheaper than a separate processor per transport.

## Async transports and shutdown

Async transports (HTTP, remote services) buffer writes for
throughput. The buffered writes drain during the `Flush` shutdown
phase. If the transport's `flush()` exceeds its budget, records may
be lost on hard exit.

Set conservative buffers and short flush intervals for transports
where data loss is unacceptable:

```typescript
new HttpTransport({
  url:          '…',
  bufferSize:   100,           // small buffer, less to lose
  flushEveryMs: 500,           // flush twice per second
})
```

For high-volume services, use the `titan-telemetry-relay` module
instead — it persists log records to local disk first, then ships
asynchronously.

## Anti-patterns

- **One transport per service.** A single `ConsoleTransport` is
  enough; let the log shipper at the OS level route by service
  field. Multiple transports per app multiply complexity.
- **Synchronous file writes.** Block the event loop. Use the
  built-in async transports.
- **Heavyweight transports without flush limits.** A transport
  that buffers 10 000 records will lose all of them on hard exit.
  Match buffer size to acceptable loss.
- **Writing structured records as text.** A transport that does
  `record.toString()` and writes a string defeats the point of
  structured logging. Pass the JSON-serialised object.

→ Next: [Processors](./processors.md).
