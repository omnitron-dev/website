---
sidebar_position: 1
title: Tracing
description: W3C-compatible trace context propagation, zero dependencies.
---

# Tracing

Titan ships a minimal tracing layer that carries a W3C `traceparent`-
compatible context across async scopes, Netron calls, and log lines.
No OpenTelemetry SDK is required.

This is the foundation. For full observability (spans exported to a
collector, metrics, exemplars), layer the
[`titan-telemetry-relay`](./modules/telemetry-relay.md) module on top.

## What it does

- Generates W3C-compatible trace IDs (16 bytes) and span IDs (8 bytes).
- Stores the active context in `AsyncLocalStorage`.
- Propagates the context through Netron calls (server-to-server).
- Attaches `traceId` / `spanId` to every log line in the same scope.

What it does **not** do:

- Export spans anywhere. Spans live in memory until you ship them.
- Sample, batch, or instrument middleware automatically.
- Provide spanmetrics, exemplars, or context.

For those, add the relay module or wire OTel manually.

## The API

```typescript
import {
  createTraceId,
  createSpanId,
  startSpan,
  withTrace,
  currentTrace,
  extractTraceparent,
  formatTraceparent,
} from '@omnitron-dev/titan/tracing';
```

### `currentTrace()`

Returns the active trace context, or `undefined` if none:

```typescript
const trace = currentTrace();
// { traceId, spanId, traceFlags, traceState }
```

### `withTrace(context, fn)`

Run `fn` inside the given trace context:

```typescript
await withTrace(
  { traceId: t, spanId: s, traceFlags: 1 },
  async () => {
    await this.doWork();    // currentTrace() returns the bound context
  }
);
```

### `startSpan(name, options?)`

Create a child span under the current trace:

```typescript
const span = startSpan('database.query', { attributes: { table: 'users' } });
try {
  await this.db.query(...);
} finally {
  span.end();
}
```

The span is in-memory — no automatic export. The relay module reads
ended spans and ships them.

## Netron integration

Every Netron call propagates the trace context automatically. The
sender attaches the W3C `traceparent` header (or transport
equivalent); the receiver extracts and binds it.

A call inside a span looks like one trace across services:

```
Browser                        OrdersService                 PaymentsService
  │                                  │                              │
  ├── traceparent:                   │                              │
  │   00-T-S1-01                     │                              │
  │                                  ├── traceparent:               │
  │                                  │   00-T-S2-01                 │
  │                                  │                              │
  └── log: traceId=T spanId=S1       └── log: traceId=T spanId=S2   └── log: traceId=T spanId=S3
```

Same `T` across all three services; different `S` per scope. Logs
correlated by `T`.

## Logging integration

The logger reads `currentTrace()` per record:

```typescript
this.logger.info('processing order', { orderId: 'o_42' });
// → {"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","msg":"processing order","orderId":"o_42",…}
```

You don't add `traceId` manually — it appears automatically when a
trace context is active.

## Manual context propagation

`AsyncLocalStorage` does not propagate across worker threads, queue
boundaries, or some Promise pool implementations. For those, capture
and restore manually:

```typescript
const captured = currentTrace();
worker.postMessage({ work: …, trace: captured });

// On the worker side:
import { withTrace } from '@omnitron-dev/titan/tracing';

worker.on('message', async ({ work, trace }) => {
  await withTrace(trace, async () => {
    await processWork(work);
  });
});
```

## Sampling

The base tracing layer treats every span as sampled (the
`traceFlags` field carries 1). Real sampling — drop a fraction of
traces to reduce volume — happens at the relay layer.

If you don't ship traces anywhere, sampling doesn't matter; the
in-memory cost is bounded by your span volume.

## When to span

Pragmatic rules:

- **Span an inbound RPC call.** Already done by Netron; you don't
  need to start a span for the call itself.
- **Span an outbound HTTP / DB call.** Useful for finding slow
  dependencies. Use `startSpan` and `end` in `finally`.
- **Span a unit of work that can fail and be retried.** Each retry
  attempt becomes its own span; the parent shows the retry count.

Don't span every method. The cost adds up; the noise drowns the
signal.

## Anti-patterns

- **Reading the trace context manually inside business logic.**
  Defeats the point. Trust the framework's propagation; let the
  trace context attach to logs and downstream calls automatically.
- **Trace IDs in error payloads.** Errors over the wire carry
  their own structure. Trace correlation happens in the log
  aggregator by `traceId`, not by passing the ID in the error.
- **Skipping `withTrace` across async boundaries.** A trace
  context that doesn't propagate across a worker thread leaves
  the downstream work uncorrelated. Capture and restore.

→ Back to [Titan Overview](./overview.md).
