---
id: "titan/concepts/design-principles"
slug: "/docs/titan/concepts/design-principles"
sidebar_position: 1
title: Design Principles
description: The seven engineering decisions that shape every API in Titan.
---

# Design Principles

Every framework has a few load-bearing decisions. Titan has seven. They
are not negotiable inside the framework — they are how the framework was
designed, why the APIs look the way they do, and what changes when you
build on top of it.

## 1. Explicitness over magic {#1-explicitness-over-magic}

Register application providers and imports explicitly:

```typescript
import { Module } from '@omnitron-dev/titan';

@Module({ providers: [UsersService] })
export class AppModule {}
```

Some APIs also use discovery and conventions: scheduler/event decorators scan
registered providers, module discovery can load configured paths, and certain
method decorators read conventional instance fields or an ambient fallback.
Inspect each decorator's wiring contract rather than assuming constructor
injection is the only source of a dependency.

## 2. Pay only for what you use {#2-pay-only-for-what-you-use}

Titan modules are separate workspace packages, but Titan core already depends on
Pino, Zod, WebSocket support and other runtime libraries. Config and Logger are
loaded by default unless core modules are disabled. An unused integration may
avoid initialization without removing its package from the installation graph.

Use the [module dependency inventory](../modules/module-map.mdx#install-footprint)
and package manifests to understand installation cost. Package separation alone
does not establish a smaller runtime footprint or independent version compatibility.

## 3. The same primitives operate the system {#3-the-same-primitives-operate-the-system}

Omnitron builds on Titan's lifecycle, DI and Netron RPC. The CLI and Console use
published daemon services. Standalone Titan services still need their own wiring,
authentication and instrumentation; they do not acquire the daemon's HTTP metrics
server or orchestrator bridges by importing a module.

Health RPC and HTTP probes are different entry points. Trace the actual route
or service method used by an operator before attributing its behavior to a module.

## 4. The contract is a TypeScript type {#4-the-contract-is-a-typescript-type}

The wire contract between the server and any caller — browser, mobile,
service-to-service, CLI — is the **TypeScript service interface
itself**. There is no codegen step. No OpenAPI spec to keep in sync.
No protobuf compilation.

```typescript
// Server — the contract is the class.
@Service('users@1.0.0')
export class UsersService {
  @Public()
  async findById(id: string): Promise<User | null> { … }
}

// Client — the same type, imported from a shared package.
const users = await client.queryInterface<UsersService>('users@1.0.0');
const user  = await users.findById('u_42');
//    ^? User | null   — the *server's* return type
```

A signature change on the server fails the build on every caller in
the same `tsc` invocation. Drift is a compile error, not a 3 AM
production page.

## 5. Errors are values {#5-errors-are-values}

Service methods that can fail throw typed errors (`TitanError` and
its subclasses), each carrying an HTTP-style status, a structured
`details` payload, and a stable `code`. The client receives the same
typed error with the same payload.

```typescript
// Server — typed failure.
import { Errors, ErrorCode, TitanError } from '@omnitron-dev/titan/errors';

@Public()
async findById(id: string): Promise<User> {
  const user = await this.repo.findById(id);
  if (!user) throw Errors.notFound('user', id);
  return user;
}

// Client — discriminate by code (or by class for AuthError /
// PermissionError / RateLimitError subclasses).
try {
  await users.findById('missing');
} catch (e) {
  if (e instanceof TitanError && e.code === ErrorCode.NOT_FOUND) {
    /* handle */
  }
}
```

Native `Error` instances bubbling out of your code are wrapped with
`ErrorCode.INTERNAL_ERROR` (status 500) and logged on the server
with the original stack. The client never sees an opaque 500 with no
structure.

## 6. Lifecycle is observable {#6-lifecycle-is-observable}

Every service can declare `onInit`, `onStart`, `onStop`, `onDestroy`.
The container fires them in **dependency order** — services with more
deps initialise after their dependencies, shut down before them. A
failure in any phase aborts the corresponding transition with a typed
error. There is no "half-initialised" state where some services are
ready and some are not.

```typescript
@Service('users@1.0.0')
export class UsersService implements OnInit, OnStop {
  async onInit() { await this.cache.warm(); }
  async onStop() { await this.queue.flush(); }
}
```

Shutdown runs lifecycle hooks in reverse order with a global
`gracefulShutdownTimeout` watchdog. A hard exit guarantees no zombie
processes.

## 7. The container is the single source of truth {#7-the-container-is-the-single-source-of-truth}

Every Titan-managed object is owned by the Nexus container. The
container resolves dependencies, manages scopes, applies middleware,
fires lifecycle hooks. Three corollaries:

- **No globals.** A "global service" is a singleton-scoped provider
  in the container.
- **No instance-leaking.** Tests instantiate a fresh container per
  test; nothing carries between them.
- **One place to look.** When you ask "what does this app contain?",
  the answer is "everything the container holds, in the topology
  declared by the modules."

## The shape these decisions produce {#the-shape-these-decisions-produce}

A Titan app, viewed from outside, is:

- A single `Application` object that owns everything.
- A tree of modules with declared imports / exports / providers.
- A set of services exposed over Netron.
- A set of optional ecosystem modules (config, logger, db, cache, etc.).
- Zero ambient state.

A Titan app, viewed from inside a service method, is:

- `this` is the service instance, constructor-injected with its deps.
- Method parameters are validated against the schema you declared.
- The trace context is attached to the current async scope.
- The logger reachable via `this.logger` is bound to the service name.
- Errors thrown become typed responses on the wire.

That is the whole framework. Read on for the mechanics.
