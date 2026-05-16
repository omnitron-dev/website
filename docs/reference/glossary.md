---
sidebar_position: 2
title: Glossary
description: Every term used across the stack, with cross-references.
---

# Glossary

Terms used across the stack. Cross-referenced; click through to
the deeper page.

## A

**Application** — The root Titan object created by
`Application.create(module, options)`. Owns the DI container,
the Netron transports, and lifecycle hooks.
→ [Application](../titan/application)

**`@Auth(opts)`** — Method decorator from `titan-auth` that
gates an RPC call by role. `@Auth({roles: ['admin']})`.
→ [Auth decorators](../titan/modules/auth.mdx#decorators)

**`AuthManager`** — Browser-side auth state manager: stores
tokens, auto-refreshes, syncs across tabs.
→ [netron-browser auth](../frontend/netron/auth.md)

**Autoscaler** — `titan-pm`'s built-in worker-pool scaler.
Adjusts `instances` based on CPU / queue depth / memory.
→ [titan-pm](../titan/modules/pm.mdx)

## B

**Backoff** — Exponential delay between retry attempts.
`computeBackoff()` is the shared primitive.

**`BackendPool`** — Multi-backend RPC client; routes calls to
different Netron servers by service-name pattern.
→ [Multi-backend](../frontend/netron/multi-backend.md)

**Block** — High-level Prism composite — `<AuthBlock>`,
`<DashboardBlock>`, `<DataGridBlock>`.
→ [Prism blocks](../frontend/prism/blocks.md)

**Bootstrap** — The per-app entry that exports
`defineSystem({...})`. The orchestrator imports it to learn
about an app's process topology.
→ [Configuration](../omnitron/configuration.md)

## C

**Cache key** — `[service, method, args]` for `useQuery`.
Args are deep-equal compared.

**`@Cacheable`** — Memoise a method's return value in `titan-cache`.

**`cuid`** — Collision-resistant URL-safe ID generator.
→ [cuid](../utilities/cuid.md)

**Circuit breaker** — Trips after N consecutive failures;
fails-fast for the cooldown period. Half-opens with one probe.
→ [Middleware / CircuitBreaker](../frontend/netron/middleware.md#circuitbreakermiddleware)

**Classic mode** — Per-app launch mode where one fork runs the
full bootstrap end-to-end. Compare with **module-worker mode**.

**Cluster** — Set of Omnitron daemons with leader election +
state replication. Different from **fleet** (no election).
→ [Cluster + Fleet](../omnitron/cluster.md)

**`cnf.fp`** — JWT claim binding a short-lived access token to
a long-lived refresh token id via HMAC. Invalidates the access
token immediately when the refresh chain rotates.

**Codegen** — Translation step between server and client (e.g.,
OpenAPI → TS, protobuf → TS). This stack uses **zero** codegen.

**Container** — The DI registry; resolves and caches providers.
Built on the Nexus primitive.

**Container identity check** — Boot-time guard ensuring the
`Container` class imported by an app's modules is physically
the same class as the daemon's. Different versions cause
explicit error rather than mystery failure.

**Contextual injection** — Same DI token, different providers
selected per request context (multi-tenant, multi-environment).

**Contract** — The TypeScript service interface. The contract
between server and client.

## D

**Daemon** — The long-running Omnitron supervisor process.
Always-on; everything else (CLI, webapp) is transient.
→ [Daemon](../omnitron/daemon.md)

**Decorator** — TypeScript metadata syntax. `@Service`,
`@Public`, `@Inject`, etc. Drives the DI + Netron grammar.
→ [Decorators catalog](../titan/modules/decorators-catalog.mdx)

**`defineEcosystem(config)`** — Function in `omnitron.config.ts`
that declares the ecosystem (apps, stacks, infrastructure,
supervision).

**`defineSystem(definition)`** — Function in per-app `bootstrap.ts`
that declares the process topology (`IProcessEntry[]`).

**DI** — Dependency injection. The container resolves dependencies
declared via constructor or `@Inject(token)`.

**Discovery** — Service-discovery primitive (`titan-discovery`).
Redis-backed registry with heartbeats; multi-pod-aware.

**DLQ** — Dead-letter queue. Failed notifications land here for
manual inspection.

**DTO** — Data Transfer Object. A typed shape returned by an
RPC method.

## E

**Ecosystem** — Top-level project configuration (`omnitron.config.ts`).
Lists apps, stacks, supervision, infrastructure.

**Edge** — Runtimes designed for short-lived requests near users
(Cloudflare Workers, Deno Deploy). Not supported by Omnitron
daemon (Node-only).

**Event-bus** — Cross-service event distribution. `titan-events`
ships an in-process bus; `titan-notifications` adds cross-process
durable delivery.

## F

**Fan-out architecture** — Production shape: one identity app
+ N specialist apps sharing JWT + Redis session registry.

**`@Field`** — Prism's schema-aware form field. Reads zod
schema from `<SchemaProvider>` for type / required / constraints.

**Fleet** — Inventory of remote daemons addressed by alias.
Separate from **cluster** (which adds leader election).

**`forFeature(...)`** — Module factory adding additional
per-feature config (repos, indicators, named clients) after
`forRoot`.

**`forRoot(opts)`** / **`forRootAsync({useFactory, inject})`** —
Top-level module factory. Sync vs async configuration.

**`forWorker(...)`** — `titan-notifications`-specific factory for
the worker pod (vs producer pod).

## G

**Gateway** — OpenResty/Lua reverse proxy bundled with Omnitron.
Provisioned per stack; supports Lua maintenance mode.

**Glossary** — This page.

## H

**Health probe** — Live/Ready check returning the service's
status. Powered by `titan-health` indicators.

**Hook** — Lifecycle callback (`beforeStart`, `afterStart`,
`onHealthCheck`, etc.) declared on `IAppDefinition` /
`IProcessEntry`.

## I

**Infrastructure subsystem** — Omnitron's declarative
provisioner for Postgres / Redis / S3 / custom containers.
→ [Infrastructure](../omnitron/infrastructure.md)

**`@Inject(token)`** — DI decorator marking a parameter or
property for token-based resolution.

**`@Injectable()`** — Class decorator marking a class as
DI-instantiable.

**`IProcessEntry`** — Per-process spec in `defineSystem`.
Becomes exactly one fork (or N if `instances > 1`).

## J

**JWKS** — JSON Web Key Set. Public keys used to verify RS256
JWTs; rotated by URL.

**JWT** — JSON Web Token. The default auth credential.

## K

**Kb** — Knowledge-base framework powering `omnitron kb mcp`.
→ [kb](../utilities/kb.md)

**Kysera** — Kysely + plugins shipping in `titan-database` —
RLS, soft-delete, timestamps, audit.

## L

**L1 / L2 cache** — Two-tier cache: L1 in-process (LRU/LFU),
L2 in Redis (durable).

**Leader election** — Simplified Raft variant for cluster mode.
5–15 s election timeout, 2 s heartbeat.

**Lifecycle** — `onInit` → `onStart` → `onStop` → `onDestroy`,
fired in dependency order.

**Logger** — pino-based structured logger; built-in module.

**Lua maintenance flag** — Gateway-level toggle in Redis; flip
to return 503 with maintenance page without restart.

## M

**MCP** — Model Context Protocol. Standard for AI agents to
discover and call tools. Omnitron's MCP server exposes ~40 tools.
→ [MCP](../omnitron/mcp.md)

**MessagePack** — Binary serialisation format. Netron's default
wire format; preserves Date / Map / Set / BigInt / Error.
→ [msgpack](../utilities/msgpack.md)

**Middleware** — Pluggable per-call hook. Three stages:
pre-request / post-response / error.
→ [Middleware](../frontend/netron/middleware.md)

**Module** — A unit of composition. Class with `@Module({...})`.
Declares providers + imports + exports.

**Module-worker mode** — Per-app launch mode where each
`IProcessEntry` is a separate fork importing only that
process's module file. Compare with **classic mode**.

## N

**Nexus** — The custom DI container Titan uses. Class-token-
based; supports contextual injection.

**Netron** — Titan's RPC plane. Same `@Service` over four
transports. → [Netron](../titan/netron)

**Node** — Either a Node.js process OR a fleet node (machine).
Disambiguated by context.

**`NodeInfo`** — Discovery's per-node metadata: ID, address,
services, timestamp.

## O

**`OmnitronDaemon`** — The daemon's primary RPC service.
26 methods: start/stop/restart/scale/inspect/etc.

**Operator** — Human / agent driving the platform via CLI /
console / MCP. Also: middle RBAC role
(`viewer < operator < admin`).

**Orchestrator** — Subsystem inside the daemon that handles
per-app launch (bootstrap loader, ts-compiler, file-watcher,
dependency-resolver, …).
→ [Orchestrator](../omnitron/orchestrator.md)

## P

**P2C** — Power-of-two-choices load balancing. Pick 2 random
workers; dispatch to the less loaded. Near-optimal balance.

**PaaS** — Platform-as-a-Service. Fly.io / Railway / Render.

**`@PostConstruct`** / **`@PreDestroy`** — Lifecycle decorators
on methods.

**`@Process()`** — Marks a class as a `titan-pm` worker
process.

**`@Public()`** — Exposes a method on Netron (core);
auth-bypass marker (titan-auth); worker IPC marker (titan-pm).
Three decorators, different effects — distinguished by import.

**Pillar** — Top-level layer of the stack: Titan, Netron,
Prism, Omnitron.

**`<PrismProvider>`** — Root provider for Prism components;
sets up MUI theme, snackbar, etc.

## Q

**Query cache** — netron-react's React-aware cache built on
QueryCache. Powers `useQuery` / `useMutation`.

## R

**RBAC** — Role-Based Access Control. Three built-in roles:
viewer, operator, admin.

**Reconciler** — Infrastructure subsystem's loop: declared
services vs actual containers; create / recreate / restart /
remove.

**RLS** — Row-Level Security. Postgres feature; `titan-database`'s
Kysera plugin enforces tenant isolation at the SQL layer.

**Route** — In RPC: nothing (services own methods, not URLs).
In webapp: react-router-dom path.

## S

**Sandbox** — Per-context isolated DI scope. Used for
multi-tenant request handling.

**Schema-aware form** — Prism's `<SchemaProvider>` + `<Field>`
pattern. Schema drives input type, required, constraints.

**Service** — Class with `@Service('name@version')`. Exposes
`@Public()` methods over Netron.

**Service descriptor** — Runtime metadata about a service:
name, version, methods, schemas. Returned by
`getServiceDescriptor`.

**Session** — User auth session. ID stored in Redis under
`omni:session:{sid}`; instant revocation via deletion.

**Stack** — Named environment in a project (dev / staging /
prod). Each may have its own infra overrides.

**Stale-while-revalidate** — Cache strategy: serve stale data,
refresh in background.

## T

**TTL** — Time-to-live. Used for cache entries, session
records, discovery heartbeats.

**`titan-X`** — Independently versioned official module (e.g.,
`titan-auth`, `titan-cache`).

**Topology** — Per-process declaration of `expose` /
`access` controlling cross-process service mesh.

**Transport** — Wire format. Netron speaks four: HTTP, WS, TCP,
Unix.

**Tutorial** — The 6-step walkthrough.
→ [Tutorial](../tutorial)

## U

**Unix socket** — Local IPC mechanism. Omnitron daemon's
default management plane (`~/.omnitron/daemon.sock`).

**Uptime bar** — 90-day green/yellow/red visualisation per node
in the webapp.

## V

**`@Validate(schema)`** — Decorator running a zod schema before
the method body. Bad input throws `Errors.validation`.

**Viewer** — Lowest RBAC role. Read-only: list / inspect /
status / metrics / health / logs.

## W

**WAL** — Write-Ahead Log. Used by `titan-telemetry-relay` for
durable buffering.

**Worker pool** — Multi-instance process group with P2C load
balancing; managed by `titan-pm`.

## Z

**Zod** — Schema library. Used throughout for validation,
configuration, contract types. Re-exported from
`@omnitron-dev/titan/validation`.

**Zero codegen** — The signature property of the stack: no
generated code between server and client; TypeScript compiler
is the only source of truth.

## See also

- [Packages reference](./packages.md) — every npm package
- [Architecture](../foundations/architecture.md) — what fits where
- [Comparison](../comparison.md) — terms in context of alternatives
