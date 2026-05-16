---
sidebar_position: 1
title: Configuration
description: Layered, validated, hot-reloadable configuration for Titan apps.
---

# Configuration

`ConfigModule` is one of the two core modules auto-loaded with every
Titan app (the other is `LoggerModule`). Disable with
`disableCoreModules: true` if you need to provide your own.

This is the entry point. Detail in:

- [Sources](./sources.md) — files, env, argv, objects, remote.
- [Validation](./validation.md) — schema-checked config at boot.
- [Hot Reload](./hot-reload.md) — `ConfigWatcherService` and events.

## The mental model

Configuration is **layered**: multiple sources merge into a single
typed object. Later sources override earlier ones. Optionally
validated against a Zod schema.

```typescript
import { ConfigModule } from '@omnitron-dev/titan/module/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      schema: AppConfigSchema,
      sources: [
        { type: 'file', path: 'config/default.yaml' },
        { type: 'env',  prefix: 'APP_' },
      ],
      validateOnStartup: true,
      watchForChanges:   true,
    }),
  ],
})
class AppModule {}
```

## Reading config

### Through `ConfigService`

```typescript
import { Inject, Service } from '@omnitron-dev/titan';
import { ConfigService, CONFIG_SERVICE_TOKEN } from '@omnitron-dev/titan/module/config';

@Service({ name: 'Users' })
class UsersService {
  constructor(@Inject(CONFIG_SERVICE_TOKEN) private readonly config: ConfigService) {}

  @Public()
  async findById(id: string) {
    const ttl = this.config.get<number>('cache.ttlMs', 60_000);
    // …
  }
}
```

`get<T>(path, default?)` returns the typed value at the dotted path.
The default is returned if the key is missing.

### Through decorators

```typescript
import { Config, InjectConfig } from '@omnitron-dev/titan/module/config';

@Service({ name: 'Users' })
class UsersService {
  @Config('cache.ttlMs', 60_000)
  private readonly cacheTtl!: number;

  @InjectConfig()
  private readonly fullConfig!: AppConfig;
}
```

`@Config(path, default?)` injects a specific value. `@InjectConfig()`
injects the full config object.

Additional config decorators:

| Decorator                  | Effect                                                  |
| -------------------------- | ------------------------------------------------------- |
| `@ConfigSchema(schema)`    | Class-level Zod schema for this class's config subtree  |
| `@Configuration(prefix?)`  | Bind a class to a config prefix (auto-populates fields) |
| `@ConfigWatch(path)`       | Method runs when the watched path changes               |
| `@ConfigDefaults({...})`   | Provide defaults at class level                         |
| `@ConfigProvider(name)`    | Mark a class as a custom config provider                |

## Why validate at boot

A typed schema for your config means:

- **Misconfiguration crashes at startup**, not at the first call
  that needs the bad value.
- **Type safety in code** — `config.get('database.url')` returns the
  schema's type, not `string | undefined`.
- **Documentation lives in the schema** — readers know what config
  the app accepts by reading the Zod schema.

## When to use what

| Approach                  | When                                                |
| ------------------------- | --------------------------------------------------- |
| `ConfigService.get(path)` | Reading multiple unrelated keys; dynamic key paths  |
| `@Config(path, default?)` | A class needs one or two specific values            |
| `@Configuration(prefix)`  | A class is a *typed view* of a config subtree       |
| Compile-time constants    | Compile-time values that don't change per env       |

For values that change per environment, **always** use config —
hardcoded `localhost:5432` in code locks you to one deployment.

## Read on

- [Sources](./sources.md) — every source type and what it accepts.
- [Validation](./validation.md) — schema patterns and error
  handling.
- [Hot Reload](./hot-reload.md) — `ConfigWatcherService`, the
  `config:changed` event.

→ Next: [Sources](./sources.md).
