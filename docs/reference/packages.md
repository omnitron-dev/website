---
sidebar_position: 1
title: Package Index
description: Every package shipped from the monorepo, grouped by role.
---

# Package Index

Public packages defined in `github.com/omnitron-dev/omni`,
grouped by role and clearly labelled (server/client, required/
optional, framework-bound vs framework-agnostic). This index follows current
source; an installed registry release may expose fewer packages or entry points.
See [source-workspace installation](../auth/access-policy.md)
and [composition boundaries](../foundations/composition.md) when integrating unreleased APIs.

## Server-side / Backend

### Core framework

| Package | What | Required? |
| ------- | ---- | :-------: |
| [`@omnitron-dev/titan`](../titan/overview.md) | Backend framework — DI, modules, lifecycle, **server-side Netron with all 4 transports (HTTP/WS/TCP/Unix) built in**, validation, errors | ✓ |

`@omnitron-dev/titan` is **self-sufficient**. Server-side
Netron — including every transport — ships inside it as subpath
exports (`@omnitron-dev/titan/netron`,
`@omnitron-dev/titan/netron/transport/{http,websocket,tcp,unix}`).
No extra package is needed for the server.

### Backend modules (opt-in)

Independently versioned. Add only what your app uses.

| Package | Purpose |
| ------- | ------- |
| [`@omnitron-dev/titan-auth`](../titan/modules/auth.mdx) | JWT authentication (HS256 / RS256 / ES256, JWKS, token cache) |
| [`@omnitron-dev/titan-cache`](../titan/modules/cache.mdx) | Multi-tier caching (L1 LRU/LFU + L2 Redis) |
| [`@omnitron-dev/titan-database`](../titan/modules/database.mdx) | Kysely + migrations + RLS plugin |
| [`@omnitron-dev/titan-discovery`](../titan/modules/discovery.mdx) | Redis-backed service discovery + heartbeats |
| [`@omnitron-dev/titan-events`](../titan/modules/events.mdx) | In-process event bus with history |
| [`@omnitron-dev/titan-health`](../titan/modules/health.mdx) | Health + readiness probes (k8s-shaped) |
| [`@omnitron-dev/titan-lock`](../titan/modules/lock.mdx) | Distributed Redis locks (Lua scripts, UUID ownership) |
| [`@omnitron-dev/titan-metrics`](../titan/modules/metrics.mdx) | Counters / gauges / histograms; Prom exposition |
| [`@omnitron-dev/titan-notifications`](../titan/modules/notifications.mdx) | Multi-channel delivery + DLQ + rotif messaging |
| [`@omnitron-dev/titan-pm`](../titan/modules/pm.mdx) | Process manager / worker pools / autoscaling |
| [`@omnitron-dev/titan-ratelimit`](../titan/modules/ratelimit.mdx) | Token-bucket / sliding-window / fixed-window |
| [`@omnitron-dev/titan-redis`](../titan/modules/redis.mdx) | Redis client (clusters, sentinel, named instances) |
| [`@omnitron-dev/titan-storage`](../titan/modules/storage.md) | Local and S3 object adapters |
| [`@omnitron-dev/titan-scheduler`](../titan/modules/scheduler.mdx) | Cron / interval / timeout with persistence |
| [`@omnitron-dev/titan-telemetry-relay`](../titan/modules/telemetry-relay.mdx) | Store-and-forward telemetry (WAL-backed) |

## Browser-side / Frontend

| Package | Framework | Required when |
| ------- | --------- | ------------- |
| [`@omnitron-dev/netron-browser`](../frontend/netron/browser.md) | **Framework-agnostic** — vanilla JS, Vue, Svelte, Solid, Angular, Lit, React, Web Workers | You build a browser client that calls a Titan backend |
| [`@omnitron-dev/netron-react`](../frontend/netron/react.md) | **React-only** — optional layer on top of netron-browser | Your frontend uses React |
| [`@omnitron-dev/prism`](../frontend/prism/index.md) | **React-only** — MUI v9 design system | Your frontend uses React and you want pre-built components |

**Use matrix:**

| Frontend stack | Install |
| -------------- | ------- |
| Vanilla JS / TypeScript | `netron-browser` only |
| Vue 3 | `netron-browser` only (wrap in `reactive`/`ref`) |
| Svelte | `netron-browser` only (wrap in stores) |
| Solid | `netron-browser` only (wrap in signals) |
| Angular | `netron-browser` only (wrap in services / RxJS) |
| Lit | `netron-browser` only |
| React 19 (Prism) | `netron-browser` + `netron-react` (+ optional `prism`) |
| Web Worker | `netron-browser` only |

## Supervisor (opt-in)

| Package | What |
| ------- | ---- |
| [`@omnitron-dev/omnitron`](../omnitron/overview.md) | Application supervisor + CLI + web console + MCP server. Optional. See [Titan vs Omnitron](../foundations/titan-vs-omnitron.md). |

## Shared utilities (framework-agnostic)

Focused packages. Used internally by everything
above; reusable in non-Omnitron projects.

| Package | Purpose |
| ------- | ------- |
| [`@omnitron-dev/access`](../auth/access-policy.md) | Dependency-free roles, permission catalogs and compiled checks |
| [`@omnitron-dev/common`](../utilities/common.md) | Type predicates, promise helpers, object tools, data structures |
| [`@omnitron-dev/cuid`](../utilities/cuid.md) | Collision-resistant URL-safe unique IDs |
| [`@omnitron-dev/eventemitter`](../utilities/eventemitter.md) | Async event emitter with parallel/serial/reduce |
| [`@omnitron-dev/msgpack`](../utilities/msgpack.md) | Extensible MessagePack with native JS types (Date, Map, Set, BigInt, Error) |
| [`@omnitron-dev/kb`](../utilities/kb.md) | Knowledge-base framework (backs `omnitron kb mcp`) |
| [`@omnitron-dev/testing`](../testing/testing-package.md) | Cross-runtime testing utilities (Node + Bun + Deno) |

### Shared internals

Two more packages exist and are published, but you install
neither: `titan` and `netron-browser` both depend on them, and
that is the point — each is a single definition that used to be a
pair of copies drifting apart on either side of the wire.

| Package | Purpose |
| ------- | ------- |
| [`@omnitron-dev/netron-protocol`](./protocol.md) | Wire packets, service definitions, identifiers and the shared error hierarchy. Dependency-free |
| [`@omnitron-dev/netron-http-core`](./protocol.md) | Environment-neutral HTTP primitives — cache manager, retry manager, query builder, configurable request proxy |

Their versions move with the packages that consume them; pin
those, not these.

See [Protocol and HTTP primitives](./protocol.md) for these packages and
[API index](./api-index.mdx) for all declared entry points.

## License

MIT across every package.

## Install matrices

### Backend service only

```bash
pnpm add @omnitron-dev/titan
# + any titan-* modules you need
```

### Backend + browser client (any framework)

```bash
# Backend (server Netron + 4 transports already inside):
pnpm add @omnitron-dev/titan

# Browser (works with any framework):
pnpm add @omnitron-dev/netron-browser
```

### Backend + React frontend

```bash
# Backend:
pnpm add @omnitron-dev/titan

# React frontend:
pnpm add @omnitron-dev/netron-browser @omnitron-dev/netron-react @omnitron-dev/prism
```

### Full Omnitron-supervised platform

```bash
pnpm add @omnitron-dev/titan
pnpm add @omnitron-dev/netron-browser @omnitron-dev/netron-react
pnpm add -g @omnitron-dev/omnitron
```

## See also

- [Installation](../getting-started/installation.md) — detailed install paths + subpath imports
- [Titan vs Omnitron](../foundations/titan-vs-omnitron.md) — what runs without Omnitron
- [Architecture](../foundations/architecture.md) — how the layers compose
- [Comparison](../comparison.md) — vs alternative stacks
