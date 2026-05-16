---
sidebar_position: 4
title: Tokens
description: Class tokens, symbol tokens, multi-tokens — type-safe identifiers for providers.
---

# Tokens

A token is the key the container uses to look up a provider. Three
forms cover every case in Titan.

## 1. Class tokens

The class itself is the token. This is the form Titan uses by default
for `@Injectable` and `@Service` classes:

```typescript
@Service('users@1.0.0')
class UsersService { /* … */ }

container.resolve(UsersService);    // class is the token
```

When to use: any time you have a concrete class as the dependency.
Idiomatic for service classes.

When **not** to use: when you want to inject an *interface* (TypeScript
interfaces vanish at runtime, so they cannot be tokens), or when you
want multiple implementations under the same key.

## 2. Symbol tokens — `createToken<T>()`

A typed symbol identifier. The generic parameter ties the token to
its value type for compile-time checking.

```typescript
import { createToken } from '@omnitron-dev/titan/nexus';

interface ILogger {
  info(msg: string): void;
}

const LOGGER = createToken<ILogger>('Logger');

container.register(LOGGER, { useClass: ConsoleLogger });
const logger = container.resolve(LOGGER);
//      ^? ILogger
```

The first argument is a debug name (shown in error messages); it is
not used for matching. Two `createToken('Logger')` calls produce two
distinct tokens.

When to use: any dependency that is an interface, an external type, or
otherwise not a class. Configuration values, third-party objects,
options bundles.

## 3. Multi-tokens

A token registered with `multi: true` accumulates providers; resolving
returns an array.

```typescript
import { createToken } from '@omnitron-dev/titan/nexus';

interface IValidator {
  validate(input: unknown): boolean;
}

const VALIDATORS = createToken<IValidator[]>('Validators');

container.register(VALIDATORS, { useClass: EmailValidator,    multi: true });
container.register(VALIDATORS, { useClass: PasswordValidator, multi: true });

const validators = container.resolve(VALIDATORS);
//      ^? IValidator[]
```

The token's generic is `T[]` to reflect the array shape.

When to use: registries that grow over time — validators, middleware,
plugins, lifecycle hooks. See [Multi-injection](./multi-injection.md).

## Injecting tokens

In a class, use `@Inject(TOKEN)` for non-class tokens:

```typescript
import { Inject } from '@omnitron-dev/titan';

@Service('users@1.0.0')
class UsersService {
  constructor(
    @Inject(LOGGER)     private readonly logger: ILogger,
    @Inject(VALIDATORS) private readonly validators: IValidator[],
    private readonly db: Database,        // class token; no @Inject needed
  ) {}
}
```

Class tokens do not need `@Inject` — Titan uses TypeScript's emitted
constructor metadata. Symbol and multi-tokens always need `@Inject`
because TypeScript cannot emit them.

## Optional dependencies

```typescript
import { Inject, Optional } from '@omnitron-dev/titan';

@Service('users@1.0.0')
class UsersService {
  constructor(
    private readonly db: Database,
    @Optional() @Inject(METRICS) private readonly metrics?: IMetrics,
  ) {}
}
```

If `METRICS` is not registered, the parameter receives `undefined`
instead of throwing.

When to use: telemetry, tracing, optional integrations. Avoid for
core dependencies — a missing core dep should fail loudly at boot,
not silently degrade.

## Token naming conventions

| Convention          | Example                            |
| ------------------- | ---------------------------------- |
| `SCREAMING_SNAKE`   | `LOGGER`, `API_KEY`, `DB_POOL`     |
| Descriptive name    | `'Logger'`, `'DatabasePool'`       |
| Suffix `_OPTIONS`   | `LOGGER_OPTIONS`, `CACHE_OPTIONS`  |
| Suffix `_TOKEN`     | Avoid; redundant                   |

Place token declarations next to the interface they identify, in the
same module that owns the interface:

```typescript
// logger.tokens.ts
export interface ILogger { info(msg: string): void; }
export const LOGGER = createToken<ILogger>('Logger');
```

## Token uniqueness

Tokens are matched by reference equality. Two `createToken('Logger')`
calls produce two distinct tokens, even though they share the name.
This is by design — it prevents accidental collision between modules
that both define a `'Logger'` token.

If you want a single shared token, declare it once in a shared module
and import it everywhere it is used.

## Class tokens vs symbol tokens — when to choose what

The framework treats class and symbol tokens identically at runtime.
The choice is one of *intent*:

| Use class token if …                          | Use symbol token if …                                           |
| --------------------------------------------- | --------------------------------------------------------------- |
| The dependency is a concrete class            | The dependency is an interface                                  |
| There is one canonical implementation         | You may swap implementations (mock, alternative, feature-flag)  |
| Construction is in your codebase              | The value is a config bundle, options, or external object       |
| You want refactor-friendly imports            | You want explicit decoupling (consumers depend on the token, not the impl) |

## Anti-patterns

- **String tokens.** Some DI frameworks accept `'logger'` as a token;
  Nexus does not. Strings are not unique enough — use `createToken`
  for typed identity.
- **Tokens declared in the implementation file.** A consumer that
  injects `LOGGER` should not have to import the implementation just
  to get the token. Place tokens in a separate file (or in the
  module's barrel export) that the implementation also imports.
- **Re-creating tokens at consumption sites.** `createToken` returns
  a fresh token every call — re-creating means the resolution will
  fail. Always import the same token instance the registration uses.

→ Next: [Multi-injection](./multi-injection.md).
