---
sidebar_position: 8
title: Multi-backend
description: One frontend, many Netron servers — routing, hooks, components.
---

# Multi-backend

When the app talks to several Netron servers — typical in a
fan-out architecture — wrap them in a `MultiBackendProvider`
and let route patterns decide which backend each call hits.

## Setup

```tsx
import { MultiBackendProvider, useBackendService }
  from '@omnitron-dev/netron-react';

function App() {
  return (
    <MultiBackendProvider
      backends={{
        auth:    { url: 'https://auth.example.com',    transport: 'auto' },
        media:   { url: 'https://media.example.com',   transport: 'auto' },
        streams: { url: 'wss://streams.example.com',   transport: 'websocket' },
        reports: { url: 'https://reports.example.com', transport: 'http' },
      }}
      routes={{
        'users.*':    'auth',
        'sessions.*': 'auth',
        'objects.*':  'media',
        'transforms.*': 'media',
        'events.*':   'streams',
        'reports.*':  'reports',
      }}
      autoConnect={true}
    >
      <Outlet />
    </MultiBackendProvider>
  );
}
```

Route patterns are glob-style — `users.*` matches every
service under the `users` namespace. Calls not matching any
pattern throw `BackendNotConfiguredError`.

## Default backend

```tsx
<MultiBackendProvider
  backends={{
    main:  { url: '/api/main',  transport: 'auto' },
    media: { url: '/api/media', transport: 'auto' },
  }}
  routes={{ 'objects.*': 'media' }}
  defaultBackend="main"
>
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
  // Router sees 'users' → matches 'users.*' → routes to 'auth' backend
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

Each backend can carry its own auth:

```tsx
<MultiBackendProvider
  backends={{
    auth:   { url: 'https://auth.example.com',   transport: 'auto', auth: { /* uses primary AuthManager */ } },
    public: { url: 'https://public.example.com', transport: 'http', auth: false },
  }}
  routes={{
    'users.*':  'auth',
    'public.*': 'public',
  }}
/>
```

`auth: false` disables auth for that backend (e.g., a public CMS
endpoint).

For most setups, **one shared AuthManager** across all
backends is right — the same JWT verifies everywhere in a
fan-out architecture.

## Health-aware routing

```tsx
<MultiBackendProvider
  backends={{ ... }}
  routes={{ ... }}
  healthCheck={{
    interval:     30_000,
    timeout:      2_000,
    onUnhealthy:  'fail',         // 'fail' | 'fallback' | 'queue'
  }}
  failover={{
    'reports': 'reports-backup',  // when 'reports' is unhealthy, try 'reports-backup'
  }}
/>
```

When `onUnhealthy: 'fallback'` and a failover backend is
configured, calls to the unhealthy backend get re-routed.

## Per-backend cache

Each backend has its own QueryCache instance. Cache keys are
backend-scoped — same `[users, getUser, 'u_42']` key in the
`auth` and `media` backends are different entries.

Cross-backend invalidation:

```tsx
import { useMultiBackendContext } from '@omnitron-dev/netron-react';

function CacheManager() {
  const { backends } = useMultiBackendContext();
  return (
    <Button onClick={() => {
      Object.values(backends).forEach(b => b.getQueryCache().invalidateQueries(['users']));
    }}>
      Refresh users everywhere
    </Button>
  );
}
```

## Backend pool (no React)

For vanilla JS / web workers / SSR:

```typescript
import { BackendPool, BackendClient } from '@omnitron-dev/netron-browser';

const pool = new BackendPool({
  backends: {
    auth:    new BackendClient({ url: 'https://auth.example.com' }),
    media:   new BackendClient({ url: 'https://media.example.com' }),
    streams: new BackendClient({ url: 'wss://streams.example.com',
                                 transport: 'websocket' }),
  },
  routes: {
    'users.*':    'auth',
    'objects.*':  'media',
    'events.*':   'streams',
  },
  defaultBackend: 'auth',
});

await pool.connectAll();

const users = pool.service<UserService>('users');
// Automatically routed to 'auth' backend
const user = await users.getUser('u_42');
```

`MultiBackendProvider` wraps a `BackendPool` under the hood —
same routing logic, plus the React subscription glue.

## Routing patterns

Glob-style; left-to-right wins; longer patterns match first.

| Pattern | Matches |
| ------- | ------- |
| `'users.*'` | `users.getUser`, `users.list`, etc. |
| `'*.public'` | Any service with `.public` method |
| `'admin.*'` | All admin services |
| `'OmnitronDaemon'` | Exact service name |
| `'**'` | Everything (default-backend fallback) |

For more complex matching, pass a function instead of a pattern
map:

```tsx
<MultiBackendProvider
  backends={{ auth: ..., media: ..., default: ... }}
  routes={(service, method) => {
    if (service.startsWith('Auth'))  return 'auth';
    if (service.startsWith('Media')) return 'media';
    return 'default';
  }}
/>
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
- **Shared `AuthManager`** across backends in fan-out
  architectures.
- **`RequireBackendConnection`** for routes that need a specific
  backend up — fail-fast UX beats mystery loading state.
- **Per-backend health probes** in production — surface
  individual backend health to operators.

## Anti-patterns

- **Per-route `MultiBackendProvider`.** Loses connection
  sharing and cache; re-connects on every route change.
- **Per-backend AuthManager** in a fan-out architecture.
  Multiple managers, mismatched tokens, sign-out doesn't
  propagate.
- **Glob `'**'`** as the only pattern. Defeats routing; use
  `defaultBackend` instead.
- **Hard-coding backend names in components.** Use `useService`
  (routed) so components stay transport-agnostic.

## See also

- [netron-react](./react.md) — single-backend equivalents
- [Auth manager](./auth.md) — shared auth across backends
- [Caching](./caching.md) — per-backend cache
- [Transports](./transports.md) — transport per backend
