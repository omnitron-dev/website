---
sidebar_position: 3
title: RPC Middleware
description: Per-call wrapping for cross-cutting concerns.
---

# RPC Middleware

:::warning Middleware is an HTTP-transport pipeline
The Netron middleware pipeline lives in the **HTTP transport**
(`netron/transport/http/middleware/`). The persistent transports
(WebSocket / TCP / Unix) do **not** run this pipeline — they enforce
auth and access control inline at dispatch (`remote-peer.ts`). There
is no `INetronMiddleware` interface, no `NetronContext` type, and no
`netron.use()` method; the real surface is the `MiddlewarePipeline`
described below.
:::

RPC middleware wraps Netron calls over HTTP. It runs on the server
side, around dispatch. Use it for cross-cutting concerns that apply
uniformly — auth checks, rate limiting, tracing, logging, metrics.

> Do not confuse with **DI middleware**, which wraps container
> resolution. See [DI Middleware](../di/middleware.md) for the
> distinction.

## The middleware function

A middleware is a plain function, not a class with `handle()`:

```typescript
import {
  type MiddlewareFunction,
  type NetronMiddlewareContext,
  MiddlewareStage,
} from '@omnitron-dev/titan/netron/transport/http/middleware';

const timing: MiddlewareFunction = async (ctx, next) => {
  const t0 = performance.now();
  await next();                       // returns void; result lives on ctx.result
  record(ctx.serviceName, ctx.methodName, performance.now() - t0);
};
```

`ctx` (`NetronMiddlewareContext`) carries:

- `peer` — the `LocalPeer | RemotePeer` handling the call.
- `serviceName` / `methodName` — what's being invoked.
- `input` — the call input; `result` — the return value (set around `next()`).
- `error` — set if dispatch threw.
- `metadata` — a `Map<string, unknown>` for per-call data; the auth
  context and authorization header live here
  (`ctx.metadata.get('authContext')`).
- `timing` — `{ start, middlewareTimes }`.
- `skipRemaining` — set `true` to short-circuit the rest of the stage.

The HTTP-specific `HttpMiddlewareContext` extends this with `request`,
`response`, `route`, `params`, `query`, `body`, `cookies`.

`next()` invokes the next middleware (or dispatch). It returns
`Promise<void>` — there is no result to return; read/write `ctx.result`
instead.

## Registering middleware

Middleware is registered on the HTTP server's `MiddlewarePipeline`,
not on `Netron`. The pipeline exposes:

```typescript
pipeline.use(fn, config?, stage?);                    // global
pipeline.useForService('users@1.0.0', fn, config?);   // one service
pipeline.useForMethod('users@1.0.0', 'findById', fn); // one method
```

Each registration takes an optional `MiddlewareConfig`
(`{ name, priority?, condition?, onError?, services?, methods? }`) and
a `MiddlewareStage`. In practice the HTTP server wires its own
defaults (request-id, token extraction, the `NetronAuthMiddleware`);
app bootstrap code adds custom middleware where it constructs the
transport.

## Stages and order

The pipeline runs in five **stages** (`MiddlewareStage`), and within a
stage middleware is ordered by `priority` (lower runs first, default
`100`):

```
PRE_PROCESS → PRE_INVOKE → [dispatch] → POST_INVOKE → POST_PROCESS
                                                          ↘ ERROR (on throw)
```

- **`PRE_PROCESS`** — earliest; the HTTP server registers request-id
  and token extraction here.
- **`PRE_INVOKE`** — before the method runs; auth/authorization
  (`NetronAuthMiddleware`), rate limiting, validation belong here.
- **`POST_INVOKE` / `POST_PROCESS`** — after dispatch; response
  shaping, compression, logging.
- **`ERROR`** — runs when a stage throws.

Put cheaper checks before expensive ones (rate-limit lookup before a
heavy parse) by giving them a lower `priority`.

## A custom middleware — timing

```typescript
import { type MiddlewareFunction, MiddlewareStage } from '@omnitron-dev/titan/netron/transport/http/middleware';

const timingMiddleware: MiddlewareFunction = async (ctx, next) => {
  const t0 = performance.now();
  try {
    await next();
    metrics.histogram('rpc.duration_ms', {
      service: ctx.serviceName,
      method:  ctx.methodName,
      outcome: 'ok',
    }).observe(performance.now() - t0);
  } catch (e) {
    metrics.histogram('rpc.duration_ms', {
      service: ctx.serviceName,
      method:  ctx.methodName,
      outcome: 'error',
    }).observe(performance.now() - t0);
    throw e;
  }
};

pipeline.use(timingMiddleware, { name: 'timing', priority: 5 }, MiddlewareStage.PRE_INVOKE);
```

Titan also ships ready-made factories on `NetronBuiltinMiddleware`
(metrics, logging, circuit-breaker, retry, caching, …) and
`HttpBuiltinMiddleware` (CORS, compression, body parsing, security
headers).

## Per-method policy via decorators

Method decorators (`@Auth`, `@RateLimit`, `@Cache`) are **not**
middleware classes — they stamp `reflect-metadata` onto the method.
The auth middleware (and, on WS/TCP, the inline dispatch path) reads
that metadata and enforces it:

```typescript
@Public()
@Auth({ roles: ['admin'] })
@RateLimit({ defaultTier: { name: 'admin', limit: 5 }, window: 60_000 })
async dangerousOp() { /* … */ }
```

So enforcement runs *inside* the auth/rate-limit step of the pipeline
(or inline on WS/TCP) — there is no separate per-method middleware
instance. The global step does the heavy lifting (validate token,
resolve user); the decorator metadata supplies the specific policy.

## Scoping middleware to specific methods

There is no `@Skip` decorator. To limit (or exclude) middleware, use
the registration filters on `MiddlewareConfig` — `services` /
`methods` (string list or `RegExp`) and `condition`:

```typescript
pipeline.use(authMiddleware, {
  name: 'auth',
  methods: /^(?!ping$).*/,        // everything except `ping`
});
```

The built-in `NetronAuthMiddleware` also accepts `skipServices` /
`skipMethods` options, and any middleware can set `ctx.skipRemaining`
to short-circuit the rest of its stage.

## Modifying the request

Middleware can mutate `ctx.input` before calling `next()` — for
example, normalising input or injecting derived data:

```typescript
const trim: MiddlewareFunction = async (ctx, next) => {
  if (Array.isArray(ctx.input)) {
    ctx.input = ctx.input.map(a => typeof a === 'string' ? a.trim() : a);
  }
  await next();
};
```

Mutate sparingly. Per-method validation is a better fit for
content rules; middleware should handle cross-cutting transforms
(normalisation, trimming, conversion to canonical form).

## Modifying the response

`next()` runs dispatch and populates `ctx.result`; transform it after:

```typescript
const stamp: MiddlewareFunction = async (ctx, next) => {
  await next();
  if (typeof ctx.result === 'object' && ctx.result !== null) {
    ctx.result = { ...ctx.result, _serverTimeMs: Date.now() };
  }
};
```

Useful for response envelopes, version stamping, redaction.

## Error interception

Dispatch errors surface as a throw from `next()` (and are also set on
`ctx.error`). Common pattern:

```typescript
const mapErrors: MiddlewareFunction = async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    if (e instanceof NotFoundError) {
      // Convert framework error to project-specific shape.
      throw new ProjectNotFoundError(e.message, { /* … */ });
    }
    throw e;
  }
};
```

Avoid swallowing. Errors that middleware suppresses become silent
failures; the client sees a successful response that has no real
result.

## Anti-patterns

- **Calling `next()` more than once.** The result is undefined.
  Some middleware in the chain will run twice; client may receive
  two responses or a malformed one.
- **Skipping `next()` based on a condition.** If you bypass the
  method, you must produce a return value. Bypass is the right
  pattern for caching middleware (return a cached value); for
  guards, throw an error instead.
- **Long-running async work.** Every middleware extends the call
  duration. Keep middleware fast or run it asynchronously after
  `next()` returns (e.g. async logging).
- **Sharing state between middlewares via globals.** Use
  `ctx.metadata` — it's per-call and isolated.

→ Next: [Authentication](./authentication.md).
