---
sidebar_position: 1
title: Titan Overview
---

# Titan Overview

**Titan** is the backend framework at the heart of Omnitron. It packages a
dependency-injection container, a module system, a lifecycle, validation,
structured logging, and the Netron RPC plane — all reachable from a small
set of decorators.

## Why Titan exists

The TypeScript backend ecosystem fragments along a familiar fault line:
heavyweight all-in-one frameworks on one side, raw Node.js on the other.
Either you adopt a runtime that owns your app's structure, or you
hand-wire DI, config, validation, logging, and transport every project.

Titan is the in-between point: a small, composable framework where every
moving part is opt-in. The base export gives you `Application`, `Module`,
`Service`, and the container. Everything else — auth, cache, database,
metrics — is a separate package you import when you need it.

## The four primitives

### `@Service('name@version')`

Marks a class as a Netron service. The version is part of the identity:
`users@1.0.0` and `users@2.0.0` are distinct services that can coexist
on the same app.

```typescript
@Service('users@1.0.0')
export class UsersService {
  // …
}
```

### `@Public()`

Marks a method as exposed over the configured RPC transports. Methods
without `@Public` are internal — callable from inside the container,
invisible from the wire.

```typescript
@Public()
async findById(id: string): Promise<User> { /* … */ }
```

### `@Module({...})`

Declares a unit of composition: providers (classes the container
instantiates), imports (other modules), exports (providers visible to
importers).

```typescript
@Module({
  imports:   [LoggerModule, ConfigModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],
})
export class UsersModule {}
```

### `Application.create(RootModule, options)`

Builds the container, runs the lifecycle, exposes Netron transports.
Returns an `Application` instance you `.start()` and `.stop()`.

```typescript
const app = await Application.create(AppModule, {
  netron: { http: { port: 3000 } },
});
await app.start();
```

## What you get out of the box

- **Container with explicit DI** — providers resolved by class
  reference; no string-based lookups by default.
- **Lifecycle** — `onInit`, `onStart`, `onStop`, `onShutdown` hooks
  fired in dependency order.
- **Validation** — `@Validate(Schema)` decorator on method
  parameters; backed by Zod or a compatible schema library.
- **Errors** — `NetronError` hierarchy with typed subclasses for
  client/server distinction.
- **Logging** — `LoggerModule` for structured JSON with trace
  context propagation.
- **Configuration** — `ConfigModule.forRoot({...})` with file +
  env + override sources, schema-validated.
- **Tracing** — built-in trace ID propagation through Netron calls.

## What's optional

| Need                  | Module                      |
| --------------------- | --------------------------- |
| JWT auth              | `titan-auth`                |
| Caching               | `titan-cache`               |
| SQL database          | `titan-database`            |
| Service discovery     | `titan-discovery`           |
| Event bus             | `titan-events`              |
| Health checks         | `titan-health`              |
| Distributed locks     | `titan-lock`                |
| Metrics               | `titan-metrics`             |
| Notifications         | `titan-notifications`       |
| Process management    | `titan-pm`                  |
| Rate limiting         | `titan-ratelimit`           |
| Redis client          | `titan-redis`               |
| Scheduled jobs        | `titan-scheduler`           |
| Telemetry shipping    | `titan-telemetry-relay`     |

See [Modules](./modules/index.md) for a per-module reference.

## Read next

- [Application & DI](./application.md) — the container, providers,
  modules, lifecycle.
- [Netron RPC](./netron.md) — transports, middleware, auth.
- [Modules](./modules/index.md) — the 14 ecosystem modules.
