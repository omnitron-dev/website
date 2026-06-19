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
  readonly traceId:       string;   // 32 hex chars (16 bytes)
  readonly spanId:        string;   // 16 hex chars (8 bytes)
  readonly parentSpanId?: string;   // undefined for a root span
  readonly flags:         number;   // W3C trace-flags byte; bit 0 = sampled
}
```

The field is `flags` (not `traceFlags`), and there is **no**
`traceState` field — the type ships only the identifier portion of
W3C trace context. It is immutable; produce children with
`startSpan()` rather than mutating it.

Constants:

```typescript
INVALID_TRACE_ID     // '00000000000000000000000000000000'
INVALID_SPAN_ID      // '0000000000000000'
TRACE_FLAGS.SAMPLED  // 0x01
TRACE_FLAGS.NONE     // 0x00   (there is no TRACE_FLAGS.NOT_SAMPLED)
```

## Reading the active context

```typescript
const trace = currentTrace();   // TraceContext | undefined
```

Returns `undefined` if no trace is active in the current async
scope.

## Establishing a context

```typescript
import { makeTraceContext, withTrace, TRACE_FLAGS } from '@omnitron-dev/titan/tracing';

await withTrace(
  makeTraceContext({ traceId, spanId, flags: TRACE_FLAGS.SAMPLED }),
  async () => {
    await this.doWork();    // currentTrace() returns the bound context inside this scope
  }
);
```

`withTrace(ctx, fn)` installs `ctx` for the duration of `fn` (sync or
async) via `AsyncLocalStorage`, then restores the previous context.
`makeTraceContext` is a convenience for building a context literal
with `flags` defaulted to `SAMPLED`.

## Starting a span

```typescript
import { startSpan, withTrace } from '@omnitron-dev/titan/tracing';

// startSpan(parent?) returns a NEW TraceContext (a child of the
// current trace, or of `parent` if given). It does not take a name
// or attributes, and does not return an `end()` callback.
const span = startSpan();

await withTrace(span, async () => {
  await this.db.query(...);
});
```

`startSpan(parent?)` returns a fresh `TraceContext`: same `traceId`,
a new `spanId`, and `parentSpanId` set to the inherited span. If no
parent (and no current trace) exists, it mints a new root trace.
There is **no** span lifecycle, attributes, or `end()` here — this
module is propagation-only. Span timing/attributes/export belong to
a telemetry layer (the relay module or an OTel sink) on top.

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
