---
sidebar_position: 3
title: Scopes
description: Singleton, Transient, Scoped, Request — how Nexus decides when to reuse an instance.
---

# Scopes

A scope is the container's answer to the question "when do I make a
new instance?" Nexus has four:

| Scope         | New instance per …                                 | Use for                                          |
| ------------- | -------------------------------------------------- | ------------------------------------------------ |
| `Singleton`   | Container (one for the whole app)                  | Stateless services, infra (logger, db pool)      |
| `Transient`   | `resolve()` call (every time)                      | Lightweight value objects, builders              |
| `Scoped`      | Module scope                                       | Per-feature state                                |
| `Request`     | Request scope (when wrapped by a request scope)    | Per-request data — current user, request id      |

`Singleton` is the default. If you do not pass `scope`, you get one.

## Singleton

One instance for the lifetime of the container. The container caches
the result of the first `resolve()` and returns it on every subsequent
call.

```typescript
container.register(LOGGER, {
  useClass: ConsoleLogger,
  scope:    Scope.Singleton,        // default; can omit
});
```

When to use: 99% of services. Stateless services, services that hold
shared infrastructure (pool, client, registry), services with
expensive construction.

When **not** to use: services that hold per-request state (current
user, transaction handle). Use `Request` instead.

## Transient

A new instance every time the container resolves it. The container
does not cache the instance.

```typescript
container.register(REQUEST_BUILDER, {
  useClass: RequestBuilder,
  scope:    Scope.Transient,
});

const a = container.resolve(REQUEST_BUILDER);
const b = container.resolve(REQUEST_BUILDER);
a === b;  // false
```

When to use: lightweight value objects (builders, formatters,
short-lived calculators) where instantiation is cheap and statelessness
is preferred.

When **not** to use: services that allocate resources (file handles,
sockets, large caches). Each transient instance leaks unless explicitly
disposed.

## Scoped

One instance per *module scope*. A child container created for a
module gets its own scoped instance; sibling modules get distinct
instances.

```typescript
container.register(FEATURE_STATE, {
  useClass: FeatureState,
  scope:    Scope.Scoped,
});
```

In day-to-day Titan code, `Scoped` overlaps heavily with the natural
encapsulation of modules; you can usually achieve the same isolation by
declaring the provider in the module that owns the scope and not
exporting it.

When to use: feature modules that need their own private mutable state
that should not bleed across scopes. Rare in practice.

## Request

One instance per request scope. The container creates a child scope per
request (typically per Netron call); providers in `Request` scope live
exactly as long as the scope.

```typescript
container.register(REQUEST_CONTEXT, {
  useClass: RequestContext,
  scope:    Scope.Request,
});
```

The middleware that creates the request scope is part of Netron; you do
not wire it manually. Inside a `@Public` method, injecting a
`Request`-scoped provider gives you a fresh instance for that call.

When to use:
- Holding the current user (set by auth middleware, read by
  business logic).
- Carrying the trace context across handlers within one request.
- Per-request transaction handles in DB modules.

When **not** to use: shared infrastructure. A `Request`-scoped
database pool would create a new connection per request — exactly what
the pool is meant to prevent.

## Mixing scopes — the "narrower-into-wider" rule

A wider-scoped provider **must not** depend on a narrower-scoped one.
This compiles, but the framework will detect and warn at boot:

```typescript
@Service('users@1.0.0')                 // Singleton (wider)
class UsersService {
  constructor(private ctx: RequestContext) {}   // Request (narrower) — invalid
}
```

Why: a singleton lives for the whole app. If it captures a
request-scoped object, that object outlives its scope. Subsequent
requests see stale data.

The fix: inject a *factory* that resolves the narrower scope on
demand:

```typescript
@Service('users@1.0.0')
class UsersService {
  constructor(@Inject(REQUEST_CONTEXT_PROVIDER) private getCtx: () => RequestContext) {}

  @Public()
  async whoAmI() {
    const ctx = this.getCtx();           // resolved per call
    return ctx.userId;
  }
}
```

## Lifetime by scope

| Scope         | Created                       | Disposed                                            |
| ------------- | ----------------------------- | --------------------------------------------------- |
| `Singleton`   | First resolve                 | `container.dispose()` (calls `onShutdown`)          |
| `Transient`   | Every resolve                 | Never (caller's responsibility)                     |
| `Scoped`      | First resolve in scope        | Scope disposal                                      |
| `Request`     | First resolve in request      | End of request                                      |

`Transient` instances are not tracked by the container. If they hold
resources, the caller must dispose them.

## Scope tags

Both `Scoped` and `Request` are tagged scopes. Tags let you create
multiple distinct scopes of the same type, each with its own provider
cache:

```typescript
const cartScope    = container.createScope('cart');
const sessionScope = container.createScope('session');

cartScope.resolve(CART_STATE);    // distinct instance from sessionScope's CART_STATE
```

This is the underlying mechanism behind `Request`-scoped providers in
Netron — every incoming call creates a tagged scope, and providers
resolve fresh against it.

## Anti-patterns

- **`Singleton` for per-request state.** Easy mistake; usually fixed
  by wrapping the state in a service that injects a `Request`-scoped
  context.
- **`Transient` for resource-holding services.** Each instance leaks.
  Use `Singleton` or explicit pooling.
- **`Request` for stateless calculators.** Wasteful — a new instance
  per request, with no upside.
- **Long chains of `Request`-scoped providers.** Each resolution costs
  a scope cache lookup. Keep request-scoped surfaces thin and let
  the bulk of business logic be `Singleton`.

→ Next: [Tokens](./tokens.md).
