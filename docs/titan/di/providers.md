---
sidebar_position: 2
title: Providers
description: The five provider types and when to use each.
---

# Providers

A provider tells the container *how* to produce a value for a token.
Nexus has five provider shapes. They cover every case from "construct
this class" to "return this remote service after async setup".

## 1. ClassProvider — `useClass`

The default. The container calls `new` on the class, resolving its
constructor dependencies first.

```typescript
container.register(LOGGER, {
  useClass: ConsoleLogger,
  inject:   [],                  // optional; auto-detected from metadata
  scope:    Scope.Singleton,
});
```

In Titan, this is what `@Module({ providers: [ConsoleLogger] })`
becomes. The bare class form is shorthand:

```typescript
@Module({ providers: [ConsoleLogger] })   // same as { useClass: ConsoleLogger }
```

Use when: the value is a class you control and the container can
construct it.

## 2. ValueProvider — `useValue`

A pre-built value. The container does not construct anything; it
hands out the same value every time.

```typescript
container.register(API_KEY, {
  useValue: 'sk_live_…',
});

container.register(CONFIG, {
  useValue: { tier: 'redis-lru', max: 10_000 },
});
```

Use when: the value is data, an external object, or a configuration
literal.

## 3. FactoryProvider — `useFactory`

A function called once (per scope) to produce the value. The factory
can declare its own dependencies via `inject`.

```typescript
container.register(DB_POOL, {
  useFactory: (config: ConfigService) => {
    return createPool({
      url: config.get('database.url'),
      max: config.get('database.pool.max'),
    });
  },
  inject: [ConfigService],
  scope:  Scope.Singleton,
});
```

The factory may return a Promise; the container awaits it during
resolution.

```typescript
container.register(REDIS_CLIENT, {
  useFactory: async (config: ConfigService) => {
    const client = createRedisClient({ url: config.get('redis.url') });
    await client.connect();
    return client;
  },
  inject: [ConfigService],
  scope:  Scope.Singleton,
});
```

Use when: the value requires async setup, complex construction logic,
or a runtime decision.

## 4. TokenProvider — `useExisting`

Aliases one token to another. Resolving the alias returns whatever the
other token resolves to.

```typescript
container.register(LOGGER, {
  useClass: ConsoleLogger,
  scope:    Scope.Singleton,
});

container.register(AUDIT_LOGGER, {
  useExisting: LOGGER,           // same instance as LOGGER
});
```

Use when: you want two tokens to refer to the same object — feature
flags that gate which implementation, abstraction wrappers, gradual
migration between two interfaces.

## 5. MultiToken — array of providers under one token

Multiple providers register against the same token. Resolving the
token returns an array of all of them.

```typescript
container.register(VALIDATORS, {
  useClass:  EmailValidator,
  multi:     true,
});

container.register(VALIDATORS, {
  useClass:  PasswordValidator,
  multi:     true,
});

const validators = container.resolve(VALIDATORS);   // [EmailValidator, PasswordValidator]
```

This is the pattern for plugin systems, middleware chains,
extensible registries. See [Multi-injection](./multi-injection.md).

Use when: many independent contributions feed into one consumer.

## Provider options shared across all types

| Option       | Default              | Effect                                                      |
| ------------ | -------------------- | ----------------------------------------------------------- |
| `scope`      | `Scope.Singleton`    | Lifetime — see [Scopes](./scopes.md)                        |
| `inject`     | `[]`                 | Tokens for `useFactory` arguments or constructor params     |
| `multi`      | `false`              | Register under MultiToken — multiple providers per token    |
| `when`       | `undefined`          | Conditional provider — only registers if predicate is true  |
| `useFallback`| `undefined`          | Pair with `when`; provides a fallback if predicate is false |
| `tags`       | `[]`                 | Free-form labels for observability and contextual injection |

## Conditional providers

```typescript
container.register(BILLING_SERVICE, {
  useClass:    StripeBillingService,
  when:        (ctx) => ctx.config.get('billing.provider') === 'stripe',
  useFallback: NoopBillingService,
  scope:       Scope.Singleton,
});
```

The predicate runs once at resolution time; the result is cached. Use
for feature flags, environment-specific implementations.

## Async providers

Any of the five provider types can produce a Promise. The container
awaits during resolution. To declare an async-only resolution path
explicitly:

```typescript
import { createAsyncProvider } from '@omnitron-dev/titan/nexus';

const asyncProvider = createAsyncProvider({
  useFactory: async (config: ConfigService) => {
    return await connectToService(config);
  },
  inject: [ConfigService],
});

container.register(REMOTE_SERVICE, asyncProvider);
```

Equivalent to `useFactory` returning a Promise; the explicit form
documents intent.

## Choosing between provider types

| If you have …                                                | Use                              |
| ------------------------------------------------------------ | -------------------------------- |
| A class you can `new` directly                               | `useClass`                       |
| A pre-built object, literal, or constant                     | `useValue`                       |
| A function that produces the value (sync or async)           | `useFactory`                     |
| One token that should mirror another                         | `useExisting`                    |
| Multiple independent contributions to one consumer           | `multi: true`                    |
| Conditional based on config or environment                   | `when` + `useFallback`           |

## Anti-patterns

- **`useFactory` for trivial construction.** If the factory is just
  `() => new MyClass()`, use `useClass`. Factories are for non-trivial
  construction logic.
- **`useValue` for mutable shared state.** A `useValue` provider hands
  out the *same reference* every time. If consumers mutate it, the
  state is global. Wrap mutable state in a class with controlled
  access methods.
- **Async providers in hot paths.** Async resolution awaits a
  Promise on every call (per-scope). A request-scoped async provider
  costs you a Promise per request. Prefer eager async setup in
  `onStart` lifecycle hooks.
- **Forgetting `multi: true` with multi-tokens.** Without it, the
  second registration overwrites the first.

→ Next: [Scopes](./scopes.md).
