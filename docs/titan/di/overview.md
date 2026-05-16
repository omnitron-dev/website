---
sidebar_position: 1
title: Dependency Injection
description: Nexus — the IoC container that owns every Titan-managed object.
---

# Dependency Injection

The DI container is the single source of truth for every object in a
Titan application. It is named **Nexus** and ships in the
`@omnitron-dev/titan/nexus` subpath.

This page is the entry point. The mechanics live in the per-page
references linked at the bottom.

## What a DI container does

Three jobs:

1. **Registration** — you tell the container "this token maps to
   this provider".
2. **Resolution** — you ask the container for a token; it constructs
   (or returns the cached instance of) whatever the provider says.
3. **Lifetime** — the container decides when a constructed instance
   is reused, scoped, or disposed.

In a Titan app, you almost never call `container.resolve` yourself.
You declare a class with constructor dependencies; the container
walks the constructor signature, resolves each dependency, and
injects them.

```typescript
@Service('users@1.0.0')
export class UsersService {
  // The container resolves Database and LoggerService from the
  // module's import graph and injects them here.
  constructor(
    private readonly db:     Database,
    private readonly logger: LoggerService,
  ) {}
}
```

## Why "Nexus" and not "the container"

Most DI containers — Angular's, NestJS's, InversifyJS — share a
common ancestry. Nexus deviates in five places that matter:

1. **Multi-token providers.** A single token can have multiple
   providers, all returned together as an array. Used for plugin
   registration, validators, middleware chains.
2. **Contextual injection.** A token can resolve to different
   providers based on a runtime context (current user, environment,
   feature flag).
3. **DI middleware.** Middleware wraps **container resolution** —
   not Netron calls. Use it for caching expensive resolutions,
   adding retry to construction, instrumenting instantiation.
4. **Cross-platform.** Nexus runs unmodified on Node, Bun, Deno,
   and the browser. Runtime detection picks the right primitives.
5. **No `reflect-metadata` requirement at the public surface.**
   Decorator metadata is used internally; consumers can use the
   container without reflection support if they prefer.

You do not need to learn a new mental model — Nexus is "DI like you
already know" — but the deeper pages (multi-injection, contextual
injection, middleware) cover the parts that differ.

## A complete example

```typescript
import { Container, createToken, Scope } from '@omnitron-dev/titan/nexus';

interface ILogger {
  info(message: string): void;
}

const LOGGER = createToken<ILogger>('Logger');

class ConsoleLogger implements ILogger {
  info(message: string) { console.log(message); }
}

class UsersService {
  constructor(private readonly logger: ILogger) {}
  list() { this.logger.info('listing users'); return []; }
}

const container = new Container();

container.register(LOGGER, {
  useClass: ConsoleLogger,
  scope:    Scope.Singleton,
});

container.register(UsersService, {
  useClass: UsersService,
  inject:   [LOGGER],
  scope:    Scope.Singleton,
});

const users = container.resolve(UsersService);
users.list();
```

In a Titan app, you do not write the `Container` calls — `@Module`,
`@Service`, and `@Injectable` translate to the same registrations
behind the scenes.

## What the container guarantees

| Guarantee                                     | Explanation                                                    |
| --------------------------------------------- | -------------------------------------------------------------- |
| **Topological resolution**                    | Dependencies are constructed before dependents                 |
| **Cycle detection**                           | Circular deps throw at registration time, not runtime          |
| **Scope correctness**                         | A `Singleton` is returned the same instance every time         |
| **Lifecycle ordering**                        | Hooks fire in dependency order (see [Lifecycle](../application/lifecycle.md)) |
| **Disposal**                                  | `container.dispose()` calls `onShutdown` on every instance     |
| **Type safety**                               | Tokens are typed; `resolve(LOGGER)` returns `ILogger`          |

## Read the deep pages

| Topic                                         | When to read                                              |
| --------------------------------------------- | --------------------------------------------------------- |
| [Providers](./providers.md)                   | The five provider types and when to use each              |
| [Scopes](./scopes.md)                         | Singleton / Transient / Scoped / Request                  |
| [Tokens](./tokens.md)                         | Class tokens, symbol tokens, multi-tokens                 |
| [Multi-injection](./multi-injection.md)       | Plugin patterns, middleware chains                        |
| [Contextual injection](./contextual-injection.md) | Per-request / per-tenant / per-environment              |
| [Middleware](./middleware.md)                 | Wrapping resolution itself                                |
| [Circular Dependencies](./circular-dependencies.md) | Diagnosing and fixing cycles                        |
| [DevTools](./devtools.md)                     | Inspecting the container at runtime                       |

→ Start with [Providers](./providers.md).
