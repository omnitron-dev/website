---
sidebar_position: 1
title: Tracing
description: W3C-compatible trace context propagation, zero dependencies.
---

# Tracing

Titan ships a minimal tracing layer that carries a W3C `traceparent`-
compatible context across async scopes via `AsyncLocalStorage`.
No OpenTelemetry SDK is required.

This is the foundation. For full observability (spans exported to a
collector, exemplars, sampling), layer the
[`titan-telemetry-relay`](./modules/telemetry-relay) or your own
OTel integration on top.

## Public surface

```typescript
import {
  // From '@omnitron-dev/titan' main entry (re-exports a subset):
  createSpanId,
  createTraceId,
  currentTrace,
  extractTraceparent,
  formatTraceparent,
  parseTraceparent,
  startSpan,
  withTrace,
  type TraceContext,
} from '@omnitron-dev/titan';

// From '@omnitron-dev/titan/tracing' (the full surface):
import {
  INVALID_SPAN_ID,
  INVALID_TRACE_ID,
  TRACE_FLAGS,
  makeTraceContext,
} from '@omnitron-dev/titan/tracing';
```

## `TraceContext`

```typescript
interface TraceContext {
  traceId:       string;     // 16 bytes, hex
  spanId:        string;     // 8 bytes, hex
  parentSpanId?: string;
  traceFlags:    number;     // bit 0 = sampled
  traceState?:   string;     // W3C tracestate header
}
```

Constants:

```typescript
INVALID_TRACE_ID    // '00000000000000000000000000000000'
INVALID_SPAN_ID     // '0000000000000000'
TRACE_FLAGS.SAMPLED // 1
TRACE_FLAGS.NOT_SAMPLED // 0
```

## Reading the active context

```typescript
const trace = currentTrace();   // TraceContext | undefined
```

Returns `undefined` if no trace is active in the current async
scope.

## Establishing a context

```typescript
await withTrace(
  { traceId, spanId, traceFlags: TRACE_FLAGS.SAMPLED },
  async () => {
    await this.doWork();    // currentTrace() returns the bound context inside this scope
  }
);
```

## Starting a span

```typescript
const { traceContext, end } = startSpan('database.query', {
  // attributes (implementation-defined)
});

try {
  await this.db.query(...);
} finally {
  end('ok');                    // or end('error')
}
```

`startSpan` returns `{ traceContext, end }`. The span is in-memory
— no automatic export. A telemetry exporter (the relay module or
an OTel sink) is responsible for shipping it.

## W3C `traceparent` header

```typescript
// Parse incoming header
const trace = extractTraceparent('00-T-S-01');     // returns TraceContext
// or:
const trace = parseTraceparent('00-T-S-01');

// Serialise for outgoing
const header = formatTraceparent(trace);            // '00-T-S-01'
```

Netron uses these helpers internally to propagate trace context
across RPC calls.

## Manual propagation

`AsyncLocalStorage` does not propagate across worker threads,
queue boundaries, or some Promise pool implementations. Capture
and restore manually:

```typescript
const captured = currentTrace();
worker.postMessage({ work, trace: captured });

// On the worker side:
worker.on('message', async ({ work, trace }) => {
  await withTrace(trace, async () => {
    await processWork(work);
  });
});
```

## Anti-patterns

- **Reading the trace context manually inside business logic.**
  Defeats the point. Trust the framework's propagation; let the
  trace context attach to logs and downstream calls automatically.
- **Trace IDs in error payloads.** Errors carry their own
  structure. Trace correlation happens in the log aggregator by
  `traceId`, not by passing the ID in the error.
- **Skipping `withTrace` across async boundaries.** A trace
  context that doesn't propagate across a worker thread leaves
  the downstream work uncorrelated. Capture and restore.

→ Back to [Titan Overview](./overview.md).
