---
sidebar_position: 7
title: DI Middleware
description: Wrap container resolution itself — caching, retry, instrumentation, circuit breakers.
---

# DI Middleware

DI middleware wraps **container resolution**. It runs at construction
time, not at call time. Use it to add cross-cutting behaviour to how
providers are constructed, not to how their methods are called.

> Do not confuse this with **Netron RPC middleware**, which wraps
> per-call dispatch. The two are independent.
> See [Netron Middleware](../netron/middleware.md) for the per-call form.

## When DI middleware is the right tool

| Concern                                                       | DI middleware? |
| ------------------------------------------------------------- | -------------- |
| Cache an expensive provider construction                      | Yes            |
| Retry a flaky factory (e.g. async setup that occasionally fails) | Yes         |
| Log every resolution for diagnostics                          | Yes            |
| Apply a circuit breaker to a remote-construction factory      | Yes            |
| Validate input parameters of a method                         | No (use Validation) |
| Authorise a method call                                        | No (use Netron auth) |
| Time a method execution                                        | No (use Netron middleware) |

## Built-in middleware

Nexus ships with five common patterns:

| Middleware                  | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `RetryMiddleware`           | Retry resolution if construction throws                   |
| `CachingMiddleware`         | Cache resolved instances by token + context               |
| `RateLimitMiddleware`       | Reject resolutions exceeding a threshold                  |
| `CircuitBreakerMiddleware`  | Open a circuit after consecutive resolution failures      |
| `LoggingMiddleware`         | Log every resolution with timing                          |

Apply by registering with the container. The exact registration API
lives in `@omnitron-dev/titan/nexus`; consult the source for the
canonical surface — typically along the lines of:

```typescript
import { Container } from '@omnitron-dev/titan/nexus';

const container = new Container();

container.useMiddleware([
  /* logging, retry, caching middleware … */
]);
```

The order is the *outer-to-inner* execution order — the first
middleware runs first, then delegates to the next, until the
provider itself is invoked.

## Custom middleware

```typescript
import { type DIMiddleware } from '@omnitron-dev/titan/nexus';

const InstrumentationMiddleware: DIMiddleware = async (ctx, next) => {
  const t0 = performance.now();
  try {
    const instance = await next();
    metrics.histogram('di.resolve.ms', { token: ctx.token.name })
      .observe(performance.now() - t0);
    return instance;
  } catch (e) {
    metrics.counter('di.resolve.errors', { token: ctx.token.name }).inc();
    throw e;
  }
};

container.useMiddleware([InstrumentationMiddleware]);
```

`ctx` carries:

- `token` — the token being resolved.
- `provider` — the provider definition.
- `scope` — the scope being resolved within.
- `parent` — the resolution context that triggered this one (for
  detecting circular and tracking depth).

`next()` returns the resolved instance. Call it exactly once.

## Per-token middleware

Sometimes you want middleware applied only to specific tokens (e.g.
retry only for the database pool). Register middleware on the
provider:

```typescript
container.register(DB_POOL, {
  useFactory: createPool,
  inject:     [ConfigService],
  middleware: [
    /* per-token middleware instances */
  ],
});
```

Per-token middleware runs *after* container-wide middleware in the
chain. This means container-wide policy (e.g. `LoggingMiddleware`)
wraps everything, including the per-token resilience.

## Resolution context

The middleware runs within a `ResolutionContext` that tracks:

- The token being resolved.
- The dependency chain that led here.
- Any open scopes.
- Resolution timing.

Inspect it from inside middleware:

```typescript
const TimingMiddleware: DIMiddleware = async (ctx, next) => {
  if (ctx.depth > 5) {
    log.warn('deep resolution chain', {
      token: ctx.token.name,
      chain: ctx.parent?.token.name,
    });
  }
  return next();
};
```

## Async middleware

All middleware is async. The container awaits each `next()` call.
Sync middleware works (return a value instead of a Promise) but the
chain is still treated as async.

## When to write your own

Custom DI middleware is *rare*. The built-ins cover most cases. Write
your own when you need:

- **Project-specific telemetry** — emit to a metrics backend the
  built-ins don't know about.
- **Cross-cutting validation** — assert that every resolved provider
  matches a schema.
- **Tracing instrumentation** — attach a span to every resolution.
- **Test-only middleware** — capture the resolution graph for a
  test assertion.

Most application code does not need DI middleware at all.

## Anti-patterns

- **Putting business logic in DI middleware.** It runs at
  construction time, not per call. Authorisation, validation,
  rate-limiting *of method calls* belong in Netron middleware.
- **Side effects in middleware.** Middleware should observe and
  decorate, not mutate the application. A middleware that logs is
  fine; a middleware that registers more providers is a smell.
- **Async work that should be in `onStart`.** Heavy setup belongs
  in lifecycle hooks, where the framework can sequence it. DI
  middleware should not do "open the database connection" — that's
  what `onStart` is for.

→ Next: [Circular Dependencies](./circular-dependencies.md).
