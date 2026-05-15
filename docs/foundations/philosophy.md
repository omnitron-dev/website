---
sidebar_position: 1
title: Philosophy
---

# Philosophy

Omnitron exists to remove the seams between layers of a typical TypeScript
stack. Every design choice falls out of three commitments.

## 1. The contract is a TypeScript type

Most stacks treat the wire as a separate world: OpenAPI, protobuf, GraphQL
schema, RPC IDL — each one a translation layer with its own toolchain,
codegen step, and drift problem.

Omnitron treats the **service interface itself** as the contract. The class
that runs on the backend and the type that the client resolves are the
same TypeScript declaration. There is no codegen between them. A method
signature change is a build error on every caller in the same `tsc` pass.

## 2. Pay only for what you use

The base framework does not import an opinionated runtime. You add modules
when you need them:

- Need configuration? Add `ConfigModule`.
- Need logging? Add `LoggerModule`.
- Need scheduled jobs? Add `SchedulerModule`.

A Titan app with a single service and no opt-in modules has no hidden
allocator, no ambient tracing, no global thread-locals. It is the code
you wrote plus the container's wire-up.

This applies upward too. Need a frontend? Add Prism. Don't need one? The
server doesn't bundle React. Need to operate a fleet? Add the Omnitron
CLI. Don't? Your service runs as a normal Node.js process.

## 3. The same primitives operate the system

The Omnitron CLI talks to a running Titan app over the same Netron
protocol your browser uses. The web console aggregates dashboards over
the same metrics your services emit to. There is no separate "operator
API" that drifts from the runtime API.

This means:

- A `omnitron logs` command tailing a remote service is using the
  service's own log module, not a sidecar agent.
- A `omnitron status` query against a running app calls the same health
  module the load balancer probes.
- The web console and the CLI share the same client library; if one
  works, the other does too.

## What follows from this

- **No ambient state.** All dependencies are explicit; the container
  resolves them. There are no thread-locals, no `this` magic, no
  `process.env` reads inside business logic.
- **Decorators describe intent, not behaviour.** `@Service`, `@Public`,
  `@Inject`, `@Validate` — each one is a contract the framework
  enforces, not a runtime hook that injects code.
- **Lifecycle is observable.** Modules report `onInit`, `onStart`,
  `onStop`, `onShutdown`. The container fires them in dependency
  order. Failures surface as typed errors, not stack traces from
  half-initialised state.
- **Errors are values.** Service methods return `Result`-style errors
  the client gets typed; thrown exceptions are reserved for bugs the
  framework should catch.

## What this is not

- **Not a magic auto-wire.** The container is explicit. You declare
  providers in `@Module({...})`; nothing is auto-discovered from the
  filesystem.
- **Not a "do everything" runtime.** Modules are independently
  versioned packages. You can run a Titan app with one of them.
- **Not a replacement for Node.js.** Titan runs on Node.js (and is
  tested on Bun and Deno). The platform is the platform.

Read on: [Architecture](./architecture.md) — how the layers compose at
runtime.
