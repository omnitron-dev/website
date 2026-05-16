---
sidebar_position: 2
title: Dynamic Modules
description: Modules that take configuration — forRoot, forFeature, async factories.
---

# Dynamic Modules

A dynamic module is a module produced by a function. Use them when
the module's providers depend on configuration the caller supplies.

## The shape

A dynamic module returns a `DynamicModule` descriptor:

```typescript
import { type DynamicModule, Module } from '@omnitron-dev/titan';

@Module({})
export class CacheModule {
  static forRoot(options: ICacheOptions): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        { provide: CACHE_OPTIONS, useValue: options },
        CacheService,
      ],
      exports: [CacheService],
      global: false,
    };
  }
}
```

A `DynamicModule` is a runtime value; the static `@Module({})`
decorator on the class is only there so the class is recognised as a
module.

## `forRoot` vs `forFeature`

A widely-followed convention:

- **`forRoot(options)`** — called once per app, in the root module.
  Configures the module globally.
- **`forFeature(options)`** — called multiple times. Returns a
  feature-specific slice, scoped to the importing module.

```typescript
@Module({
  imports: [
    DatabaseModule.forRoot({ url: env.DATABASE_URL }),     // once, global
    UsersModule,                                            // imports DatabaseModule.forFeature internally
    OrdersModule,                                           // imports DatabaseModule.forFeature internally
  ],
})
export class AppModule {}

// Inside UsersModule:
@Module({
  imports: [
    DatabaseModule.forFeature({ entities: [User, UserSession] }),
  ],
  providers: [UsersService],
})
export class UsersModule {}
```

Not every dynamic module needs both. `forRoot` alone is fine for most
cases.

## Async dynamic modules — `forRootAsync`

Use when the configuration itself comes from async sources (a remote
config service, a secret manager, an environment-specific file):

```typescript
@Module({})
export class CacheModule {
  static forRootAsync(options: IAsyncCacheOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CACHE_OPTIONS,
          useFactory: options.useFactory,
          inject:     options.inject ?? [],
        },
        CacheService,
      ],
      exports: [CacheService],
    };
  }
}
```

Caller side:

```typescript
@Module({
  imports: [
    CacheModule.forRootAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        tier: config.get('cache.tier'),
        max:  config.get('cache.max'),
      }),
    }),
  ],
})
export class AppModule {}
```

The `useFactory` is called once during bootstrap with the resolved
`inject` dependencies. Whatever it returns becomes the value bound
to `CACHE_OPTIONS`.

## Global modules

Setting `global: true` on a `DynamicModule` makes its exports visible
to every module in the application, no `imports` required:

```typescript
return {
  module: ConfigModule,
  providers: [ConfigService],
  exports: [ConfigService],
  global: true,
};
```

Use sparingly — global modules are framework infrastructure
(`ConfigModule`, `LoggerModule`). Domain modules should require
explicit imports.

## Composing options across `forRoot` calls

Some modules need composition (e.g. multiple JWT secrets, multiple
database connections). The pattern is `forRoot` once, `forFeature`
many times:

```typescript
DatabaseModule.forRoot({ default: 'postgres' })

DatabaseModule.forFeature({ name: 'analytics', dialect: 'clickhouse' })
DatabaseModule.forFeature({ name: 'reports',   dialect: 'sqlite'     })
```

The implementation usually:

- `forRoot` registers the *default* connection and the connection
  registry.
- `forFeature` registers an *additional* connection in the registry
  and exposes a feature-scoped service that uses it.

## Authoring a dynamic module

A canonical template:

```typescript
import {
  Module,
  type DynamicModule,
  type IAsyncOptions,
  createOptionsToken,
} from '@omnitron-dev/titan';

export interface IMyModuleOptions {
  apiKey: string;
  timeout?: number;
}

const MY_MODULE_OPTIONS = createOptionsToken<IMyModuleOptions>('MyModuleOptions');

@Module({})
export class MyModule {
  static forRoot(options: IMyModuleOptions): DynamicModule {
    return {
      module: MyModule,
      providers: [
        { provide: MY_MODULE_OPTIONS, useValue: options },
        MyService,
      ],
      exports: [MyService],
    };
  }

  static forRootAsync(options: IAsyncOptions<IMyModuleOptions>): DynamicModule {
    return {
      module: MyModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: MY_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject:     options.inject ?? [],
        },
        MyService,
      ],
      exports: [MyService],
    };
  }
}

@Injectable()
export class MyService {
  constructor(@Inject(MY_MODULE_OPTIONS) private readonly options: IMyModuleOptions) {}
}
```

This template scales: every ecosystem module in `@omnitron-dev/titan-*`
is built from the same skeleton.

## Anti-patterns

- **Configuration in module-level constants.** If your module reads
  `process.env.X` at file load time, you have lost the configurability
  dynamic modules give you. Read config inside `forRoot` (so the
  caller can override) or through `ConfigService`.
- **Mutating options after `forRoot`.** Options become a `useValue`
  provider; they are frozen at registration time. To change config,
  use the [Configuration](../configuration/overview.md) module's
  hot-reload.
- **Mixing `forRoot` and `forFeature` semantics.** If your module
  does not need feature-scoped configuration, do not invent a
  `forFeature` — it adds API surface for no benefit.

→ Next: [Module Discovery](./module-discovery.md).
