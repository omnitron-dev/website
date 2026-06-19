---
sidebar_position: 4
title: Tokens
description: Class, symbol, multi-, lazy, async, optional, config, stream — the token family.
---

# Tokens

A token is the key the container uses to look up a provider. Nexus
ships a rich family of token constructors for different use cases.

```typescript
import {
  createToken,
  createMultiToken,
  createLazyToken,
  createOptionalToken,
  createAsyncToken,
  createConfigToken,
  createScopedToken,
  createStreamToken,
  isToken,
  isMultiToken,
  isOptionalToken,
  tokenFromClass,
  getTokenName,
} from '@omnitron-dev/titan/nexus';
```

## Token interface

Every token implements:

```typescript
interface Token<T = any> {
  readonly id:       symbol;
  readonly name:     string;
  readonly metadata: TokenMetadata;
  readonly type?:    T;
  toString(): string;
}
```

The phantom `type?: T` carries the value type for compile-time
checking; tokens are matched by reference equality at runtime
(identity = `id` symbol).

## Token kinds

### Class token — the class itself

```typescript
@Service({ name: 'users' })
class UsersService {}

container.resolve(UsersService);    // class is the token
```

When you have a concrete class, the class **is** the token. This is
the idiomatic form for service classes.

### Symbol token — `createToken<T>(name)`

```typescript
interface ILogger { info(msg: string): void; }
const LOGGER = createToken<ILogger>('Logger');

container.register(LOGGER, { useClass: ConsoleLogger });
const logger = container.resolve(LOGGER);  // ILogger
```

The name is both a debug label **and** the registry key: `createToken`
caches by name in a process-global registry, so two
`createToken('Logger')` calls (with no metadata) return the **same**
token instance. Tokens are still matched by `symbol` identity at
runtime — the registry just guarantees that identity is shared for a
given name.

Use for: interfaces, configuration bundles, third-party types.

### Multi-token — `createMultiToken<T>(name)`

```typescript
const VALIDATORS = createMultiToken<IValidator>('Validators');

container.register(VALIDATORS, { useClass: EmailValidator,    multi: true });
container.register(VALIDATORS, { useClass: PasswordValidator, multi: true });

container.resolve(VALIDATORS);  // IValidator[]
```

Use for: plugin registration, middleware chains, validators. See
[Multi-injection](./multi-injection.md).

### Optional token — `createOptionalToken<T>(name)`

```typescript
const METRICS = createOptionalToken<IMetrics>('Metrics');

@Service({ name: 'users' })
class UsersService {
  constructor(@Inject(METRICS) private readonly metrics?: IMetrics) {}
  // metrics is undefined if no provider was registered.
}
```

`isOptionalToken(token)` distinguishes these at runtime.

### Lazy token — `createLazyToken<T>(name, metadata?)`

```typescript
const AUTH = createLazyToken<AuthService>('Auth');
```

Tags the token as lazy (`isLazy: true`); pair it with
`container.resolveLazy(AUTH)` to defer construction until first use.
Useful for breaking circular import graphs. See
[Circular Dependencies](./circular-dependencies.md).

### Async token — `createAsyncToken<T>(name)`

```typescript
const REMOTE = createAsyncToken<RemoteService>('Remote');

container.register(REMOTE, {
  useFactory: async () => connectRemote(),
  async:      true,
});

const remote = await container.resolveAsync(REMOTE);
```

### Config token — `createConfigToken<T>(name, { validate?, defaults? })`

A typed token specifically for configuration bundles. The
`@omnitron-dev/titan/module/config` module uses these internally.

### Stream token — `createStreamToken<T>(name)`

A token for streaming values (async iterables). Used in advanced
patterns where the provider yields data continuously.

### Scoped token — `createScopedToken<T>(name, scope)`

Bake a default scope into the token; providers registered against it
inherit the scope unless explicitly overridden.

## Class → token helper

```typescript
const token = tokenFromClass(UsersService);
// Equivalent to using UsersService directly as the token,
// but returns the canonical Token<UsersService> object.
```

Useful when you need to pass the token around (logs, error messages)
without re-deriving it from the class.

## Injecting tokens

In a class, use `@Inject(TOKEN)` for non-class tokens:

```typescript
import { Inject } from '@omnitron-dev/titan';

@Service({ name: 'users' })
class UsersService {
  constructor(
    @Inject(LOGGER)     private readonly logger:     ILogger,
    @Inject(VALIDATORS) private readonly validators: IValidator[],
    private readonly db: Database,        // class token; no @Inject needed
  ) {}
}
```

Class tokens do not need `@Inject` — Titan uses TypeScript's emitted
constructor metadata. Symbol-based tokens always need `@Inject`
because TypeScript cannot emit them.

## Token uniqueness

Tokens are matched by `symbol` identity at runtime, and `createToken`
backs that identity with a process-global, name-keyed registry: two
`createToken('Logger')` calls (with no metadata) return the **same**
token. Passing metadata bypasses the cache and yields a fresh,
non-cached token.

For clarity, still declare a shared token once in a shared module and
import it everywhere rather than relying on the by-name registry to
reconcile independently-created tokens.

## Token naming conventions

| Convention          | Example                            |
| ------------------- | ---------------------------------- |
| `SCREAMING_SNAKE`   | `LOGGER`, `API_KEY`, `DB_POOL`     |
| Descriptive name    | `'Logger'`, `'DatabasePool'`       |
| Suffix `_TOKEN`     | `LOGGER_TOKEN` (ecosystem modules) |
| Suffix `_OPTIONS`   | `LOGGER_OPTIONS`, `CACHE_OPTIONS`  |

Ecosystem modules (`titan-cache`, `titan-redis`, etc.) use the
`_TOKEN` suffix consistently for their exported tokens.

## Anti-patterns

- **String tokens.** Some DI frameworks accept `'logger'` as a
  token; Nexus does not. Use `createToken` for typed identity.
- **Tokens declared in the implementation file.** A consumer that
  injects `LOGGER` should not have to import the implementation
  just to get the token. Place tokens in a separate file (or a
  `*.tokens.ts` barrel) that the implementation also imports.
- **Re-creating tokens at consumption sites.** While `createToken`
  reconciles bare names through its global registry, re-deriving a
  token at each call site is brittle (a typo, or any metadata
  argument, breaks identity). Always import the same token instance.

→ Next: [Multi-injection](./multi-injection.md).
