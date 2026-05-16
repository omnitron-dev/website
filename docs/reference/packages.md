---
sidebar_position: 1
title: Package Index
description: Every package shipped from the monorepo, grouped by role.
---

# Package Index

Every package published from `github.com/omnitron-dev/omni`,
grouped by role and clearly labelled (server/client, required/
optional, framework-bound vs framework-agnostic).

## Server-side / Backend

### Core framework

| Package | What | Required? |
| ------- | ---- | :-------: |
| `@omnitron-dev/titan` | Backend framework — DI, modules, lifecycle, **server-side Netron with all 4 transports (HTTP/WS/TCP/Unix) built in**, validation, errors | ✓ |

`@omnitron-dev/titan` is **self-sufficient**. Server-side
Netron — including every transport — ships inside it as subpath
exports (`@omnitron-dev/titan/netron`,
`@omnitron-dev/titan/netron/transport/{http,websocket,tcp,unix}`).
No extra package is needed for the server.

### Backend modules (opt-in)

Independently versioned. Add only what your app uses.

| Package | Purpose |
| ------- | ------- |
| `@omnitron-dev/titan-auth` | JWT authentication (HS256 / RS256 / ES256, JWKS, token cache) |
| `@omnitron-dev/titan-cache` | Multi-tier caching (L1 LRU/LFU + L2 Redis) |
| `@omnitron-dev/titan-database` | Kysely + migrations + RLS plugin |
| `@omnitron-dev/titan-discovery` | Redis-backed service discovery + heartbeats |
| `@omnitron-dev/titan-events` | In-process event bus with history |
| `@omnitron-dev/titan-health` | Health + readiness probes (k8s-shaped) |
| `@omnitron-dev/titan-lock` | Distributed Redis locks (Lua scripts, UUID ownership) |
| `@omnitron-dev/titan-metrics` | Counters / gauges / histograms; Prom exposition |
| `@omnitron-dev/titan-notifications` | Multi-channel delivery + DLQ + rotif messaging |
| `@omnitron-dev/titan-pm` | Process manager / worker pools / autoscaling |
| `@omnitron-dev/titan-ratelimit` | Token-bucket / sliding-window / fixed-window |
| `@omnitron-dev/titan-redis` | Redis client (clusters, sentinel, named instances) |
| `@omnitron-dev/titan-scheduler` | Cron / interval / timeout with persistence |
| `@omnitron-dev/titan-telemetry-relay` | Store-and-forward telemetry (WAL-backed) |

## Browser-side / Frontend

| Package | Framework | Required when |
| ------- | --------- | ------------- |
| `@omnitron-dev/netron-browser` | **Framework-agnostic** — vanilla JS, Vue, Svelte, Solid, Angular, Lit, React, Web Workers | You build a browser client that calls a Titan backend |
| `@omnitron-dev/netron-react` | **React-only** — optional layer on top of netron-browser | Your frontend uses React |
| `@omnitron-dev/prism` | **React-only** — MUI v7 design system | Your frontend uses React and you want pre-built components |

**Use matrix:**

| Frontend stack | Install |
| -------------- | ------- |
| Vanilla JS / TypeScript | `netron-browser` only |
| Vue 3 | `netron-browser` only (wrap in `reactive`/`ref`) |
| Svelte | `netron-browser` only (wrap in stores) |
| Solid | `netron-browser` only (wrap in signals) |
| Angular | `netron-browser` only (wrap in services / RxJS) |
| Lit | `netron-browser` only |
| React 18 / 19 | `netron-browser` + `netron-react` (+ optional `prism`) |
| Web Worker | `netron-browser` only |

## Supervisor (opt-in)

| Package | What |
| ------- | ---- |
| `@omnitron-dev/omnitron` | Application supervisor + CLI + web console + MCP server. Optional. See [Titan vs Omnitron](../foundations/titan-vs-omnitron.md). |

## Shared utilities (framework-agnostic)

Six small focused packages. Used internally by everything
above; reusable in non-Omnitron projects.

| Package | Purpose |
| ------- | ------- |
| `@omnitron-dev/common` | Type predicates, promise helpers, object tools, data structures |
| `@omnitron-dev/cuid` | Collision-resistant URL-safe unique IDs |
| `@omnitron-dev/eventemitter` | Async event emitter with parallel/serial/reduce |
| `@omnitron-dev/msgpack` | Extensible MessagePack with native JS types (Date, Map, Set, BigInt, Error) |
| `@omnitron-dev/kb` | Knowledge-base framework (backs `omnitron kb mcp`) |
| `@omnitron-dev/testing` | Cross-runtime testing utilities (Node + Bun + Deno) |

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
