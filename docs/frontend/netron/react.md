---
sidebar_position: 4
title: netron-react
description: Production-grade React bindings for Netron RPC — type-safe hooks, multi-backend, auth.
---

# netron-react

`@omnitron-dev/netron-react` is the **optional React layer** on
top of [netron-browser](./browser.md). Provides React 18+ / 19
bindings: type-safe hooks for queries, mutations, subscriptions,
infinite queries; a query + mutation cache; multi-backend
support; an authentication system with route guards; and
devtools scaffolding.

> **Install only if your frontend uses React.** For Vue / Svelte
> / Solid / Angular / Lit / vanilla JS — use
> [`netron-browser`](./browser.md) directly and wrap calls in
> your framework's reactivity primitives.
>
> **Don't confuse with server-side Netron** at
> `@omnitron-dev/titan/netron` — that's part of the Titan
> framework. This package consumes the server through
> `netron-browser`.

Verified against `packages/netron-react/src/` (data layer at
parity across all three query hooks; no external data-fetching
dependency).

```bash
pnpm add @omnitron-dev/netron-react @omnitron-dev/netron-browser
```

`netron-browser` is a peer dependency — install both.

## Provider

```tsx
import { NetronReactClient, NetronProvider } from '@omnitron-dev/netron-react';

const client = new NetronReactClient({
  url:       'https://api.example.com',
  transport: 'auto',                 // 'auto' | 'http' | 'websocket'
  timeout:   30_000,
  cache: {
    staleTime:  30_000,              // ms before data is considered stale
    cacheTime:  5 * 60_000,          // ms to keep unused data before GC
    maxEntries: 1000,
  },
  defaults: {                        // applied to every query unless overridden
    staleTime:            30_000,
    cacheTime:            5 * 60_000,
    retry:                3,         // number | RetryConfig
    refetchOnWindowFocus: true,
    refetchOnReconnect:   true,
  },
  devTools: process.env.NODE_ENV === 'development',
});

function App() {
  return (
    <NetronProvider client={client}>
      <Outlet />
    </NetronProvider>
  );
}
```

`new NetronReactClient(config)` and the `createNetronClient(config)`
factory are equivalent — both return a client that wraps a
`NetronClient` (from netron-browser) and adds the query/mutation
cache + React integration glue.

> Config field names are exact: it's `cacheTime` (not `gcTime`),
> and `retry` accepts a plain number **or** a `RetryConfig`
> object (`{ attempts, initialDelay?, maxDelay?, backoff?,
> retryCondition? }`) — there is no `maxAttempts`. `defaults` is a
> flat object, not `{ queryOptions: … }`.

## Hooks at a glance

| Hook | Form | Purpose |
| ---- | ---- | ------- |
| `useQuery` | standalone or proxy | Cached data fetching from a service method |
| `useMutation` | standalone or proxy | Mutating call with invalidation + optimistic updates |
| `useInfiniteQuery` | standalone | Paginated / cursor-based queries |
| `useQueries` | standalone | Parallel queries — many at once, optional `combine` |
| `useSubscription` | standalone | Live event subscription synced to React state |
| `useService` | — | Typed service proxy with per-method `.call` / `.useQuery` / `.useMutation` |
| `createServiceHook` | — | `useService` curried with a service name |

Plus context hooks:

| Hook | Purpose |
| ---- | ------- |
| `useNetronClient` / `useNetronClientSafe` | Access the raw client from context |
| `useNetronConnection` | Reactive connection state |
| `useDefaults` | Read provider-level defaults |
| `useHydration` | SSR hydration state |

> **Proxy vs. standalone.** The `useService` proxy exposes
> `.call`, `.useQuery` and `.useMutation` per method.
> `useInfiniteQuery`, `useQueries` and `useSubscription` are
> **standalone hooks** — they are not methods on the proxy. Call
> them directly and build the `queryKey` / `queryFn` (or `event`)
> yourself.

## `useQuery` — the workhorse

Through the typed proxy (recommended — pass a positional args
array, options omit `queryKey`/`queryFn` because the proxy
supplies them):

```tsx
import { useService } from '@omnitron-dev/netron-react';

interface UserService {
  getUser(id: string): Promise<User>;
  list(filter: UserFilter): Promise<User[]>;
}

function UserCard({ userId }: { userId: string }) {
  const users = useService<UserService>('users');
  const { data, isLoading, error, refetch } = users.getUser.useQuery([userId]);

  if (isLoading) return <Skeleton />;
  if (error)     return <ErrorCard error={error} onRetry={refetch} />;
  return <div>{data!.email}</div>;
}
```

Standalone form — supply `queryKey` + `queryFn` yourself:

```tsx
import { useQuery, useNetronClient } from '@omnitron-dev/netron-react';

const client = useNetronClient();
const { data } = useQuery<User>({
  queryKey: ['users', 'getUser', userId],
  queryFn: ({ signal }) => client.invoke('users', 'getUser', [userId], { signal }),
});
```

What you get back (`QueryResult<T>`):

```typescript
interface QueryResult<TData, TError = NetronError> {
  data:           TData | undefined;
  error:          TError | null;
  status:         'idle' | 'loading' | 'success' | 'error';
  isLoading:      boolean;
  isError:        boolean;
  isSuccess:      boolean;
  isIdle:         boolean;
  isFetching:     boolean;   // true also when refetching cached data
  isRefetching:   boolean;   // fetching while not in the initial load
  isStale:        boolean;
  isPreviousData: boolean;   // true while keepPreviousData carries a prior key over
  dataUpdatedAt:  number;
  errorUpdatedAt: number;
  refetch:        () => Promise<QueryResult<TData, TError>>;
  remove:         () => void; // drop this query from the cache
}
```

### Query options

```tsx
users.getUser.useQuery([userId], {
  enabled:              userId != null,
  staleTime:            30_000,
  cacheTime:            5 * 60_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect:   true,
  refetchInterval:      60_000,          // number | false
  retry:                3,               // number | boolean | RetryConfig
  retryDelay:           (attempt) => 2 ** attempt * 1000,
  select:               (user) => user.email,   // project/transform
  placeholderData:      previousData,
  initialData:          () => seedUser,
  keepPreviousData:     true,            // see below
  suspense:             false,           // see "Suspense + error boundaries"
  useErrorBoundary:     false,           // see "Suspense + error boundaries"
  onSuccess:            (user) => track('user.loaded'),
  onError:              (err)  => report(err),
  onSettled:            (user, err) => {},
});
```

`RetryConfig` (when `retry` is an object):

```typescript
interface RetryConfig {
  attempts:        number;
  initialDelay?:   number;
  maxDelay?:       number;
  backoff?:        'exponential' | 'linear' | 'constant';
  retryCondition?: (error: Error, attempt: number) => boolean;
}
```

### Cache key

In the proxy form the key is `[service, method, ...args]`. Two
components calling the same query share data; one invalidation
refreshes both. In the standalone form you provide the `queryKey`
directly.

### `keepPreviousData`

When the `queryKey` changes (paging, filtering, switching
selection), keep showing the previous key's data while the new
one loads instead of blanking to the loading state. The
carried-over render is flagged with `isPreviousData: true`:

```tsx
function UserPager({ id }: { id: string }) {
  const users = useService<UserService>('users');
  const { data, isPreviousData, isFetching } =
    users.getUser.useQuery([id], { keepPreviousData: true });

  return (
    <div style={{ opacity: isPreviousData ? 0.5 : 1 }}>
      {data?.email}
      {isFetching && <Spinner />}
    </div>
  );
}
```

`isPreviousData` returns to `false` once the new key resolves.
Supported on `useQuery`, `useInfiniteQuery` and per-query in
`useQueries`.

## `useMutation` — for writes

Through the proxy (the `mutationFn` is supplied automatically;
`mutate`'s argument is the method's argument):

```tsx
function InviteForm() {
  const users  = useService<UserService>('users');
  const invite = users.invite.useMutation({
    onSuccess:         (newUser) => toast.success(`Invited ${newUser.email}`),
    invalidateQueries: [['users', 'list']],   // exact option name
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      invite.mutate(new FormData(e.currentTarget).get('email') as string);
    }}>
      <input name="email" />
      <Button disabled={invite.isLoading}>Invite</Button>
    </form>
  );
}
```

`MutationResult` fields:

| Field | Purpose |
| ----- | ------- |
| `mutate(variables)` | Fire-and-forget mutation |
| `mutateAsync(variables)` | Returns a `Promise` of the result |
| `isLoading` | Currently running (**not** `isPending`) |
| `isIdle` / `isSuccess` / `isError` | Status flags |
| `status` | `'idle' \| 'loading' \| 'success' \| 'error'` |
| `data` / `error` / `variables` | Result, error, last variables |
| `context` | Value returned from `onMutate` |
| `reset()` | Clear status back to idle |

Options: `mutationFn` (standalone only), `mutationKey`, `onMutate`,
`onSuccess(data, variables, context)`, `onError(error, variables,
context)`, `onSettled(data, error, variables, context)`, `retry`,
`retryDelay`, and `invalidateQueries: QueryKey[]` (invalidated on
success).

### Optimistic updates

The cache is reached through `client.getQueryCache()` for direct
reads/writes (`get` / `set`), and the client itself exposes the
`*Queries` helpers (`cancelQueries`, `invalidateQueries`):

```tsx
const client = useNetronClient();
const cache  = client.getQueryCache();
const key    = ['users', 'getUser', userId];

const updateProfile = users.updateProfile.useMutation({
  onMutate: async (newProfile) => {
    client.cancelQueries({ queryKey: key });   // QueryFilters, not a bare key
    const previous = cache.get<User>(key);
    if (previous) cache.set(key, { ...previous, ...newProfile });
    return { previous };
  },
  onError: (_err, _newProfile, context) => {
    if (context?.previous) cache.set(key, context.previous); // rollback
  },
  onSettled: () => {
    client.invalidateQueries({ queryKey: key });
  },
});
```

## `useSubscription` — live data

`useSubscription` is a **standalone, event-based** hook (it is not
a method on the service proxy). Subscribe to a named server event
delivered over WebSocket:

```tsx
import { useSubscription } from '@omnitron-dev/netron-react';

function LiveOrders() {
  const { data, history, isConnected, isSubscribed, error } =
    useSubscription<Order>({
      event:  'orders.updated',
      filter: (o) => o.tier === 'pro',
      onData: (o) => console.log('new order', o.id),
    });

  return (
    <div>
      <Status connected={isConnected} />
      <OrderStream items={history} latest={data} />
    </div>
  );
}
```

`SubscriptionResult`: `data` (latest item), `history` (received
items, capped at 100), `isConnected`, `isSubscribed`, `error`,
`unsubscribe()`, `resubscribe()`, `clearHistory()`. Options:
`event` (required), `filter`, `transform`, `buffer` (`{ size,
timeout, strategy }`), `enabled`, `onData`, `onError`, `onConnect`,
`onDisconnect`. Reconnect + re-subscribe on WS drops is handled by
the underlying client.

## `useInfiniteQuery` — pagination

Standalone hook. Supply `queryKey`, a `queryFn` that receives the
typed `pageParam`, `getNextPageParam`, and `initialPageParam`:

```tsx
import { useInfiniteQuery, useNetronClient } from '@omnitron-dev/netron-react';

const client = useNetronClient();
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isPreviousData,
} = useInfiniteQuery<Page, NetronError, string | null>({
  queryKey:         ['feed', category],
  queryFn:          ({ pageParam, signal }) =>
                      client.invoke('feed', 'page', [category, pageParam], { signal }),
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  maxPages:         10,            // optional cap; oldest pages drop out
  keepPreviousData: true,          // keep prior category's pages while switching
});

return (
  <>
    {data?.pages.flatMap(p => p.items).map(item => <Row key={item.id} {...item} />)}
    {hasNextPage && (
      <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
        Load more
      </Button>
    )}
  </>
);
```

`InfiniteQueryResult`: `data` (`{ pages, pageParams }`),
`fetchNextPage()` / `fetchPreviousPage()`, `hasNextPage` /
`hasPreviousPage`, `isFetching` / `isFetchingNextPage` /
`isFetchingPreviousPage`, `status`, `isLoading` / `isError` /
`isSuccess`, `isPreviousData`, `refetch()`. Options also accept
`getPreviousPageParam`, `staleTime`, `cacheTime`, `enabled`,
`retry`, `onSuccess(data)` / `onError`, plus `suspense`,
`useErrorBoundary` and `keepPreviousData` (same semantics as
`useQuery`).

> The infinite-query types (`InfiniteQueryOptions`,
> `InfiniteQueryResult`, `InfiniteData`,
> `InfiniteQueryFunctionContext`) are exported from the package
> root.

## `useQueries` — parallel reads

Standalone hook. Each entry is a **full query config** (`queryKey`
+ `queryFn`, plus any per-query options) — not a
`{ service, method, args }` shape. An optional `combine` reduces
the results into a custom value:

```tsx
import { useQueries, useNetronClient } from '@omnitron-dev/netron-react';

const client  = useNetronClient();
const results = useQueries({
  queries: userIds.map(id => ({
    queryKey:         ['users', 'getUser', id],
    queryFn:          ({ signal }) => client.invoke('users', 'getUser', [id], { signal }),
    keepPreviousData: true,
  })),
});

const users = results.map(r => r.data).filter(Boolean);
```

With `combine`:

```tsx
const { users, posts } = useQueries({
  queries: [
    { queryKey: ['users', 'list'], queryFn: () => client.invoke('users', 'list', []) },
    { queryKey: ['posts', 'list'], queryFn: () => client.invoke('posts', 'list', []) },
  ],
  combine: ([u, p]) => ({ users: u.data ?? [], posts: p.data ?? [] }),
});
```

Each entry is a `QueryObserverResult<T>` (the same shape as
`QueryResult`, including `isPreviousData`); all queries fire in
parallel. `suspense`, `useErrorBoundary` and `keepPreviousData`
are honoured **per query**.

## Suspense + error boundaries

There is **no** `useSuspenseQuery` hook. Suspense is an **option**
on the existing hooks — `suspense: true` makes the hook throw the
in-flight fetch so the nearest `<Suspense>` boundary shows its
fallback until data resolves:

```tsx
function UserName({ id }: { id: string }) {
  const users = useService<UserService>('users');
  // With suspense, data is guaranteed defined past this line.
  const { data } = users.getUser.useQuery([id], { suspense: true });
  return <span>{data!.name}</span>;
}

<Suspense fallback={<Skeleton />}>
  <UserName id={id} />
</Suspense>
```

`useErrorBoundary` re-throws a query error to the nearest React
error boundary instead of returning it in `error`. It takes a
boolean or a predicate `(error) => boolean` for selective
escalation:

```tsx
useQuery({
  queryKey: ['report', id],
  queryFn:  () => client.invoke('reports', 'get', [id]),
  useErrorBoundary: (err) => err.status >= 500,   // escalate only server errors
});
```

Both `suspense` and `useErrorBoundary` are supported on `useQuery`,
`useInfiniteQuery` and per-query in `useQueries`. (When `suspense`
is on, query errors escalate to the error boundary automatically.)

## `useService` — typed proxy

The recommended entry point. Returns a proxy where every method
exposes `.call`, `.useQuery` and `.useMutation`:

```tsx
const users = useService<UserService>('users');

await users.getUser.call(id);                 // direct promise
users.getUser.useQuery([id]);                 // cached query hook
users.invite.useMutation({ onSuccess: ... }); // mutation hook
```

Types flow from the imported interface — no schema sync,
no codegen, no shape drift. (`useInfiniteQuery`, `useQueries` and
`useSubscription` are standalone — see their sections.)

### Custom service hook

```tsx
import { createServiceHook } from '@omnitron-dev/netron-react';

export const useUsers = createServiceHook<UserService>('users');

function Component() {
  const users = useUsers();
  const { data } = users.getUser.useQuery([id]);
}
```

`createServiceHook(name, defaultOptions?)` is `useService` curried
with a service name — useful when many components hit the same
service.

## Authentication

`@omnitron-dev/netron-react/auth` provides an auth context + route
guards. Configure the provider with a `config` block and an
`onLogin` handler that performs the actual sign-in (e.g. by running
your Netron auth core-task) and returns an `AuthResult`:

```tsx
import { AuthProvider, AuthGuard, GuestGuard, useAuth }
  from '@omnitron-dev/netron-react/auth';

function App() {
  return (
    <NetronProvider client={client}>
      <AuthProvider
        config={{
          refreshEndpoint: 'OmnitronAuth.refreshSession',
          logoutEndpoint:  'OmnitronAuth.signOut',
          storage:         'local',           // 'local' | 'session' | 'memory'
          autoRefresh:     true,
          refreshThreshold: 5 * 60_000,
        }}
        onLogin={async (credentials) =>
          client.invoke('OmnitronAuth', 'signIn', [credentials])
        }
        onAuthenticated={(user) => track('auth.login', { id: user.id })}
      >
        <Routes />
      </AuthProvider>
    </NetronProvider>
  );
}

// In components — note login/logout (not signIn/signOut):
function UserMenu() {
  const { user, isAuthenticated, login, logout } = useAuth();
  if (!isAuthenticated) return <Button onClick={() => login({ /* creds */ })}>Sign in</Button>;
  return (
    <Menu>
      <Avatar src={user!.avatarUrl} />
      <MenuItem onClick={() => logout()}>Sign out</MenuItem>
    </Menu>
  );
}
```

`useAuth()` returns `{ isAuthenticated, user, login, logout,
refresh, getAuthHeaders, hasRole, hasPermission, hasAnyRole,
hasAllRoles }`. (`useUser`, `useIsAuthenticated` and
`useAuthRequired` are convenience selectors.)

### Guards

```tsx
// Render children only when authenticated; otherwise show `fallback`
// (and optionally redirect via `redirectTo`):
<AuthGuard fallback={<SignInPrompt />} redirectTo="/sign-in">
  <DashboardLayout />
</AuthGuard>

// Inverse — only for unauthenticated visitors:
<GuestGuard redirectTo="/">
  <SignInPage />
</GuestGuard>

// Role / permission gates:
<RoleGuard role="admin" fallback={<NotAllowed />}>
  <AdminPanel />
</RoleGuard>
<PermissionGuard permission="billing.write">
  <BillingControls />
</PermissionGuard>

// Lightweight conditional rendering:
<Show when={isAuthenticated}><AccountMenu /></Show>
<Hide when={isAuthenticated}><SignInButton /></Hide>
```

Exported guards: `AuthGuard`, `GuestGuard`, `RoleGuard`,
`PermissionGuard`, `Show`, `Hide`.

## Multi-backend support

When the app talks to several Netron servers — e.g., one for
identity, one for media, one for analytics — use
`createMultiBackendClient` (from **netron-browser**) +
`MultiBackendProvider`:

```tsx
import { createMultiBackendClient }
  from '@omnitron-dev/netron-browser';
import { MultiBackendProvider, useBackendService }
  from '@omnitron-dev/netron-react';

// `backends` keys → path prefixes under `baseUrl`; `routing`
// maps service-name patterns to a specific backend.
const client = createMultiBackendClient({
  baseUrl: 'https://api.example.com',
  backends: {
    auth:      { path: '/auth',      transport: 'http' },
    media:     { path: '/media',     transport: 'http' },
    analytics: { path: '/analytics', transport: 'http' },
  },
  routing: {
    patterns: [
      { pattern: 'users.',   backend: 'auth' },
      { pattern: 'objects.', backend: 'media' },
      { pattern: 'reports.', backend: 'analytics' },
    ],
  },
});

function App() {
  return (
    <MultiBackendProvider client={client}>
      <Routes />
    </MultiBackendProvider>
  );
}

// Use a specific backend:
function Component() {
  const users = useBackendService<UserService>('auth', 'users');
  const { data } = users.getUser.useQuery([id]);
}
```

`MultiBackendClientOptions` also accepts `defaultBackend` and a
`shared` block (timeout / headers / auth applied to all backends);
`routing` supports `patterns` and explicit `services` maps.

### Backend-aware hooks

| Hook | Purpose |
| ---- | ------- |
| `useBackend(name)` | Get the typed backend client by name |
| `useBackendConnectionState(name)` | Per-backend connection state |
| `useBackendService(backend, service)` | Typed service from a specific backend |
| `useBackendQuery(backend, query)` | Query against a specific backend |
| `useBackendMutation(backend, mutation)` | Mutation against a specific backend |
| `useAllBackendsConnected()` | True iff all backends connected |
| `useAnyBackendConnected()` | True iff at least one connected |

### Backend-aware components

```tsx
// Only render children when this backend is connected:
<RequireBackendConnection backend="media">
  <UploadForm />
</RequireBackendConnection>

// Branch based on connection:
<BackendConnectionAware backend="analytics">
  {({ isConnected, isConnecting, error }) =>
    isConnected ? <Reports /> :
    isConnecting ? <Spinner /> :
    <ErrorCard error={error} />
  }
</BackendConnectionAware>

// Render only when ALL listed backends are connected:
<RequireAllBackends backends={['auth', 'media']}>
  <Dashboard />
</RequireAllBackends>

// Or ANY:
<RequireAnyBackend backends={['auth-primary', 'auth-backup']}>
  <SignInButton />
</RequireAnyBackend>

// Status indicator:
<BackendStatus backend="analytics" />
```

## Connection-aware rendering (single backend)

```tsx
import { ConnectionAware, RequireConnection } from '@omnitron-dev/netron-react';

<ConnectionAware>
  {({ isConnected, isConnecting, error, reconnect }) =>
    isConnected ? <App /> :
    isConnecting ? <Spinner /> :
    <Disconnected error={error} onReconnect={reconnect} />
  }
</ConnectionAware>

<RequireConnection fallback={<OfflineBanner />}>
  <SensitivePage />
</RequireConnection>
```

## Cache management

The **client** exposes the broad-stroke cache operations; the
`QueryCache` (via `client.getQueryCache()`) exposes per-key
reads/writes.

```tsx
import { useNetronClient } from '@omnitron-dev/netron-react';

function AdminControls() {
  const client = useNetronClient();

  return (
    <>
      <Button onClick={() => client.invalidateQueries({ queryKey: ['users'] })}>
        Refresh users
      </Button>
      <Button onClick={() => client.removeQueries({ queryKey: ['users'] })}>
        Clear users cache
      </Button>
      <Button onClick={() => client.clear()}>
        Clear ALL cache
      </Button>
    </>
  );
}
```

Client methods:

| Method | Effect |
| ------ | ------ |
| `invalidateQueries(filters?)` | Mark matching queries stale; subscribed components refetch |
| `removeQueries(filters?)` | Drop matching queries from cache |
| `cancelQueries(filters?)` | Abort in-flight matching queries |
| `prefetchQuery(queryKey, fetcher, { staleTime? })` | Warm the cache without rendering (dedups against in-flight) |
| `clear()` | Drop everything |
| `getQueryCache()` / `getMutationCache()` | The underlying caches |
| `getQueryState(queryKey)` | Read a query's full state |
| `dehydrate()` / `hydrate(state)` | SSR (see below) |

`QueryCache` methods (for direct reads/writes in `onMutate`):

| Method | Effect |
| ------ | ------ |
| `get(queryKey)` | Read cached data without subscribing |
| `set(queryKey, data, staleTime?)` | Write to cache |
| `invalidate(queryKey)` | Mark one key stale |
| `remove(queryKey)` | Drop one key |
| `findAll(filters?)` | List matching queries |
| `cancelAll(filters?)` | Abort matching in-flight queries |
| `subscribe(queryKey, observer, cacheTime?)` | Low-level change subscription |

Filters are a `QueryFilters` object — `{ queryKey?, exact?,
status?, stale?, fetching?, predicate? }` — **not** a bare key
array. Partial key matching is the default:

```tsx
client.invalidateQueries({ queryKey: ['users'] });                       // every users query
client.invalidateQueries({ queryKey: ['users', 'getUser'] });            // every getUser
client.invalidateQueries({ queryKey: ['users', 'getUser', id], exact: true }); // one
client.invalidateQueries({ stale: true });                               // every stale query
```

## SSR support

```tsx
// On the server, after running your queries:
const dehydratedState = client.dehydrate();   // synchronous; returns DehydratedState

// Serialize `dehydratedState` into the HTML, then on the client:
const client = createNetronClient({ url });
client.hydrate(dehydratedState);               // a method call, not a config field
```

Set `ssr: { enabled: true, dehydrateTimeout? }` on the client
config for SSR mode. `useHydration()` exposes the hydration flag
for components that must avoid a hydration mismatch on first
render.

## State management

`netron-react` does **not** ship a general-purpose state library.
(An earlier unexported `state/` atom module was removed — there is
no `@omnitron-dev/netron-react/state` subpath.) For local UI state
use React's own primitives; for app-level stores prefer Prism's
`createStore` from `@omnitron-dev/prism/state` (version-aware
persistence). Server state belongs in the query cache, not a
separate store.

## Devtools

```tsx
import { NetronDevtools } from '@omnitron-dev/netron-react/devtools';
```

> **Scaffolded, not yet rendering.** `NetronDevtools` is currently
> a placeholder that renders `null` (full panel implementation is
> pending). The `/devtools` subpath also exports the logging
> helpers (`setLogger`, `getLogger`, `setLogLevel`, `log`) and the
> `DevToolsConfig` type. Don't rely on a visual devtools panel
> yet.

## Testing

`@omnitron-dev/netron-react/test` ships an in-memory test
provider + mock helpers (no real WebSocket / fetch):

```tsx
import { TestNetronProvider, createMockService, createWrapper }
  from '@omnitron-dev/netron-react/test';

const users = createMockService<UserService>('users', {
  getUser: async (id) => ({ id, email: 'a@b.c' }),
});

render(
  <TestNetronProvider services={[users]}>
    <UserCard userId="1" />
  </TestNetronProvider>
);

await screen.findByText('a@b.c');
```

Also exported: `createTestClient`, `createWrapper` (a
`renderHook` wrapper), the query helpers `waitForQuery` /
`createQueryKey`, the assertion helpers `expectLoading` /
`expectSuccess` / `expectError`, and timer utilities
`advanceTimersAndFlush` / `nextTick`.

## Subpaths

The package exposes exactly these entry points:

| Subpath | Contents |
| ------- | -------- |
| `@omnitron-dev/netron-react` | Root — client, provider, all hooks, cache classes, multi-backend, context hooks |
| `@omnitron-dev/netron-react/hooks` | The hooks in isolation (`useQuery`, `useMutation`, …) |
| `@omnitron-dev/netron-react/cache` | `QueryCache`, `MutationCache`, `SubscriptionManager`, key utilities |
| `@omnitron-dev/netron-react/auth` | `AuthProvider`, `useAuth`, guards (`AuthGuard`, `GuestGuard`, `RoleGuard`, `PermissionGuard`, `Show`, `Hide`) |
| `@omnitron-dev/netron-react/devtools` | `NetronDevtools` (placeholder) + logging helpers |
| `@omnitron-dev/netron-react/test` | `TestNetronProvider`, `createMockService`, test utilities |

`NetronReactClient`, `MultiBackendProvider`, the multi-backend
hooks and `useService` are all on the **root** entry — there is no
`/core`, `/service`, `/multi-backend` or `/state` subpath.

## Best practices

- **Prefer `useService` over raw `useQuery`.** Types flow from
  the interface; refactors are safe.
- **One client per backend.** Treat as long-lived singletons —
  recreating on render destroys cache and connection.
- **Invalidate with the broadest sensible filter.** Mutations that
  affect multiple views should `invalidateQueries({ queryKey })`
  at the broadest shared prefix.
- **Use `select` to extract slices.** Reduces re-renders when
  only part of `data` changes.
- **`keepPreviousData`** for paging/filtering so the UI doesn't
  flash empty between keys.
- **Optimistic updates** for fast feedback; roll back in
  `onError`; invalidate in `onSettled`.
- **`enabled: false`** for conditional queries — better than an
  early return from the component (preserves cache + hook order).

## Anti-patterns

- **Calling `useQuery` inside loops/conditionals.** React hooks
  rules — use `useQueries` for a dynamic set.
- **Storing query results in component state.** Defeats cache
  sharing; read from the cache instead.
- **Reaching for a `useSuspenseQuery` hook.** It doesn't exist —
  pass `suspense: true` to `useQuery`.
- **Passing a bare key array to `invalidateQueries`.** It takes a
  `QueryFilters` object: `{ queryKey: [...] }`.
- **Custom retry on top of provider retry.** Doubled retries
  amplify failure load.
- **Mounting `<MultiBackendProvider>` per route.** It's app-level
  state — mount once at the root.
- **Polling instead of `useSubscription`** when the server emits
  the event. Subscriptions are cheaper and more responsive.

## See also

- [netron-browser](./browser.md) — the underlying transport
- [Caching](./caching.md) — cache internals + invalidation
- [SSR](./ssr.md) — server rendering + hydration
- [Testing](./testing.md) — the test provider + mocks
- [Multi-backend](./multi-backend.md) — multi-server routing
- [Prism](../prism/index.md) — UI components that pair with these hooks
- [Frontend overview](../overview.md) — the three-package picture
