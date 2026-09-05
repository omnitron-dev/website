---
sidebar_position: 8
title: Multi-backend
description: One frontend, many Netron servers — routing, hooks, components.
---

# Multi-backend

When the app talks to several Netron backends — typical in a
fan-out architecture — build a client for all of them and hand
it to `MultiBackendProvider`.

Two things follow from the shape of that client and are worth
knowing before the examples. Backends live behind **one
`baseUrl`, separated by path** — a gateway with `/auth`,
`/media`, `/streams` under it, not a client per hostname. And the
provider does not build the client: it takes one you built, which
is why the same client can be used outside React (a worker, an
SSR pass, a test) without a second configuration.

## Setup

```tsx
import { createMultiBackendClient } from '@omnitron-dev/netron-browser';
import { MultiBackendProvider, useBackendService }
  from '@omnitron-dev/netron-react';

const client = createMultiBackendClient({
  baseUrl: 'https://api.example.com',
  backends: {
    auth:    { path: '/auth' },
    media:   { path: '/media' },
    streams: { path: '/streams', transport: 'websocket' },
    reports: { path: '/reports', transport: 'http' },
  },
  defaultBackend: 'auth',
  routing: {
    services: { objects: 'media', transforms: 'media' },
    patterns: [
      { pattern: 'users',    backend: 'auth' },
      { pattern: 'sessions', backend: 'auth' },
      { pattern: /^events\./, backend: 'streams' },
    ],
  },
});

function App() {
  return (
    <MultiBackendProvider client={client} autoConnect>
      <Outlet />
    </MultiBackendProvider>
  );
}
```

A string pattern matches by **prefix**, not as a glob — see
[Routing patterns](#routing-patterns). A call that matches
nothing goes to `defaultBackend`; it does not throw.

## Default backend

`defaultBackend` is where anything unrouted lands, and it is
required in practice — without it the first backend in the
config is used, which makes the fallback depend on key order.

```tsx
const client = createMultiBackendClient({
  baseUrl: '/api',
  backends: {
    main:  { path: '/main' },
    media: { path: '/media' },
  },
  defaultBackend: 'main',
  routing: { services: { objects: 'media' } },
});
```

Anything not matched routes to `defaultBackend`. Useful when
most services live on one backend and a few are extracted.

## Per-backend service hooks

```tsx
import { useBackendService } from '@omnitron-dev/netron-react';

function UserCard({ userId }: { userId: string }) {
  const users = useBackendService<UserService>('auth', 'users');
  const { data } = users.getUser.useQuery([userId]);
  return data ? <div>{data.email}</div> : null;
}

function MediaPreview({ id }: { id: string }) {
  const media = useBackendService<MediaService>('media', 'objects');
  const { data } = media.getMetadata.useQuery([id]);
  return data ? <img src={data.thumbnailUrl} /> : null;
}
```

`useBackendService(backend, service)` explicitly addresses a
backend; the router's pattern matching is bypassed.

## Routed `useService`

When you use the routed form, the router resolves the backend
from the service name:

```tsx
import { useService } from '@omnitron-dev/netron-react';

function UserCard({ userId }: { userId: string }) {
  // Router sees 'users' → matches the 'users' prefix → 'auth' backend
  const users = useService<UserService>('users');
  const { data } = users.getUser.useQuery([userId]);
}
```

The router-based form is recommended — components don't need to
know which backend a service lives on; the routing config is
the contract.

## Per-backend hooks

| Hook | Purpose |
| ---- | ------- |
| `useBackend(name)` | Get the typed backend client by name |
| `useBackendConnectionState(name)` | Per-backend connection state |
| `useBackendService(backend, service)` | Typed service from a specific backend |
| `useBackendQuery(backend, query)` | Query against a specific backend |
| `useBackendMutation(backend, mutation)` | Mutation against a specific backend |
| `useAllBackendsConnected()` | True iff all backends connected |
| `useAnyBackendConnected()` | True iff at least one connected |
| `useMultiBackendContext()` | Full context value (advanced) |
| `useMultiBackendConnectionState()` | All backends' connection states |

## Connection-aware rendering

```tsx
import {
  BackendConnectionAware,
  RequireBackendConnection,
  RequireAllBackends,
  RequireAnyBackend,
  BackendStatus,
  MultiBackendConnectionAware,
} from '@omnitron-dev/netron-react';

// Render only when this backend is connected:
<RequireBackendConnection backend="media" fallback={<MediaOffline />}>
  <UploadForm />
</RequireBackendConnection>

// Branch based on connection state:
<BackendConnectionAware backend="reports">
  {({ isConnected, isConnecting, error }) =>
    isConnected   ? <Reports /> :
    isConnecting  ? <Spinner /> :
                    <ErrorCard error={error} />
  }
</BackendConnectionAware>

// Require ALL listed backends:
<RequireAllBackends backends={['auth', 'media']}>
  <Dashboard />
</RequireAllBackends>

// Or ANY (failover scenarios):
<RequireAnyBackend backends={['auth-primary', 'auth-backup']}>
  <SignInButton />
</RequireAnyBackend>

// Status indicator:
<BackendStatus backend="streams" showLabel />

// All backends at once:
<MultiBackendConnectionAware>
  {(states) => (
    <Stack direction="row">
      {Object.entries(states).map(([name, s]) => (
        <Chip key={name} label={name} color={s.isConnected ? 'success' : 'error'} />
      ))}
    </Stack>
  )}
</MultiBackendConnectionAware>
```

## Per-backend auth

A backend's `auth` takes an `AuthenticationClient` you already
built, or `AuthOptions` for the client to build one:

```tsx
import { AuthenticationClient } from '@omnitron-dev/netron-browser';

const jwtAuth = new AuthenticationClient({ storage: 'local' });

const client = createMultiBackendClient({
  baseUrl: 'https://api.example.com',
  backends: {
    auth:   { path: '/auth',   auth: jwtAuth },
    public: { path: '/public' },          // omit `auth` — no credentials sent
  },
  defaultBackend: 'auth',
});
```

Omitting `auth` is how a backend goes unauthenticated; there is
no `auth: false`.

For most setups **one shared `AuthenticationClient`** across all
backends is right — the same JWT verifies everywhere in a
fan-out architecture, and passing the same instance is what makes
one refresh serve every backend.

## Health checks

`BackendPool` — the layer under the client — can poll its
backends: `enableHealthChecks` (off by default) and
`healthCheckInterval` (30s). What that buys is **observability,
not switching**.

Nothing inside the library reads the resulting flag:
`invoke(backend, service, method)` takes the backend name from
the caller, so there is no routing decision for a health result
to change. The only consumers are the public
`getHealthyBackends()` / `getUnhealthyBackends()` — useful for a
status indicator, and the place to build failover yourself.

So there is no `failover` map, no `onUnhealthy` policy and no
request queue. A call to a backend that is down fails like any
other call.

:::note The same option means something else on the server
`@omnitron-dev/titan`'s multi-backend does route on health — it
skips backends marked unhealthy and has a circuit breaker. One
option name, two packages in the same monorepo, and the browser
one is where it does not decide anything.
:::

## Shared cache

The provider's query engine owns a single QueryCache shared
across every backend. Cache keys distinguish entries — encode
the backend into the key (e.g. `['auth', 'users', 'getUser', 'u_42']`)
when the same service name lives on more than one backend.

Cross-backend invalidation — the bridged client invalidates over
the shared cache:

```tsx
import { useNetronClient } from '@omnitron-dev/netron-react';

function CacheManager() {
  const client = useNetronClient();
  return (
    <Button onClick={() => client.invalidateQueries({ queryKey: ['users'] })}>
      Refresh users everywhere
    </Button>
  );
}
```

## Backend pool (no React)

For vanilla JS / web workers / SSR:

```typescript
import { createMultiBackendClient } from '@omnitron-dev/netron-browser';

// One gateway, several backends behind it — the model is a shared origin
// with a path per backend, not a client per host. That is what makes one
// auth client, one middleware chain and one set of shared options apply
// across all of them.
const client = createMultiBackendClient({
  baseUrl: 'https://api.example.com',
  backends: {
    auth:    { path: '/auth' },
    media:   { path: '/media' },
    streams: { path: '/streams', transport: 'websocket' },
  },
  defaultBackend: 'auth',
  routing: {
    // Explicit mappings win over patterns.
    services: { objects: 'media' },
    // A string pattern is a PREFIX, not a glob — 'users' matches
    // `users`, `users.admin`, `usersLegacy`. Use a RegExp when you need
    // more than that.
    patterns: [
      { pattern: 'users',        backend: 'auth' },
      { pattern: /^events\./,    backend: 'streams' },
    ],
  },
});

const users = client.service<UserService>('users');
const user = await users.getUser('u_42');   // routed to 'auth'
```

To reach a backend by name rather than by routing, `client.backend('media')`
returns its `BackendClient`. `BackendPool` — the layer underneath — is the
registry alone: `get(name)`, `connect(name)`, `connectAll()`, with no routing
of its own.

`MultiBackendProvider` takes this same client — the routing
lives in the client, the provider adds the React subscription
glue. That separation is why the client above works unchanged in
a worker or an SSR pass.

## Routing patterns

Not glob. A string pattern matches by **prefix** (or exactly);
anything more expressive is a `RegExp`. Patterns are tried in
array order and the first match wins — length plays no part.

| Pattern | Matches | Does not match |
| ------- | ------- | -------------- |
| `'users'` | `users`, `users.admin`, `usersLegacy` | `adminUsers` |
| `/^admin\./` | `admin.settings`, `admin.audit` | `superadmin.x` |
| `'OmnitronDaemon'` | that name exactly, and anything starting with it | — |

`'users.*'`, `'*.public'` and `'**'` are ordinary strings here:
`*` has no special meaning, so `'users.*'` matches only a service
literally named `users.*…`. For "everything else", set
`defaultBackend` — that is the fallback, and it applies whenever
no explicit mapping and no pattern matched.

Resolution order: `routing.services` (exact, wins outright) →
`routing.patterns` (in order) → `defaultBackend`.

There is no function form: `routing` takes `services` and
`patterns`, and a `RegExp` pattern is the escape hatch for
anything a prefix cannot express.

```typescript
routing: {
  patterns: [
    { pattern: /^Auth/,  backend: 'auth' },
    { pattern: /^Media/, backend: 'media' },
  ],
},
defaultBackend: 'default',
```

## Prism integration

Prism re-exports `MultiBackendProvider` with extra defaults
(theming, settings store hooks, snackbar host):

```tsx
import { createMultiBackendClient, MultiBackendProvider }
  from '@omnitron-dev/prism/netron';

const client = createMultiBackendClient({
  baseUrl:        '',
  backends: {
    main:    { path: '/api/main' },
    storage: { path: '/api/storage' },
  },
  defaultBackend: 'main',
});

<MultiBackendProvider client={client} autoConnect>
  <Outlet />
</MultiBackendProvider>
```

Prefer the Prism version for apps that already use Prism — it
hooks into the Prism context.

## Best practices

- **One `MultiBackendProvider` per app**, mounted at the root.
- **Routing config is the contract.** Components shouldn't
  know which backend they hit.
- **Match backend boundaries to logical concerns.** Don't split
  arbitrarily; split when scaling / ownership / lifecycle
  genuinely differs.
- **Shared `AuthenticationClient`** across backends in fan-out
  architectures.
- **`RequireBackendConnection`** for routes that need a specific
  backend up — fail-fast UX beats mystery loading state.
- **Handle a backend being down where you can act on it.** The
  client does not re-route away from an unhealthy backend, so a
  component that must survive one going away needs its own
  fallback.

## Anti-patterns

- **Per-route `MultiBackendProvider`.** Loses connection
  sharing and cache; re-connects on every route change.
- **Per-backend `AuthenticationClient`** in a fan-out architecture.
  Multiple instances, mismatched tokens, sign-out doesn't
  propagate.
- **A catch-all pattern.** There is no glob to write one with,
  and `defaultBackend` already is the fallback.
- **Hard-coding backend names in components.** Use `useService`
  (routed) so components stay transport-agnostic.

## See also

- [netron-react](./react.md) — single-backend equivalents
- [Auth manager](./auth.md) — shared auth across backends
- [Caching](./caching.md) — shared cache across backends
- [Transports](./transports.md) — transport per backend
