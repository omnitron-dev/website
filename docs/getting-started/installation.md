---
sidebar_position: 1
title: Installation
description: Install only what you need. Server-side Netron ships inside Titan; the browser client is a separate package.
---

# Installation

The stack ships as **independently versioned packages** under
the `@omnitron-dev/` scope. Install only the layers you need.

> **Important to understand upfront:**
>
> - **Server-side Netron** (RPC framework with all 4 transports —
>   HTTP, WebSocket, TCP, Unix) is **part of
>   `@omnitron-dev/titan`** itself. It's exposed via subpath
>   exports like `@omnitron-dev/titan/netron`. **You do not
>   install a separate package** for the server.
> - **`@omnitron-dev/netron-browser`** is the **browser-side
>   Netron client** — usable with **any frontend** (vanilla JS,
>   React, Vue, Svelte, Solid, Angular, Lit, …). It's not tied
>   to React.
> - **`@omnitron-dev/netron-react`** sits on top of
>   `netron-browser` and adds React-specific hooks / providers /
>   cache integration. Install it **only** if you use React.

## Prerequisites

| Tool | Version | Why |
| ---- | ------- | --- |
| **Node.js** | 22+ (24 also tested) | Titan + Omnitron daemon target Node ESM |
| **pnpm** | 9+ recommended | Workspaces, fast installs; npm/yarn work for consumers |
| **TypeScript** | 5.x | Decorator metadata + ESM resolution |
| **Bun** (optional) | 1.x | Titan apps may run on Bun; Omnitron daemon needs Node |
| **Deno** (optional) | 2.x | Titan apps may run on Deno; Omnitron daemon needs Node |
| **Docker** (optional) | latest | Required for `omnitron infra` provisioning |

## Backend — `@omnitron-dev/titan`

The backend framework. **This is the only package required to
build a Titan service.** Server-side Netron — including every
transport — is already inside.

```bash
pnpm add @omnitron-dev/titan
```

Subpath imports (use any of these — they're all part of the
single `@omnitron-dev/titan` package):

```typescript
// Core framework:
import { Application, Module, Service, Public, Injectable }
  from '@omnitron-dev/titan';

// Lifecycle interfaces:
import { OnInit, OnStart, OnStop, OnDestroy }
  from '@omnitron-dev/titan';

// Server-side Netron API:
import { Netron, ServiceDescriptor, AuthenticationManager }
  from '@omnitron-dev/titan/netron';

// Per-transport server (each can be enabled independently):
import { HttpTransport }      from '@omnitron-dev/titan/netron/transport/http';
import { WebSocketTransport } from '@omnitron-dev/titan/netron/transport/websocket';
import { TcpTransport }       from '@omnitron-dev/titan/netron/transport/tcp';
import { UnixTransport }      from '@omnitron-dev/titan/netron/transport/unix';

// Server-side HTTP middleware:
import { AuthMiddleware, RateLimitMiddleware }
  from '@omnitron-dev/titan/netron/transport/http/middleware';

// Multi-backend (server-side):
import { MultiBackend }
  from '@omnitron-dev/titan/netron/multi-backend';

// Built-in modules:
import { ConfigModule } from '@omnitron-dev/titan/module/config';
import { LoggerModule } from '@omnitron-dev/titan/module/logger';

// DI container primitives (advanced):
import { Container, createToken } from '@omnitron-dev/titan/nexus';

// Validation:
import { z, Validate, Contract } from '@omnitron-dev/titan/validation';

// Typed errors:
import { Errors, ErrorCode, TitanError } from '@omnitron-dev/titan/errors';

// Decorators:
import { Memoize, Retry, Timeout } from '@omnitron-dev/titan/decorators';
```

Full subpath list (from `titan/package.json` exports):

| Subpath | Contains |
| ------- | -------- |
| `@omnitron-dev/titan` | Application, Module, decorators, all primitives — convenient root import |
| `@omnitron-dev/titan/application` | `Application.create` + lifecycle |
| `@omnitron-dev/titan/lifecycle` | `OnInit` / `OnStart` / `OnStop` / `OnDestroy` interfaces |
| `@omnitron-dev/titan/decorators` | All core decorators (`@Service`, `@Public`, `@Validate`, `@Memoize`, etc.) |
| `@omnitron-dev/titan/netron` | **Server Netron API** — peers, services, descriptors |
| `@omnitron-dev/titan/netron/service-descriptor` | Service metadata types |
| `@omnitron-dev/titan/netron/transport/http` | HTTP server transport |
| `@omnitron-dev/titan/netron/transport/websocket` | WebSocket server transport |
| `@omnitron-dev/titan/netron/transport/tcp` | TCP server transport |
| `@omnitron-dev/titan/netron/transport/unix` | Unix-socket server transport |
| `@omnitron-dev/titan/netron/transport/http/middleware` | HTTP-transport middleware (auth, rate-limit, …) |
| `@omnitron-dev/titan/netron/auth` | `AuthenticationManager`, JWT verify, RLS context mapping |
| `@omnitron-dev/titan/netron/multi-backend` | Multi-backend server-side routing |
| `@omnitron-dev/titan/nexus` | DI container primitives |
| `@omnitron-dev/titan/validation` | zod re-export + `@Validate`, `@Contract` |
| `@omnitron-dev/titan/module/config` | `ConfigModule` (built-in) |
| `@omnitron-dev/titan/module/logger` | `LoggerModule` (built-in) |
| `@omnitron-dev/titan/module/rls` | RLS decorators |
| `@omnitron-dev/titan/errors` | `Errors` factories + `TitanError` |
| `@omnitron-dev/titan/types` | Public type-only exports |
| `@omnitron-dev/titan/utils` | Internal utilities |
| `@omnitron-dev/titan/tracing` | OpenTelemetry-style tracing primitives |

Tree-shaking works on every subpath. Production bundles import
the smallest scope they need.

## Backend modules (optional, 14 packages)

Independently versioned. Add only the ones your app uses.

```bash
# Pick what you need (any subset):
pnpm add @omnitron-dev/titan-auth          # JWT auth
pnpm add @omnitron-dev/titan-cache         # multi-tier cache (L1 + L2 Redis)
pnpm add @omnitron-dev/titan-database      # Kysely + migrations + RLS
pnpm add @omnitron-dev/titan-discovery     # service discovery
pnpm add @omnitron-dev/titan-events        # event bus
pnpm add @omnitron-dev/titan-health        # health probes
pnpm add @omnitron-dev/titan-lock          # distributed locks
pnpm add @omnitron-dev/titan-metrics       # Prometheus metrics
pnpm add @omnitron-dev/titan-notifications # multi-channel delivery
pnpm add @omnitron-dev/titan-pm            # worker pools, autoscaling
pnpm add @omnitron-dev/titan-ratelimit     # rate limiting
pnpm add @omnitron-dev/titan-redis         # Redis client
pnpm add @omnitron-dev/titan-scheduler     # cron / interval / timeout
pnpm add @omnitron-dev/titan-telemetry-relay  # store-and-forward telemetry
```

→ Full module reference: [Titan modules](../titan/modules).

## Browser client — `@omnitron-dev/netron-browser`

**Framework-agnostic RPC client for the browser.** Works with
any frontend — vanilla JS, React, Vue, Svelte, Solid, Angular,
Lit, plain JS in a Web Worker, Electron renderer, etc.

```bash
pnpm add @omnitron-dev/netron-browser
```

Use directly (no framework):

```typescript
import { createClient } from '@omnitron-dev/netron-browser';

const client = createClient({
  url:       'https://api.example.com',
  transport: 'http',                       // 'http' | 'websocket' | 'auto'
});

await client.connect();

// Type-safe service proxy (type from your shared types package):
import type { UsersService } from '@your-app/contracts';
const users = client.service<UsersService>('users');
const user  = await users.findById('u_42');
```

Carries:

- HTTP + WebSocket transports with auto-reconnect.
- Middleware pipeline (auth, retry, cache, circuit breaker, tracing).
- `AuthManager` with token rotation, cross-tab sync.
- `BackendPool` for multi-backend routing.
- LRU cache with stale-while-revalidate.
- Typed errors that round-trip from the server intact.

Subpaths:

| Subpath | Contains |
| ------- | -------- |
| `@omnitron-dev/netron-browser` | Root — convenient `createClient` |
| `@omnitron-dev/netron-browser/client` | `NetronClient`, `HttpClient`, `WebSocketClient`, `BackendPool` |
| `@omnitron-dev/netron-browser/auth` | `AuthManager` |
| `@omnitron-dev/netron-browser/middleware` | All built-in middleware |
| `@omnitron-dev/netron-browser/errors` | Typed error hierarchy |

→ Full reference: [netron-browser](../frontend/netron/browser.md).

### When you'd skip this

- Your client isn't a browser. Inside another Titan app (Node /
  Bun / Deno), use `@omnitron-dev/titan/netron` directly —
  server and Node-client APIs share the same shape.

## React bindings — `@omnitron-dev/netron-react` (only for React apps)

**React hooks, providers, and cache integration on top of
`netron-browser`.** Install **only** if your frontend uses
React.

```bash
pnpm add @omnitron-dev/netron-browser @omnitron-dev/netron-react
```

The `netron-react` package depends on `netron-browser` as a
peer — install both.

```tsx
import { NetronReactClient, NetronProvider, useService }
  from '@omnitron-dev/netron-react';

const client = new NetronReactClient({ url: 'https://api.example.com' });

function App() {
  return <NetronProvider client={client}>...</NetronProvider>;
}

function UserCard({ id }: { id: string }) {
  const users = useService<UsersService>('users');
  const { data, isLoading } = users.findById.useQuery([id]);
  return isLoading ? <Skeleton /> : <div>{data?.email}</div>;
}
```

Provides:

- `useQuery` / `useMutation` / `useSubscription` /
  `useInfiniteQuery` / `useQueries` / `useService`
- `<NetronProvider>` / `<MultiBackendProvider>`
- `<AuthProvider>` + `<AuthGuard>` + `<GuestGuard>` + `useAuth`
- `<NetronDevtools>` (React DevTools-style panel)
- `MockProvider` for testing

→ Full reference: [netron-react](../frontend/netron/react.md).

### For Vue / Svelte / Solid / Angular / Lit

Use `@omnitron-dev/netron-browser` directly. The client object
has identical methods regardless of framework — wrap them in
your framework's reactivity primitives (e.g., Vue's
`reactive`, Svelte stores, Solid signals).

Community `netron-vue` / `netron-svelte` packages could mirror
`netron-react`'s API exactly. Until they ship, the direct API
from `netron-browser` works in any framework.

## Design system — `@omnitron-dev/prism` (optional, React)

50+ MUI v7 components, schema-aware forms, theme. **React-only**
because MUI v7 is React.

```bash
pnpm add @omnitron-dev/prism
```

→ Full reference: [Prism](../frontend/prism).

## Utilities (optional)

Five framework-agnostic packages used internally and reusable:

```bash
pnpm add @omnitron-dev/common         # type predicates, promise helpers, data structures
pnpm add @omnitron-dev/cuid           # collision-resistant URL-safe IDs
pnpm add @omnitron-dev/eventemitter   # async event emitter (parallel/serial/reduce)
pnpm add @omnitron-dev/msgpack        # MessagePack + native JS types (Date, Map, Set, …)
pnpm add @omnitron-dev/kb             # knowledge-base framework (server-side)
```

→ Full reference: [Utilities](../utilities).

## Testing utilities (dev-only)

```bash
pnpm add -D @omnitron-dev/testing
```

Cross-runtime testing primitives — Node + Bun + Deno from one
source. → [Testing](../testing).

## Supervisor (opt-in) — `@omnitron-dev/omnitron`

The application supervisor + CLI + web console + MCP server.
**Optional.** Install only when you outgrow a single Titan
app — see
[Titan vs Omnitron](../foundations/titan-vs-omnitron.md).

Global install (system-wide `omnitron` command):

```bash
pnpm add -g @omnitron-dev/omnitron
```

Or per-project:

```bash
pnpm add -D @omnitron-dev/omnitron
pnpm omnitron up
```

→ Full reference: [Omnitron](../omnitron/overview.md).

## Install matrices — common setups

### Backend-only service (RPC server, no frontend)

```bash
pnpm add @omnitron-dev/titan @omnitron-dev/titan-database @omnitron-dev/titan-auth
```

Server-side Netron with HTTP + WS + TCP + Unix transports is
already inside `titan` — no extra install.

### Backend + browser client (any frontend framework)

```bash
# Backend:
pnpm add @omnitron-dev/titan @omnitron-dev/titan-database @omnitron-dev/titan-auth

# Browser (works for Vue / Svelte / Solid / Angular / Lit / vanilla):
pnpm add @omnitron-dev/netron-browser
```

### Backend + React frontend

```bash
# Backend:
pnpm add @omnitron-dev/titan @omnitron-dev/titan-database @omnitron-dev/titan-auth

# Frontend (React-specific):
pnpm add @omnitron-dev/netron-browser @omnitron-dev/netron-react @omnitron-dev/prism
```

### Full operator-supervised platform

```bash
# Everything above PLUS:
pnpm add -g @omnitron-dev/omnitron
```

### Service-to-service (one Titan app calling another)

No client package needed. Use `@omnitron-dev/titan/netron`
directly in the caller — same API:

```typescript
import { Netron } from '@omnitron-dev/titan/netron';

const netron = new Netron();
const peer   = await netron.connect('tcp://other-service:4001');
const users  = await peer.queryInterface<UsersService>('users@1.0.0');
```

## Verify

```bash
node -e "console.log(require('@omnitron-dev/titan/package.json').version)"
```

For Omnitron:

```bash
omnitron --version
omnitron ping
```

## Next

→ [Quickstart](./quickstart.md) — write your first Titan
service and call it from a browser, end-to-end in five minutes.
