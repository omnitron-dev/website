---
sidebar_position: 1
title: Defining Modules
description: The unit of composition in Titan — what a module is, how it composes, and how to design well.
---

# Defining Modules

A module is the unit of composition in Titan. It is a class with a
`@Module` decorator that declares three sets:

- **`providers`** — what this module *contributes* to the container.
- **`imports`** — what this module *depends on* from other modules.
- **`exports`** — what this module *exposes* to importers.

```typescript
@Module({
  imports:   [LoggerModule, ConfigModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],
})
export class UsersModule {}
```

That is the entire surface for most modules.

## The visibility rule

A provider is visible to:

1. **Other providers in the same module** — always.
2. **Providers in modules that import this module** — only if the
   provider is listed in `exports`.

A provider in `providers` but not `exports` is **module-private**.
It can be injected by services in this module, but a different
module that imports this one cannot see it.

```typescript
@Module({
  providers: [
    UsersService,         // exported below — public
    UsersRepository,      // not exported — private to this module
    UsersValidator,       // not exported — private
  ],
  exports: [UsersService],
})
export class UsersModule {}
```

This is the same encapsulation rule modules in any modular system give
you. Use it. A module that exports everything is harder to refactor
than a module that exports only its public surface.

## The composition rule

`imports` is transitive in one direction: if `A` imports `B`, then `A`
can use `B`'s exports. It is **not** transitive across — if `A`
imports `B` and `B` imports `C`, then `A` does not automatically see
`C`'s exports unless `B` re-exports them.

```typescript
@Module({
  imports: [LoggerModule, ConfigModule],
  exports: [LoggerModule],   // re-export so importers of MyModule see LoggerModule too
})
export class MyModule {}
```

Re-export when you want to *bundle* a dependency into your public
contract. Otherwise, importers should import what they need directly.

## A complete example

```typescript
import { Module, Service, Injectable, Public, Inject } from '@omnitron-dev/titan';
import { LoggerModule, type LoggerService } from '@omnitron-dev/titan/module/logger';
import { ConfigModule, type ConfigService } from '@omnitron-dev/titan/module/config';

@Injectable()
class UsersRepository {
  constructor(private readonly config: ConfigService) {}
  async findById(id: string) { /* … */ }
}

@Service('users@1.0.0')
class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly logger: LoggerService,
  ) {}

  @Public()
  async findById(id: string) {
    this.logger.info('findById', { id });
    return this.repo.findById(id);
  }
}

@Module({
  imports:   [LoggerModule, ConfigModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],
})
export class UsersModule {}
```

Read the structure top to bottom:

- `UsersRepository` is module-private. It holds an injected
  `ConfigService` (visible because we imported `ConfigModule`).
- `UsersService` is exported. It depends on `UsersRepository` (same
  module) and `LoggerService` (imported).
- `UsersModule` exports `UsersService` so other modules that import
  `UsersModule` can inject it.

## The root module

One module is special: the one you pass to `Application.create`. It is
the **root**. The root module's transitive `imports` form the entire
container.

A root module typically has no providers of its own — it just composes
the others:

```typescript
@Module({
  imports: [
    AuthModule.forRoot({ jwt: { secret: env.JWT_SECRET } }),
    DatabaseModule.forRoot({ url: env.DATABASE_URL }),
    UsersModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule {}

const app = await Application.create(AppModule);
```

This is a strong convention. It means the root module is the
"manifest" of your application — open `AppModule` and you see what
the app is made of.

## Static vs dynamic modules

The example above is a **static module** — it has fixed structure
declared at class-definition time. Most modules in your codebase will
be static.

A **dynamic module** is created by a static `forRoot()` /
`forFeature()` method that returns a `DynamicModule`. Dynamic modules
take configuration:

```typescript
DatabaseModule.forRoot({ url: env.DATABASE_URL, dialect: 'postgres' })
```

See [Dynamic Modules](./dynamic-modules.md) for details.

## Module identity

Modules are identified by **class reference**, not by name. Importing
the same module class twice is a no-op; the framework deduplicates.
Importing two *different* classes that both export the same provider
class is a conflict — the container will throw at registration time
with a clear error.

This means you cannot have two `UsersModule`s in the same
application. If you want to compose two unrelated services that both
manage "users", give the modules different names.

## Designing well

A few rules of thumb that pay off as the codebase grows:

### One module per bounded context

Group services by the domain concept they serve, not by the technical
layer. `UsersModule` contains `UsersService`, `UsersRepository`, and
`UsersValidator`. It does **not** contain `EmailService` even if
users module sends welcome emails — that goes in `NotificationsModule`,
which `UsersModule` imports.

A module that grows past 5–10 providers is usually two modules
masquerading as one. Split.

### Keep `exports` minimal

If a provider does not need to be visible outside the module, do not
export it. Smaller export surfaces are easier to refactor.

### Avoid circular imports

If `A` imports `B` and `B` imports `A`, both modules need to be
restructured. The framework will detect this at boot and throw with a
clear cycle path. Common fixes:

- Extract a third module that both `A` and `B` depend on.
- Use a shared interface in a separate module that both implement.

See [Circular Dependencies](../di/circular-dependencies.md).

### Bundle related infra modules with `forRoot`

`AuthModule.forRoot({ jwt: { … } })` is better than asking every
caller to wire `JwtSigner` and `JwtVerifier` themselves. Provide a
high-level entry point that composes the low-level providers.

→ Next: [Dynamic Modules](./dynamic-modules.md).
