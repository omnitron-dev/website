---
sidebar_position: 1
title: Introduction
description: What Omnitron is, what ships with it, and where to go for what you need.
---

# Introduction

**Omnitron** is a unified TypeScript stack for building, shipping, and operating
real systems. One toolchain across every layer — from a decorator on a service
class to a supervised pod cluster — with no codegen step in between.

## The stack

| Layer | Package(s) | What it gives you |
| ----- | ---------- | ----------------- |
| **Backend framework** | `@omnitron-dev/titan` | Decorator-driven DI (Nexus container), lifecycle hooks, modules, validation (zod), structured logging (pino), typed errors that travel the wire |
| **RPC plane** | `titan/netron` + `@omnitron-dev/netron-browser` | Same `@Service` reachable over HTTP / WebSocket / TCP / Unix sockets. Middleware pipeline (auth, retry, cache, rate-limit, tracing). AsyncIterable streaming |
| **Frontend hooks** | `@omnitron-dev/netron-react` | Typed `useQuery` / `useMutation` / `useSubscription` / `useService` driven by the backend interface itself — no schema sync |
| **Design system** | `@omnitron-dev/prism` | 50+ MUI v7 components, 3 layouts, 3 blocks, schema-aware forms, 25+ React hooks, dark mode without flicker |
| **Supervisor** | `@omnitron-dev/omnitron` | Long-running daemon, 20+ RPC services, 75+ CLI subcommands, React+Vite web console, declarative infrastructure provisioning, MCP server for agents |

Add a row to your stack incrementally — Titan alone for a backend, `+ netron-browser`
for a JS client, `+ netron-react` + Prism for React, `+ omnitron` when you scale to
many services / nodes. Each layer is the next import, never the next framework.

## Three claims, no caveats

### 1. One stack, end-to-end TypeScript

The service signature on the server **is** the React hook contract. Refactor a
method, the build fails on every caller — server, client, console, CLI, mobile.

```typescript
// Server:
@Service('users@1.0.0')
class UsersService {
  @Public() async findById(id: string): Promise<User> { /* ... */ }
}

// Browser:
const users = useService<UsersService>('users');
const { data } = users.findById.useQuery(['u_42']);
//      ^? User | undefined   ← traced through, no codegen
```

No OpenAPI, no protobuf, no `.d.ts` sync. The TypeScript compiler is the only
source of truth.

### 2. Pay only for what you use

Each Titan module is opt-in. Each Netron transport is opt-in. Each Prism
subpath is tree-shaken. The base framework does not ship a runtime that you
cannot remove.

| Want minimal | Want batteries |
| ------------ | -------------- |
| One `@Module({ providers: [...] })` over plain classes | All 16+ modules: auth, cache, db, discovery, events, health, lock, metrics, notifications, pm, ratelimit, redis, scheduler, telemetry-relay + config + logger |
| HTTP-only Netron client (~12 kB gz) | Full client with cache + retry + circuit-breaker + auth manager (~25 kB gz) |
| Per-component Prism import | Root `import * from '@omnitron-dev/prism'` |
| One Titan app, `node dist/index.js` | Omnitron daemon supervising N apps × M projects × K stacks across a fleet |

### 3. Operate from the same primitives you developed with

The Omnitron CLI talks to running Titan apps over the same Netron protocol
the frontend uses. The web console aggregates dashboards over the same
metrics module your services emit to. AI agents call the same RPC surface
via MCP. There is no separate "ops API".

## The hello-world flow

```typescript
// 1. Declare a service. Decorator = contract.
@Service('users@1.0.0')
export class UsersService {
  @Public()
  async findById(id: string): Promise<User> { return this.repo.findById(id); }
}

// 2. Compose modules. Container handles DI + lifecycle + RPC exposure.
@Module({ imports: [DatabaseModule], providers: [UserRepo, UsersService] })
export class AppModule {}

// 3. Boot.
const app = await Application.create(AppModule);
await app.start();

// 4. Call from React.
function UserCard({ id }: { id: string }) {
  const users = useService<UsersService>('users');
  const { data } = users.findById.useQuery([id]);
  return data ? <h3>{data.email}</h3> : <Skeleton />;
}
```

That's the entire wire format. The rest is opt-in.

## Where to go next

### If you want to build something now

- **[Installation](./getting-started/installation.md)** — install the packages, get your tooling in place.
- **[Quickstart](./getting-started/quickstart.md)** — service → module → app → React, in five minutes.
- **[Project structure](./getting-started/project-structure.md)** — the canonical monorepo layout.

### If you want to understand the design

- **[Philosophy](./foundations/philosophy.md)** — why decorator DI, why one type system end-to-end.
- **[Architecture](./foundations/architecture.md)** — every layer and how they compose.
- **[Monorepo](./foundations/monorepo.md)** — how the workspace is organised.

### Reference by layer

| Layer | Start here |
| ----- | ---------- |
| Backend | [Titan overview](./titan/overview.md) → [Application & DI](./titan/application) → [Modules](./titan/modules) |
| RPC | [Netron](./titan/netron) — server side; [netron-browser](./frontend/netron/browser.md) + [netron-react](./frontend/netron/react.md) — client side |
| Frontend | [Prism overview](./frontend/prism) → [Components catalog](./frontend/prism/components.md) → [Layouts + Blocks](./frontend/prism/blocks.md) |
| Modules | [Module map](./titan/modules/module-map.mdx) — visual dependency graph of all 16+ modules |
| Operate | [Omnitron overview](./omnitron/overview.md) → [CLI reference](./omnitron/cli.md) → [Recipes](./omnitron/recipes.md) |

### Reference by task

| Goal | Page |
| ---- | ---- |
| Add JWT auth to my app | [`titan-auth`](./titan/modules/auth.mdx) + [Auth & RBAC](./omnitron/auth-rbac.md) |
| Persist data | [`titan-database`](./titan/modules/database.mdx) |
| Multi-process app with worker pools | [`titan-pm`](./titan/modules/pm.mdx) + [Orchestrator](./omnitron/orchestrator.md) |
| Cache reads | [`titan-cache`](./titan/modules/cache.mdx) |
| Cron / scheduled jobs | [`titan-scheduler`](./titan/modules/scheduler.mdx) |
| Distributed locks | [`titan-lock`](./titan/modules/lock.mdx) |
| Send email / push / SMS | [`titan-notifications`](./titan/modules/notifications.mdx) |
| Real-time updates to the browser | [Subscriptions over WebSocket](./frontend/netron/transports.md) |
| Migrate from NestJS / Express / prom-client | [Migration guides](./titan/migrations) |
| Build a React admin console | [Prism + netron-react](./frontend/netron/index.md) |
| Set up an AI agent for the codebase | [MCP integration](./omnitron/mcp.md) |
| Multi-node cluster + leader election | [Cluster + Fleet](./omnitron/cluster.md) |

### Reference by capability

8 cross-cutting reference pages cover every module from a single angle:

| Lookup | Page |
| ------ | ---- |
| Which module does X? | [Module map](./titan/modules/module-map.mdx) |
| How do I configure module X? | [Options patterns](./titan/modules/options-patterns.mdx) |
| What runs when in module X? | [Lifecycle reference](./titan/modules/lifecycle-reference.mdx) |
| What DI tokens does X export? | [Tokens reference](./titan/modules/tokens-reference.mdx) |
| What does X log / emit / measure? | [Observability matrix](./titan/modules/observability-matrix.mdx) |
| Is module X production-safe? | [Security checklist](./titan/modules/security-checklist.mdx) |
| What does X throw and how do I handle it? | [Errors catalog](./titan/modules/errors-catalog.mdx) |
| What `@Decorator` does X export? | [Decorators catalog](./titan/modules/decorators-catalog.mdx) |

## Compatibility

| Component | Requirement |
| --------- | ----------- |
| **Node.js** | 22.x or 23.x (CI runs both) |
| **TypeScript** | 5.x; strict mode recommended |
| **Bun / Deno** | App-level support (test matrix covers Node + Bun + Deno); Omnitron daemon expects Node |
| **OS** | macOS, Linux. Windows: CLI + apps OK; Omnitron daemon assumes Unix sockets |
| **React** | 18 or 19 |
| **Docker** | Required for `omnitron infra` provisioning |
| **PostgreSQL / Redis / MinIO** | Auto-provisioned by Omnitron in dev; bare-metal or managed in prod |

## License

MIT across every package.

## Read the philosophy

If you want to know **why** the stack looks like this — why decorator DI,
why transport-agnostic RPC, why one type system end-to-end — start with
[Philosophy](./foundations/philosophy.md). Every other design decision
follows from those choices.

---

Built on TypeScript. End-to-end. No bridges. No drift.
