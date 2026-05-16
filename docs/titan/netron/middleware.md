---
sidebar_position: 3
title: RPC Middleware
description: Per-call wrapping for cross-cutting concerns.
---

# RPC Middleware

RPC middleware wraps every Netron call. It runs once per call, on the
server side, around your method body. Use it for cross-cutting
concerns that apply uniformly across services — auth checks, rate
limiting, tracing, logging, metrics.

> Do not confuse with **DI middleware**, which wraps container
> resolution. See [DI Middleware](../di/middleware.md) for the
> distinction.

## The interface

```typescript
import { type INetronMiddleware, type NetronContext } from '@omnitron-dev/titan/netron';

interface INetronMiddleware {
  handle(ctx: NetronContext, next: () => Promise<unknown>): Promise<unknown>;
}
```

`ctx` carries:

- `service` — the service identifier (`'users@1.0.0'`).
- `method` — the method name being called.
- `args` — the parsed argument array.
- `headers` — the transport headers (`Map<string, string>`).
- `auth` — the resolved auth context (set by auth middleware).
- `traceId` / `spanId` — the trace context.
- `metadata` — free-form per-call metadata for downstream middleware.

`next()` invokes the next middleware in the chain (or the method body
if this is the last). Always call exactly once. Return the result.

## Registering middleware

Netron middleware is registered with the running `Netron` instance
(typically constructed by the ecosystem module that owns it). The
canonical path is via the `LocalPeer.middleware` registration API
exposed in `@omnitron-dev/titan/netron`. The shape generally looks
like:

```typescript
import { Netron } from '@omnitron-dev/titan/netron';

const netron = new Netron(/* options */);
netron.use(TracingMiddleware);
netron.use(AuthMiddleware);
netron.use(RateLimitMiddleware);
```

Order in registration is the **execution order**. The first
middleware runs first, calls `next()`, and the call propagates
inward. Consult `netron/netron.ts` for the canonical registration
surface in the version you are using; ecosystem modules
(`titan-auth`, `titan-ratelimit`) handle this wiring on your
behalf.

## Order matters

The conventional outer-to-inner order:

```
Tracing → Auth → RateLimit → Validation → Logging → method body
```

- **Tracing first.** Establishes the trace context so everything
  downstream can attach to it.
- **Auth before rate limit.** So that authenticated callers don't
  share a rate bucket with anonymous abusers.
- **RateLimit before validation.** Cheap rate-limit lookup before
  the expensive Zod parse.
- **Validation in the middleware stack via** `@Validate` — runs
  inline as the first thing inside the method body's wrapper.
- **Logging last (outermost) for inbound** or **innermost for the
  method body** depending on what you want to observe.

## A custom middleware — timing

```typescript
@Injectable()
class TimingMiddleware implements INetronMiddleware {
  async handle(ctx: NetronContext, next: () => Promise<unknown>) {
    const t0 = performance.now();
    try {
      const result = await next();
      metrics.histogram('rpc.duration_ms', {
        service: ctx.service,
        method:  ctx.method,
        outcome: 'ok',
      }).observe(performance.now() - t0);
      return result;
    } catch (e) {
      metrics.histogram('rpc.duration_ms', {
        service: ctx.service,
        method:  ctx.method,
        outcome: 'error',
      }).observe(performance.now() - t0);
      throw e;
    }
  }
}
```

Register via the multi-token pattern (see
[Multi-injection](../di/multi-injection.md)) and Netron picks it up.

## Per-method middleware

Decorators on individual methods (e.g. `@RateLimit`, `@Auth`) are
also middleware — applied only to the decorated method. They compose
with the global middleware stack, running after the global ones.

```typescript
@Public()
@Auth({ scope: 'admin' })
@RateLimit({ capacity: 5, refillPerSec: 1 })
async dangerousOp() { /* … */ }
```

Effective order:

```
[Global] Tracing → [Global] Auth → [Global] RateLimit → 
  [Method] Auth (scope check) → [Method] RateLimit → 
    method body
```

The global ones do the heavy lifting (validate token, resolve user);
the method-level ones add specific policy.

## Skipping middleware for specific methods

For methods that bypass a middleware (health checks, public
introspection), use the `@Skip(MiddlewareClass)` decorator:

```typescript
@Public()
@Skip(AuthMiddleware)
async ping() { return 'pong'; }
```

The middleware class is still registered globally; the decorator
opts this method out.

## Modifying the request

Middleware can mutate the `args` array before calling `next()` — for
example, normalising input or injecting derived data:

```typescript
async handle(ctx, next) {
  // Trim leading/trailing whitespace from string args.
  ctx.args = ctx.args.map(a => typeof a === 'string' ? a.trim() : a);
  return next();
}
```

Mutate sparingly. Per-method validation is a better fit for
content rules; middleware should handle cross-cutting transforms
(normalisation, trimming, conversion to canonical form).

## Modifying the response

Wrap the result of `next()` to transform it:

```typescript
async handle(ctx, next) {
  const result = await next();
  if (typeof result === 'object' && result !== null) {
    return { ...result, _serverTimeMs: Date.now() };
  }
  return result;
}
```

Useful for response envelopes, version stamping, redaction.

## Error interception

Middleware sees errors from `next()`. Common patterns:

```typescript
async handle(ctx, next) {
  try {
    return await next();
  } catch (e) {
    if (e instanceof NotFoundError) {
      // Convert framework error to project-specific shape.
      throw new ProjectNotFoundError(e.message, { /* … */ });
    }
    throw e;
  }
}
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
