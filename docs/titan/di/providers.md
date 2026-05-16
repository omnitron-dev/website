---
sidebar_position: 2
title: Providers
description: The provider types Nexus understands and the helpers that build them.
---

# Providers

A provider tells the container *how* to produce a value for a token.
Nexus exposes four core shapes plus async / conditional / multi
variants — and helper functions that produce them.

```typescript
import {
  createValueProvider,
  createFactoryProvider,
  createClassProvider,
  createTokenProvider,
  createMultiProvider,
  createConditionalProvider,
  isAsyncProvider,
  isMultiProvider,
  isConstructor,
  hasScope,
} from '@omnitron-dev/titan/nexus';
```

## 1. ClassProvider — `useClass`

The default. The container calls `new` on the class, resolving its
constructor dependencies first.

```typescript
container.register(LOGGER, {
  useClass: ConsoleLogger,
  scope:    Scope.Singleton,
  inject:   [],                // optional; auto-detected from metadata
  lazy:     false,             // construct on first resolve, not eagerly
  async:    false,             // declare an async provider
  multi:    false,             // single token
});
```

In Titan, this is what `@Module({ providers: [ConsoleLogger] })`
becomes. The bare-class form is shorthand:

```typescript
@Module({ providers: [ConsoleLogger] })   // same as { useClass: ConsoleLogger }
```

Use when: the value is a class you control and the container can
construct it.

## 2. ValueProvider — `useValue`

A pre-built value. The container hands out the same value every time.

```typescript
container.register(API_KEY, { useValue: 'sk_live_…' });
container.register(CONFIG,  { useValue: { tier: 'redis-lru', max: 10_000 } });
```

Or via helper:

```typescript
const provider = createValueProvider('sk_live_…');
container.register(API_KEY, provider);
```

Use when: the value is data, an external object, or a constant.

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

The factory may return a Promise; declare with `async: true` or use
`resolveAsync` on the caller side:

```typescript
container.register(REDIS_CLIENT, {
  useFactory: async (config: ConfigService) => {
    const client = createRedisClient({ url: config.get('redis.url') });
    await client.connect();
    return client;
  },
  inject: [ConfigService],
  async:  true,
  scope:  Scope.Singleton,
});

const redis = await container.resolveAsync(REDIS_CLIENT);
```

Use when: the value requires async setup, complex construction
logic, or a runtime decision.

## 4. TokenProvider — `useToken`

Aliases one token to another. Resolving the alias returns whatever
the other token resolves to.

```typescript
container.register(LOGGER, {
  useClass: ConsoleLogger,
  scope:    Scope.Singleton,
});

container.register(AUDIT_LOGGER, {
  useToken: LOGGER,           // same instance as LOGGER
});
```

Use when: you want two tokens to refer to the same object —
feature flags that gate which implementation, abstraction wrappers,
gradual migration between two interfaces.

## 5. MultiProvider — `multi: true` (or `createMultiProvider`)

Multiple providers register against the same multi-token. Resolving
returns an array.

```typescript
import { createMultiToken } from '@omnitron-dev/titan/nexus';

const VALIDATORS = createMultiToken<IValidator>('Validators');

container.register(VALIDATORS, { useClass: EmailValidator, multi: true });
container.register(VALIDATORS, { useClass: PasswordValidator, multi: true });

const validators = container.resolve(VALIDATORS);  // IValidator[]
```

See [Multi-injection](./multi-injection.md) for the full pattern.

## Conditional providers — `createConditionalProvider`

```typescript
import { createConditionalProvider } from '@omnitron-dev/titan/nexus';

const provider = createConditionalProvider({
  when:        (ctx) => ctx.config.get('billing.provider') === 'stripe',
  useClass:    StripeBillingService,
  useFallback: NoopBillingService,
  scope:       Scope.Singleton,
});

container.register(BILLING_SERVICE, provider);
```

The predicate runs at resolution time; the result is cached per
scope.

## Provider options summary

| Option       | Default              | Effect                                                      |
| ------------ | -------------------- | ----------------------------------------------------------- |
| `scope`      | `Scope.Singleton`    | Lifetime — see [Scopes](./scopes.md)                        |
| `inject`     | `[]`                 | Tokens for `useFactory` arguments or constructor params     |
| `multi`      | `false`              | Multi-injection — multiple providers per token              |
| `lazy`       | `false`              | Defer construction until first resolve                      |
| `async`      | `false`              | Provider produces a Promise                                 |

## Provider predicates

Helper predicates for introspection:

| Function                       | What it checks                              |
| ------------------------------ | ------------------------------------------- |
| `isConstructor(value)`         | Is the value a class constructor?           |
| `isAsyncProvider(provider)`    | Does the provider produce a Promise?        |
| `isMultiProvider(provider)`    | Is it registered as `multi: true`?          |
| `hasScope(provider)`           | Does the provider have an explicit scope?   |

## Choosing between provider types

| If you have …                                                | Use                              |
| ------------------------------------------------------------ | -------------------------------- |
| A class you can `new` directly                               | `useClass`                       |
| A pre-built object, literal, or constant                     | `useValue`                       |
| A function that produces the value (sync or async)           | `useFactory`                     |
| One token that should mirror another                         | `useToken`                       |
| Multiple independent contributions to one consumer           | `multi: true`                    |
| Conditional based on context / config                        | `createConditionalProvider`      |

## Anti-patterns

- **`useFactory` for trivial construction.** If the factory is just
  `() => new MyClass()`, use `useClass`.
- **`useValue` for mutable shared state.** A `useValue` provider
  hands out the *same reference* every time. If consumers mutate
  it, the state is global. Wrap mutable state in a class.
- **Async providers in hot paths.** Async resolution awaits a
  Promise on every call (per scope). Prefer eager async setup in
  `onStart` lifecycle hooks.

→ Next: [Scopes](./scopes.md).
