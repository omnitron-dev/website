---
sidebar_position: 7
title: DI Middleware
description: Wrap container resolution itself — retry, caching, rate-limit, circuit-breaker, logging, validation, transactions.
---

# DI Middleware

DI middleware wraps **container resolution**. It runs at construction
time, not at call time. Use it to add cross-cutting behaviour to how
providers are constructed, not to how their methods are called.

```typescript
import {
  type Middleware,
  type MiddlewareFunction,
  type MiddlewareNext,
  type MiddlewareResult,
  createMiddleware,
  composeMiddleware,
  MiddlewarePipeline,
  // Built-ins
  RetryMiddleware,
  LoggingMiddleware,
  CachingMiddleware,
  RateLimitMiddleware,
  ValidationMiddleware,
  TransactionMiddleware,
  CircuitBreakerMiddleware,
} from '@omnitron-dev/titan/nexus';
```

> **DI middleware ≠ Netron middleware.** This page covers wrapping
> the resolution of providers. For wrapping per-call RPC dispatch,
> see [Netron Middleware](../netron/middleware.md).

## The `Middleware` interface

```typescript
interface Middleware<T = unknown> {
  name:     string;
  execute:  (context: MiddlewareContext<T>, next: () => T | Promise<T>) => T | Promise<T>;
  priority?: number;
  condition?: (context: MiddlewareContext<T>) => boolean;
  onError?:   (error: Error, context: MiddlewareContext<T>) => void;
}
```

`context` carries:

- `token` — the token being resolved.
- `scope` — current resolution scope.
- `parent` — the resolution that triggered this one (depth +
  cycle tracking).

`next()` resolves the provider; call exactly once and return the
value.

## Built-in middleware

```mermaid
flowchart LR
  Resolve[container.resolve]
  Resolve --> M1[Logging]
  M1 --> M2[Retry]
  M2 --> M3[Caching]
  M3 --> M4[CircuitBreaker]
  M4 --> M5[Provider executes]
```

| Middleware                 | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `RetryMiddleware`          | Retry construction if it throws                           |
| `LoggingMiddleware`        | Log every resolution with timing                          |
| `CachingMiddleware`        | Cache resolved instances by token + context               |
| `RateLimitMiddleware`      | Reject resolutions exceeding a threshold                  |
| `ValidationMiddleware`     | Validate resolved instance against a schema               |
| `TransactionMiddleware`    | Wrap resolution in a transaction (DB-aware contexts)      |
| `CircuitBreakerMiddleware` | Open a circuit after consecutive resolution failures      |

These come in two flavours. `LoggingMiddleware`, `CachingMiddleware`,
`RetryMiddleware`, `ValidationMiddleware`, and `TransactionMiddleware`
are **pre-built middleware objects** (`export const … = createMiddleware(…)`)
— add them directly. `CircuitBreakerMiddleware` and
`RateLimitMiddleware` are **classes** you instantiate with `new`
(e.g. `new RateLimitMiddleware(100, 60000)`).

## Applying middleware

Middleware is added one at a time via `container.addMiddleware()`,
which returns the container for chaining:

```typescript
const container = createContainer();

container.addMiddleware(LoggingMiddleware);
container.addMiddleware(CachingMiddleware);
container.addMiddleware(new CircuitBreakerMiddleware({ threshold: 5 }));
container.addMiddleware(new RateLimitMiddleware(100, 60000)); // 100/min
```

Execution order is governed by each middleware's `priority` field
(higher priority runs first); the container sorts on insertion. There
is no array-position ordering — set `priority` explicitly when order
matters.

## Custom middleware via `createMiddleware`

```typescript
import { createMiddleware } from '@omnitron-dev/titan/nexus';

const InstrumentationMiddleware = createMiddleware({
  name:    'instrumentation',
  execute: async (ctx, next) => {
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
  },
});

container.addMiddleware(InstrumentationMiddleware);
```

## Composing middleware

`composeMiddleware(...middlewares)` takes middleware as rest arguments
and produces a single middleware that chains them. Useful for grouping
related middleware as a single unit, then adding the composite with one
`addMiddleware()` call.

`MiddlewarePipeline` is the class that drives execution; the
container creates one internally, but you can construct one
yourself if you need to test middleware in isolation.

## Conditional execution

Middleware can opt out per resolution via `condition`:

```typescript
const ExpensiveMiddleware: Middleware = {
  name: 'expensive',
  condition: (ctx) => ctx.token === MY_TOKEN,
  execute: async (ctx, next) => { /* … */ return next(); },
};
```

When `condition(ctx)` returns false the middleware is skipped for that
resolution and `next()` runs directly.

## Per-token middleware

Some middleware suites support per-token application. Check the
specific built-in for whether it accepts a `tokens` filter, and the
provider definition for a `middleware:` field. The exact surface
varies and is documented in the source for each middleware.

## When to write DI middleware

Custom DI middleware is *rare*. The built-ins cover most cases.
Write your own when you need:

- **Project-specific telemetry** — emit to a metrics backend the
  built-ins don't know about.
- **Cross-cutting validation** — assert that every resolved
  provider matches a schema.
- **Tracing instrumentation** — attach a span to every resolution.
- **Test-only middleware** — capture the resolution graph for a
  test assertion.

Most application code does not need DI middleware at all.

## Anti-patterns

- **Putting business logic in DI middleware.** It runs at
  construction time, not per call. Method-call concerns belong in
  Netron middleware.
- **Side effects in middleware.** Middleware should observe and
  decorate, not mutate the application. A middleware that
  registers more providers is a smell.
- **Async work that should be in `onStart`.** Heavy setup belongs
  in lifecycle hooks where the framework can sequence it.

→ Next: [Circular Dependencies](./circular-dependencies.md).
