---
sidebar_position: 1
title: Design Principles
description: The seven engineering decisions that shape every API in Titan.
---

# Design Principles

Every framework has a few load-bearing decisions. Titan has seven. They
are not negotiable inside the framework — they are how the framework was
designed, why the APIs look the way they do, and what changes when you
build on top of it.

## 1. Explicitness over magic

Every dependency is declared. Every provider is registered. No
filesystem auto-discovery. No annotation scanning at startup. No
"convention over configuration" that surprises you a year later when
you grep the codebase and cannot find why a class is being instantiated.

```typescript
// Yes — explicit. The container knows about UsersService because
// AppModule said so.
@Module({ providers: [UsersService] })
export class AppModule {}

// No — implicit. Titan does not scan ./services/*.ts at boot.
```

The cost: a little more typing. The benefit: a Titan codebase is
**searchable**. Every wiring decision is a literal string in a literal
file. New team members can answer "where does this come from?" with
`grep`, not by reading the framework source.

> **Why this matters.** The most expensive bugs in mature codebases are
> ambient-state bugs — a function reads a global, the global was set
> three layers up by an init hook nobody remembers writing, the test
> doesn't trigger that hook, and the test passes. Titan's container
> makes ambient state structurally impossible: if a service needs
> something, it appears in its constructor.

## 2. Pay only for what you use

The base framework imports nothing it does not need. The 14 ecosystem
modules are independently versioned npm packages; you install the ones
you use. A Titan app with one service and no opt-in modules has no
hidden allocator, no ambient tracing, no global instrumentation.

```typescript
// A complete Titan service — no modules, no logging, no metrics.
// This works. It will not pull in pino, redis, or any other dependency.
@Service('echo@1.0.0')
export class EchoService {
  @Public()
  async ping(msg: string) { return msg; }
}

@Module({ providers: [EchoService] })
export class AppModule {}

await (await Application.create(AppModule)).start();
```

The cost: you assemble what you want. The benefit: small services stay
small. Large services do not pay the small-service tax of carrying
features they don't use.

## 3. The same primitives operate the system

There is no separate "operator API" that drifts from the runtime API.
The Omnitron CLI talks to a running Titan app over the same Netron
protocol your browser uses. The web console reads the same metrics
your services emit. The orchestrator polls the same `/healthz` your
load balancer probes.

This means three things in practice:

- **You do not learn two languages.** The wire format your frontend
  speaks is the wire format your CLI speaks.
- **You do not maintain two surfaces.** Adding an operator action is
  adding a `@Public` method on the orchestrator service.
- **Your runtime is debuggable from any client.** A Titan service can
  be inspected, called, and audited from the same code paths your
  product uses.

## 4. The contract is a TypeScript type

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

## 5. Errors are values

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

## 6. Lifecycle is observable

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

## 7. The container is the single source of truth

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

## The shape these decisions produce

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

→ Next: [Architecture](./architecture.md) — how these principles
compose at runtime.
