---
sidebar_position: 2
title: Architecture
description: Subsystems, boundaries, and what owns what at runtime.
---

# Architecture

Titan is an orchestrator over nine focused subsystems. Each subsystem
has one responsibility, one entry point, and a typed contract with the
others. Understanding the boundaries makes the framework significantly
easier to reason about.

## The nine subsystems

```mermaid
flowchart TB
  Client[Client / CLI / Console]

  subgraph App["Application Kernel"]
    direction TB
    Bootstrap["Bootstrap<br/>(create + start)"]
    Lifecycle["Lifecycle State Machine"]
    EventBus["Event Bus"]
    ModuleRegistry["Module Registry"]
    ConfigStore["Config Store"]
    HealthAggregator["Health Aggregator"]
    ShutdownCoord["Shutdown Coordinator"]
    ProcessHost["Process Host<br/>(signals, exit)"]
    ServiceExposer["Service Exposer<br/>(Netron binding)"]
  end

  subgraph DI["Nexus DI Container"]
    Providers[Providers]
    Scopes[Scopes]
    Middleware[DI Middleware]
  end

  subgraph Netron["Netron RPC"]
    Services[@Service classes]
    Transports[Transports]
    NetMiddleware[RPC Middleware]
  end

  Client --> Transports
  Bootstrap --> ModuleRegistry --> DI
  Lifecycle --> ModuleRegistry
  ServiceExposer --> Netron
  DI --> Services
  Transports --> NetMiddleware --> Services
```

Each block in the diagram is a real type with a documented public
interface. None of them know about each other except through the
contracts declared in `src/types/`.

## Subsystem responsibilities

### Bootstrap (`Application.create`, `.start`, `.stop`)

The bootstrap layer is the single entry point. It does three things and
nothing else:

1. Builds the **Container** (see DI below).
2. Resolves and instantiates the **Module Registry** (see Modules below).
3. Hands control to the **Lifecycle** state machine.

After bootstrap completes, the `Application` object is a façade — it
holds references to the other subsystems and exposes their capabilities
through a small public surface (`use`, `resolve`, `on`, `emit`,
`config`).

→ Reference: [Application Bootstrap](../application/bootstrap.md)

### Lifecycle state machine

Drives transitions between states (`created → starting → started →
stopping → stopped`) and fires hooks in **dependency order** at each
transition. Owns timeouts, parallelism rules, and the hard-exit
guarantee.

States:

| State          | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `created`      | Container built, no hooks fired yet                      |
| `initializing` | `onInit` hooks running                                   |
| `initialized`  | All `onInit` complete; ready to start                    |
| `starting`     | `onStart` hooks running                                  |
| `running`      | `onStart` complete; service surfaces are live            |
| `stopping`     | `onStop` hooks running (reverse dependency order)        |
| `stopped`      | `onStop` complete                                        |
| `shuttingDown` | `onShutdown` hooks running; phased timeouts active       |
| `error`        | A hook failed; the application is in a poisoned state    |

→ Reference: [Lifecycle](../application/lifecycle.md), [Shutdown](../application/shutdown.md)

### Event Bus

Broadcasts framework events (`module:registered`, `config:changed`,
`lifecycle:phase`, `health:changed`, etc.) to subscribers registered via
`app.on(event, handler)`. Strictly typed event names; payload type
inferred from the event.

→ Reference: [Application Events](../application/events.md)

### Module Registry

Knows about every module loaded into the application. Computes the
dependency graph between modules. Detects circular imports. Drives
ordered initialisation.

A module is a static or dynamic descriptor:

```typescript
@Module({
  imports:   [LoggerModule, ConfigModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],
})
export class UsersModule {}
```

→ Reference: [Modules](../modules-system/defining-modules.md), [Dynamic Modules](../modules-system/dynamic-modules.md)

### Config Store

A typed, layered, hot-reloadable configuration source. Multiple sources
are merged with deep-merge semantics; the last source wins per key.
Validators are applied per source or globally.

→ Reference: [Configuration](../configuration/overview.md)

### Health Aggregator

Aggregates health probes from registered indicators (database, redis,
disk space, custom). Surfaces a single `IHealthStatus` (`healthy |
degraded | unhealthy`) plus per-indicator detail. Used by `/healthz`,
load balancers, and the Omnitron orchestrator.

→ Reference: [Health](../application/health.md)

### Shutdown Coordinator

Phased graceful shutdown. Tasks declare a phase (`PreShutdown |
Cleanup | Flush | Final`), a priority, a timeout, and a critical flag.
The coordinator runs each phase to completion (or timeout), then
proceeds to the next. Hard exit after the last phase.

→ Reference: [Shutdown](../application/shutdown.md)

### Process Host

Binds OS signals (`SIGTERM`, `SIGINT`, `SIGHUP`), sets up uncaught
exception / unhandled rejection handlers, and exposes runtime metrics
(`uptime`, `memoryUsage`, `cpuUsage`, `pid`). Disable with
`disableGracefulShutdown: true` if you embed Titan in a larger process.

### Service Exposer

The bridge between the DI container and Netron. When a `@Service`-marked
provider is resolved, the Service Exposer registers it with the running
Netron `LocalPeer` so its `@Public` methods become callable over the
wire.

→ Reference: [Netron Services](../netron/services.md)

## The two RPC layers

Netron has two layers of middleware that are easy to confuse:

- **DI middleware** — wraps **container resolution**. Runs at
  construction time. Used for cross-cutting object-graph concerns
  (logging instantiation, retry on construction failure, caching
  resolved instances).
- **RPC middleware** — wraps **Netron calls**. Runs per-call. Used
  for cross-cutting wire concerns (auth, rate limiting, tracing,
  serialisation tweaks).

They are independent. A typical app uses neither, one, or both
depending on what it needs.

→ Reference: [DI Middleware](../di/middleware.md), [RPC Middleware](../netron/middleware.md)

## What lives where

| Concern                             | Subpath                                   |
| ----------------------------------- | ----------------------------------------- |
| Application + lifecycle             | `@omnitron-dev/titan/application`         |
| Lifecycle interfaces                | `@omnitron-dev/titan/lifecycle`           |
| DI container (Nexus)                | `@omnitron-dev/titan/nexus`               |
| Decorators                          | `@omnitron-dev/titan/decorators`          |
| Validation                          | `@omnitron-dev/titan/validation`          |
| Errors                              | `@omnitron-dev/titan/errors`              |
| Netron RPC                          | `@omnitron-dev/titan/netron`              |
| Transports (subpaths under netron)  | `…/netron/transport/{http,websocket,tcp,unix}` |
| Auth (subpath under netron)         | `…/netron/auth`                           |
| Multi-backend                       | `…/netron/multi-backend`                  |
| Config module                       | `@omnitron-dev/titan/module/config`       |
| Logger module                       | `@omnitron-dev/titan/module/logger`       |
| Tracing                             | `@omnitron-dev/titan/tracing`             |
| Resilience helpers                  | `@omnitron-dev/titan/utils`               |

These subpaths are stable. Importing from `@omnitron-dev/titan` (no
subpath) re-exports the most common surfaces; subpath imports keep
your bundle tighter.

## Boundaries between subsystems

The boundaries are not just architectural diagrams — they are concrete
rules the framework enforces:

- **The Application kernel never owns business state.** It owns
  metadata about modules, providers, and lifecycle. Business state
  lives in your services, owned by the container.
- **The container never knows about Netron.** Services that happen to
  be `@Service`-marked are also registered with Netron, but the
  container treats them as ordinary providers.
- **Netron never knows about your business logic.** It dispatches
  to methods. The methods are written in plain TypeScript; they are
  not aware they are being called over the wire.
- **Modules never directly call each other.** Modules import and
  export *providers*. Providers are what gets injected. A module
  instance is a passive descriptor, not an addressable object.

These boundaries are why Titan tests cleanly: you can replace any
subsystem in isolation. You can mock the container. You can boot
without Netron. You can bind a fake transport for end-to-end tests
without sockets.

→ Next: [Mental Model](./mental-model.md) — how to think about a
running Titan app.
