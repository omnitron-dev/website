---
sidebar_position: 1
title: Application
description: The Titan application kernel — what it owns, what it exposes, how to use it.
---

# Application

The `Application` object is the runtime kernel. It owns the container,
the lifecycle, the module registry, and the event bus. Every Titan
process has exactly one.

## Public surface

```typescript
import {
  Application,
  createApp,
  createAndStartApp,
  startApp,
  ApplicationToken,
  type IApplication,
  type IApplicationOptions,
} from '@omnitron-dev/titan';
```

| Symbol                  | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `Application`           | The orchestrator class                                   |
| `Application.create()`  | Static factory; returns a configured (not started) app   |
| `createApp`             | Alias of `Application.create`                            |
| `createAndStartApp()`   | Single-call bootstrap (create + start)                   |
| `startApp`              | Alias related to `Application.create` + `.start()`       |
| `IApplication`          | Public interface                                         |
| `IApplicationOptions`   | Constructor options                                      |
| `ApplicationToken`      | DI token to inject the application into a provider       |

## The minimal app

```typescript
import { Application, Module, Injectable, Service, Public } from '@omnitron-dev/titan';

@Injectable()
@Service({ name: 'Calculator' })
class CalculatorService {
  @Public()
  add(a: number, b: number): number {
    return a + b;
  }
}

@Module({
  providers: [CalculatorService],
})
class AppModule {}

const app = await Application.create({ modules: [AppModule] });
await app.start();
```

Three things happen, in order:

1. `Application.create` builds the container, registers `AppModule`,
   and resolves `CalculatorService` (singleton scope, default).
2. `app.start()` runs the lifecycle phases for every provider.
3. The app is **running**. Calls to `CalculatorService.add` are
   dispatched through the container.

> **Networking is not in the kernel.** Titan's core does not bind
> HTTP/WebSocket/TCP/Unix transports by itself. Netron transports are
> wired through dedicated modules (or through your own provider setup
> that constructs `Netron` and registers a transport). See
> [Netron RPC](../netron.md) for the transport-binding patterns.

## `Application.create` — two overloads

```typescript
// Form 1: module-first.
static create(module: ModuleInput, options?: IApplicationOptions): Promise<Application>;

// Form 2: options-only (matches the canonical README example).
static create(options?: CreateOptions): Promise<Application>;
```

`CreateOptions` extends `IApplicationOptions` with module wiring:

```typescript
const app = await Application.create({
  // From IApplicationOptions
  name:    'my-api',
  version: '2.3.1',
  container: undefined,
  config:    undefined,
  debug:     false,
  logging:   { level: 'info' },
  gracefulShutdownTimeout: 30_000,
  disableGracefulShutdown: false,
  disableCoreModules:      false,

  // Module wiring
  modules:    [AppModule],
  imports:    [],            // module tokens to import without registering classes
  providers:  [],            // [token, providerDef][] tuples for root-level providers

  // Auto-discovery (off by default)
  autoDiscovery: false,
  scanPaths:     ['./modules', './src/modules'],
  excludePaths:  [],
});
```

All fields are optional. The framework picks sane defaults — a
no-args call returns a usable (if empty) application.

## Core modules

When `disableCoreModules` is `false` (the default), the framework
auto-loads two modules:

- `ConfigModule` — typed configuration with file/env/object/argv
  sources. See [Configuration](../configuration/overview.md).
- `LoggerModule` — structured pino-based logging. See
  [Logging](../logging/overview.md).

Pass `disableCoreModules: true` if you provide your own config and
logger sources.

## The application as a DI participant

The application registers itself in the container under
`ApplicationToken`. Inject it where you need access to its public
API:

```typescript
import { ApplicationToken, type IApplication, Inject, Service, Public } from '@omnitron-dev/titan';

@Service({ name: 'AdminService' })
export class AdminService {
  constructor(@Inject(ApplicationToken) private readonly app: IApplication) {}

  @Public()
  state() { return this.app.state; }

  @Public()
  uptime() { return this.app.uptime; }
}
```

Most services should not depend on `IApplication` directly — depend
on the specific service you need (`LoggerService`, `ConfigService`).
Reach for `ApplicationToken` only when you need the kernel itself
(lifecycle control, event subscription, runtime metrics).

## What the kernel exposes

Read the per-page reference for each capability:

| Capability        | Page                                                  |
| ----------------- | ----------------------------------------------------- |
| Bootstrap         | [Bootstrap](./bootstrap.md)                           |
| Lifecycle hooks   | [Lifecycle](./lifecycle.md)                           |
| Graceful shutdown | [Shutdown](./shutdown.md)                             |
| Health            | [Health](./health.md)                                 |
| Events            | [Events](./events.md)                                 |

## Conventions

- **One Application per process.** A second `Application.create()`
  in the same process is supported but rarely useful — the
  container, lifecycle, and Netron registry are all process-scoped.
- **Top-level `await`.** `Application.create` and `start` are
  async. Always await them at the top level.
- **Don't catch every error.** A failure in `start()` should crash
  the process. A supervisor (Omnitron orchestrator, systemd, K8s)
  restarts it. Catching and continuing leaves a half-initialised
  process running — exactly the state Titan is designed to avoid.

→ Reference: [Omnitron App](../../omnitron/overview.md)
