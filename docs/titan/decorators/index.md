---
sidebar_position: 1
title: Decorators
description: Every decorator Titan ships — what it does, when to use it, what to import.
---

# Decorators

Titan's decorators come from two locations:

| Import path                            | Surface                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `@omnitron-dev/titan`                  | Core set: `Service`, `Injectable`, `Inject`, `Optional`, `Singleton`, `Transient`, `Module`, `PostConstruct`, `PreDestroy` |
| `@omnitron-dev/titan/decorators`       | Full set: all of the above plus `Public`, `Auth`, `RateLimit`, `Cache`, `Scoped`, `Request`, `Global`, `Memoize`, `Retry`, `Deprecated`, `Validate`, `Contract`, `NoValidation`, `ValidateInput`, `ValidateOutput`, `contract`, `Timeout`, `Retryable`, `Log`, `Monitor` |

For day-to-day code, import the core set from the main entry. Reach
for the `/decorators` subpath when you need the extras.

## Class-level

### `@Module(options)`

Marks a class as a module. Without it, the class is invisible to the
module registry.

```typescript
@Module({
  imports:   [LoggerModule, ConfigModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],
})
export class UsersModule {}
```

→ [Defining Modules](../modules-system/defining-modules.md)

### `@Injectable(options?)`

Marks a class as DI-resolvable. The container can construct it; its
constructor parameters are resolved as dependencies.

```typescript
@Injectable()
export class UsersRepository {
  constructor(private readonly db: Database) {}
}
```

`@Service` implies `@Injectable()`. Use `@Injectable()` for
non-service helpers (repositories, mappers, internal utilities).

→ [Providers](../di/providers.md)

### `@Service(options?)`

Marks a class as a Netron RPC service.

```typescript
// String form — name + optional version
@Service('users@1.0.0')
class UsersService {}

// Object form
@Service({ name: 'users', version: '1.0.0' })
class UsersService {}

// Just a name (version becomes empty / unversioned)
@Service('users')
class UsersService {}

// Defaults — derived from class name
@Service()
class UsersService {}
```

The qualified identifier is `name@version`. The name must match
`/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/` — Latin letters, numbers, and
dots only (dots for namespacing). The version must be valid semver
if provided.

`@Service` implies `@Injectable()`.

→ [Netron Services](../netron/services.md)

### Scope shorthands

```typescript
import { Singleton, Transient, Scoped, Request } from '@omnitron-dev/titan/decorators';

@Singleton()
class CacheService {}

@Transient()
class RequestBuilder {}

@Request()
class RequestContext {}
```

`Singleton` and `Transient` are also re-exported from the main entry;
`Scoped` and `Request` live in `/decorators`.

→ [Scopes](../di/scopes.md)

### `@Global()`

Marks a module as global — its exports are visible to every module
in the application without explicit imports.

```typescript
@Global()
@Module({
  providers: [LoggerService],
  exports:   [LoggerService],
})
class LoggerModule {}
```

Use sparingly. Reserved for framework infrastructure.

## Method-level — RPC

### `@Public(options?)`

Exposes a method (or property) over Netron. The options object can
carry `auth`, `rateLimit`, `cache`, `audit`, `prefetch`, `transports`,
`readonly` configuration. Methods without `@Public` are visible to
the process but not RPC-callable.

```typescript
@Service('users@1.0.0')
class UsersService {
  // Plain exposure.
  @Public()
  async findById(id: string) { /* … */ }

  // Inline configuration of everything @Public knows about.
  @Public({
    auth:      { roles: ['admin'] },
    rateLimit: { limit: 100, window: 60_000 },
    cache:     { ttl: 30_000 },
    transports: ['ws', 'tcp'],
  })
  async heavyMethod(query: string) { /* … */ }

  private internalHelper() { /* not exposed */ }
}
```

`@Public` is **opt-in**. The default is internal — methods that
look fine inside the process should not silently become RPC-callable
without an explicit decision.

### `@Auth(config)`

Configures authentication and authorisation for a method. Use
alongside `@Public()` for cleaner separation of concerns. The shape
of `AuthConfig`:

```typescript
@Public()
@Auth({
  roles:       ['admin'],          // ANY role grants access
  permissions: ['users:read'],     // ALL permissions required
  scopes:      ['user.read'],      // ALL OAuth2 scopes required
  policies:    ['policy.name'],    // or { all: [...] } / { any: [...] } / expression
  allowAnonymous: false,
  inherit:        true,
  override:       false,
})
async findById(id: string) { /* … */ }
```

The policy framework (see `BuiltInPolicies` in
`@omnitron-dev/titan/netron/auth`) provides reusable
`requireRole`, `requireAnyRole`, `requireAllRoles`,
`requirePermission`, and similar policies.

→ [Netron Authentication](../netron/authentication.md)

### `@RateLimit(config)`

Configures rate limiting. The basic shape:

```typescript
@Public()
@RateLimit({ limit: 100, window: 60_000 })   // 100 requests per minute
async searchDocuments(query: string) { /* … */ }
```

Advanced (tier-based) shape:

```typescript
@Public()
@RateLimit({
  defaultTier: { name: 'free',    limit: 10,  burst: 20  },
  tiers:       { premium:        { limit: 100, burst: 150 } },
  window:      60_000,
})
async searchDocuments(query: string) { /* … */ }
```

The actual `RateLimitConfig` lives in
`@omnitron-dev/titan/netron/auth/rate-limiter.ts`.

→ [titan-ratelimit](../modules/ratelimit.md)

### `@Cache(config)`

Caches the method result. The shape:

```typescript
@Public()
@Cache({
  ttl:          30_000,                          // ms
  keyGenerator: (args) => `user:${args[0]}`,     // optional; default uses args hash
  invalidateOn: ['user:updated'],                // events that bust this cache
  maxSize:      1_000,
})
async findById(id: string) { /* … */ }
```

→ [titan-cache](../modules/cache.md)

### `@Validate(schema, options?)` and `@Contract(contract)`

Validate input (and optionally output) against Zod schemas.

```typescript
import { z } from '@omnitron-dev/titan/validation';
import { Validate, Contract } from '@omnitron-dev/titan/decorators';

@Public()
async create(@Validate(CreateUserSchema) input: z.infer<typeof CreateUserSchema>) {
  // input is parsed and trusted here.
}

@Public()
@Contract(FindByIdContract)
async findById(input: { id: string }) { /* input + output validated */ }
```

Other validation decorators: `ValidateInput`, `ValidateOutput`,
`NoValidation`, `Contracts` (class-level), `contract` (builder).

→ [Validation](../validation/overview.md)

## Method-level — utilities

### `@Memoize()`

Per-instance memoisation of method results, keyed by `JSON.stringify`
of arguments. In-memory only; lives as long as the instance.

```typescript
@Memoize()
private computeHash(input: string) { /* … */ }
```

### `@Retry({ attempts?, delay? })`

Retries the method on failure with a **fixed** delay between
attempts. `attempts` defaults to 3, `delay` to 1000 ms.

```typescript
@Retry({ attempts: 3, delay: 200 })
async fetchUpstream() { /* … */ }
```

For exponential backoff and classifier-driven decisions, use the
`computeBackoff` helper in `@omnitron-dev/titan/utils` with your own
retry loop. See [Resilience / Retry](../resilience/retry.md).

### `@Deprecated({ message?, version? })`

Marks the method as deprecated. Metadata only; the framework does
not log warnings.

```typescript
@Deprecated({ message: 'Use findById instead', version: '2.0.0' })
async getUser(id: string) { /* … */ }
```

### `@Timeout({ ms })`, `@Retryable(...)`, `@Log({...})`, `@Monitor({...})`

Additional utility interceptors in
`@omnitron-dev/titan/decorators/utility.ts`. Less commonly used; see
the source for current signatures.

## Parameter-level

### `@Inject(token)`

Specifies the DI token for this parameter. Required for symbol
tokens and multi-tokens; optional for class tokens (auto-detected
from constructor metadata).

```typescript
constructor(
  @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
  private readonly db: Database,                            // class token; @Inject not needed
) {}
```

### `@Optional()`

Makes the dependency optional. If no provider is registered, the
parameter receives `undefined`.

```typescript
constructor(
  @Optional() @Inject(METRICS_TOKEN) private readonly metrics?: IMetrics,
) {}
```

### `@InjectAll(token)`, `@InjectMany(token)`

Inject all providers registered against a multi-token.

### `@Value(path, default?)`, `@InjectEnv(key, default?)`, `@InjectConfig(path)`

Inject from configuration sources. `@Value` resolves through a
config tree; `@InjectEnv` reads `process.env`; `@InjectConfig` reads
through `ConfigService` (see [Configuration](../configuration/overview.md)).

### `@Lazy(tokenFactory)`

Inject a token resolved lazily on first use. Used to break circular
dependencies.

→ [Circular Dependencies](../di/circular-dependencies.md)

## Lifecycle decorators

### `@PostConstruct()`, `@PreDestroy()`

Mark methods that run during the `onInit` / `onDestroy` lifecycle
phases.

```typescript
@PostConstruct()
async warm() { /* … */ }

@PreDestroy()
async drain() { /* … */ }
```

Equivalent to implementing `OnInit` / `OnDestroy` interfaces. See
[Lifecycle Decorators](./lifecycle.md).

## Decorator order

When stacking decorators, **outermost-first** in declaration order;
execution at call time is **inside-out**:

```typescript
@Public()                                              //  ← outer
@Auth({ roles: ['admin'] })                            //
@RateLimit({ limit: 10, window: 60_000 })              //
@Validate(InputSchema)                                 //  ← inner, runs first
async dangerousOp(input: Input) { /* … */ }
```

→ See [Method Traits](./method-traits.md) for stacking guidance.

## Anti-patterns

- **Decorating private methods with `@Public`.** Private methods
  are not meant to be called from outside; making them RPC-callable
  is a security risk.
- **Inline configuration vs decorators.** `@Public({ auth: …,
  rateLimit: …, cache: … })` is equivalent to stacking `@Public()
  @Auth(…) @RateLimit(…) @Cache(…)`. Pick one style per project
  and stick to it.
- **Using `@Memoize` for cross-instance caching.** Memoisation is
  per-instance. For shared caching across calls and clients, use
  `@Cache`.
- **Decorating constructors.** Decorators on constructors do
  nothing in Titan — the framework reads class-level decorators,
  not constructor-level. Move the metadata to the class.

→ Next: [Lifecycle Decorators](./lifecycle.md).
