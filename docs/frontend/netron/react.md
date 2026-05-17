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
devtools.

> **Install only if your frontend uses React.** For Vue / Svelte
> / Solid / Angular / Lit / vanilla JS — use
> [`netron-browser`](./browser.md) directly and wrap calls in
> your framework's reactivity primitives.
>
> **Don't confuse with server-side Netron** at
> `@omnitron-dev/titan/netron` — that's part of the Titan
> framework. This package consumes the server through
> `netron-browser`.

Verified against `packages/netron-react/src/`.

```bash
pnpm add @omnitron-dev/netron-react @omnitron-dev/netron-browser
```

`netron-browser` is a peer dependency — install both.

## Provider

```tsx
import { NetronReactClient, NetronProvider } from '@omnitron-dev/netron-react';

const client = new NetronReactClient({
  url:       'https://api.example.com',
  transport: 'auto',                       // 'http' | 'websocket' | 'auto'
  cache: {
    defaultStaleTime: 30_000,
    defaultGcTime:    5 * 60_000,
  },
  retry:    { maxAttempts: 3 },
  defaults: { queryOptions: { refetchOnWindowFocus: true } },
});

function App() {
  return (
    <NetronProvider client={client}>
      <Outlet />
    </NetronProvider>
  );
}
```

`NetronReactClient` wraps a `NetronClient` (from netron-browser)
and adds the query/mutation cache + React integration glue.

## Hooks at a glance

| Hook | Purpose |
| ---- | ------- |
| `useQuery` | Cached data fetching from a service method |
| `useMutation` | Mutating call with invalidation + optimistic updates |
| `useSubscription` | Live WebSocket subscription synced to React state |
| `useService` | Typed service proxy with per-method `.useQuery` / `.useMutation` |
| `useInfiniteQuery` | Paginated / cursor-based queries |
| `useQueries` | Parallel queries — multiple methods at once |

Plus:

| Hook | Purpose |
| ---- | ------- |
| `useNetronClient` / `useNetronClientSafe` | Access the raw client from context |
| `useNetronConnection` | Reactive connection state |
| `useDefaults` | Read provider-level defaults |
| `useHydration` | SSR hydration state |

## `useQuery` — the workhorse

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
  return <div>{data.email}</div>;
}
```

What you get back:

```typescript
interface QueryResult<T> {
  data:        T | undefined;
  error:       Error | null;
  status:      'idle' | 'loading' | 'success' | 'error';
  isLoading:   boolean;
  isSuccess:   boolean;
  isError:     boolean;
  isFetching:  boolean;        // true also when refetching cached
  isStale:     boolean;
  dataUpdatedAt: number;
  refetch:     () => Promise<void>;
}
```

### Query options

```tsx
users.getUser.useQuery([userId], {
  enabled:                 userId != null,
  staleTime:               30_000,
  gcTime:                  5 * 60_000,
  refetchOnWindowFocus:    true,
  refetchOnReconnect:      true,
  refetchInterval:         60_000,
  retry:                   { maxAttempts: 3 },
  select:                  (user) => user.email,
  placeholderData:         previousData,
  onSuccess:               (user) => track('user.loaded'),
  onError:                 (err)  => report(err),
});
```

### Cache key

Generated from `[service, method, args]`. Two components calling
the same query share data; one invalidation refreshes both.

## `useMutation` — for writes

```tsx
function InviteForm() {
  const users = useService<UserService>('users');
  const invite = users.invite.useMutation({
    onSuccess:  (newUser) => toast.success(`Invited ${newUser.email}`),
    invalidate: [['users', 'list']],
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      invite.mutate(new FormData(e.currentTarget).get('email') as string);
    }}>
      <input name="email" />
      <Button disabled={invite.isPending}>Invite</Button>
    </form>
  );
}
```

| Field | Purpose |
| ----- | ------- |
| `mutate(args)` | Fire-and-forget mutation |
| `mutateAsync(args)` | Returns a Promise of the result |
| `isPending` | Currently running |
| `isSuccess` / `isError` | Terminal state |
| `data` / `error` | Result |
| `reset()` | Clear status |

### Optimistic updates

```tsx
const updateProfile = users.updateProfile.useMutation({
  onMutate: async (newProfile) => {
    await cache.cancelQueries(['users', 'getUser', userId]);
    const previous = cache.getQueryData(['users', 'getUser', userId]);
    cache.setQueryData(['users', 'getUser', userId], (old) => ({ ...old, ...newProfile }));
    return { previous };
  },
  onError: (err, _newProfile, context) => {
    // Rollback
    if (context?.previous) {
      cache.setQueryData(['users', 'getUser', userId], context.previous);
    }
  },
  onSettled: () => {
    cache.invalidateQueries(['users', 'getUser', userId]);
  },
});
```

## `useSubscription` — live data

For service methods returning `AsyncIterable` (server-side
streaming) over WebSocket:

```tsx
function LiveOrders() {
  const orders = useService<OrderService>('orders');
  const { events, isConnected, error } = orders.watchAll.useSubscription([{ tier: 'pro' }]);

  return (
    <div>
      <Status connected={isConnected} />
      <OrderStream events={events} />
    </div>
  );
}
```

Auto-reconnects with exponential backoff on WS drops;
re-subscribes transparently.

## `useInfiniteQuery` — pagination

```tsx
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = users.list.useInfiniteQuery({
  initialPageParam: { cursor: null },
  getNextPageParam: (lastPage) => lastPage.nextCursor ? { cursor: lastPage.nextCursor } : undefined,
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

## `useQueries` — parallel reads

```tsx
const results = useQueries({
  queries: userIds.map(id => ({
    service: 'users',
    method:  'getUser',
    args:    [id],
  })),
});

const users = results.map(r => r.data).filter(Boolean);
```

Each entry is a `QueryResult<T>`; the overall list is parallel —
all fire at once.

## `useService` — typed proxy

The recommended entry point. Returns a proxy where every method
exposes `.useQuery` / `.useMutation` / `.useSubscription`:

```tsx
const users = useService<UserService>('users');

users.getUser.useQuery([id]);
users.invite.useMutation({ onSuccess: ... });
users.watchAll.useSubscription([{ tier: 'pro' }]);
```

Types flow from the imported interface — no schema sync,
no codegen, no shape drift.

### Custom service hook

```tsx
import { createServiceHook } from '@omnitron-dev/netron-react';

export const useUsers = createServiceHook<UserService>('users');

function Component() {
  const users = useUsers();
  const { data } = users.getUser.useQuery([id]);
  // ...
}
```

`createServiceHook` is just `useService` curried with a service
name — useful when many components hit the same service.

## Authentication

`@omnitron-dev/netron-react/auth` provides full auth UI patterns:

```tsx
import { AuthProvider, AuthGuard, GuestGuard, useAuth }
  from '@omnitron-dev/netron-react/auth';

const client = new NetronReactClient({
  url:  'https://api.example.com',
  auth: {
    signInMethod:     'OmnitronAuth.signIn',
    refreshMethod:    'OmnitronAuth.refreshSession',
    signOutMethod:    'OmnitronAuth.signOut',
    storage:          'localStorage',
    inactivityTimeout: 30 * 60_000,
  },
});

function App() {
  return (
    <NetronProvider client={client}>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </NetronProvider>
  );
}

// Protect routes:
<Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
  <Route path="/" element={<Dashboard />} />
</Route>

<Route element={<GuestGuard><AuthLayout /></GuestGuard>}>
  <Route path="/sign-in" element={<SignInPage />} />
</Route>

// In components:
function UserMenu() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  if (!isAuthenticated) return <Button onClick={signIn}>Sign in</Button>;
  return (
    <Menu>
      <Avatar src={user.avatarUrl} />
      <MenuItem onClick={signOut}>Sign out</MenuItem>
    </Menu>
  );
}
```

`<AuthGuard>` redirects unauthenticated users to `/sign-in`;
`<GuestGuard>` redirects authenticated users to `/`. Both
configurable via props.

## Multi-backend support

When the app talks to several Netron servers — e.g., one for
identity, one for media, one for analytics — use
`MultiBackendProvider`:

```tsx
import { createMultiBackendClient }
  from '@omnitron-dev/netron-browser';
import { MultiBackendProvider, useBackendService }
  from '@omnitron-dev/netron-react';

// 1. Build a client. `backends` keys → path prefixes under
//    `baseUrl`; `routing` maps service-name patterns to a
//    specific backend.
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

// 2. Pass the client (not the backend map) to the provider.
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

```tsx
import { useNetronClient } from '@omnitron-dev/netron-react';

function AdminControls() {
  const client = useNetronClient();
  const cache  = client.getQueryCache();

  return (
    <>
      <Button onClick={() => cache.invalidateQueries(['users'])}>
        Refresh users
      </Button>
      <Button onClick={() => cache.removeQueries(['users'])}>
        Clear users cache
      </Button>
      <Button onClick={() => cache.clear()}>
        Clear ALL cache
      </Button>
    </>
  );
}
```

Cache API:

| Method | Effect |
| ------ | ------ |
| `getQueryData(key)` | Read cached data without subscribing |
| `setQueryData(key, data)` | Write to cache (useful in mutation `onMutate`) |
| `invalidateQueries(filter)` | Mark stale; trigger refetch in subscribed components |
| `removeQueries(filter)` | Drop from cache |
| `cancelQueries(filter)` | Abort in-flight queries |
| `prefetchQuery(args)` | Warm the cache without rendering |
| `clear()` | Drop everything |

Query keys support pattern matching:

```tsx
cache.invalidateQueries(['users']);              // every users query
cache.invalidateQueries(['users', 'getUser']);   // every getUser
cache.invalidateQueries(['users', 'getUser', id]); // one specific
```

## SSR support

```tsx
// On the server:
const dehydratedState = await client.dehydrate();

// Send dehydratedState to the browser; on hydration:
const client = new NetronReactClient({ url, hydratedState: dehydratedState });
```

`useHydration` exposes the hydration flag for components that
need to avoid mismatch during the first render.

## State management

`@omnitron-dev/netron-react/state` ships lightweight atoms +
store helpers compatible with React 18 concurrent rendering:

```tsx
import { atom, useAtom } from '@omnitron-dev/netron-react/state';

const sidebarOpenAtom = atom(true);

function Sidebar() {
  const [open, setOpen] = useAtom(sidebarOpenAtom);
  return <Drawer open={open} onClose={() => setOpen(false)} />;
}
```

For app-level stores, prefer Prism's `createStore` from
`@omnitron-dev/prism/state` — same idea with version-aware
persistence.

## Devtools

```tsx
import { NetronDevtools } from '@omnitron-dev/netron-react/devtools';

function App() {
  return (
    <NetronProvider client={client}>
      <Outlet />
      {process.env.NODE_ENV === 'development' && <NetronDevtools position="bottom-right" />}
    </NetronProvider>
  );
}
```

Shows:
- In-flight queries / mutations.
- Cache contents per key.
- Connection state per backend.
- Middleware chain per call.
- Query timing & retry attempts.

## Testing

`@omnitron-dev/netron-react/test` ships a `MockProvider`:

```tsx
import { MockProvider, mockService } from '@omnitron-dev/netron-react/test';

const services = mockService<UserService>('users', {
  getUser: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.c' }),
});

render(
  <MockProvider services={[services]}>
    <UserCard userId="1" />
  </MockProvider>
);

await screen.findByText('a@b.c');
expect(services.getUser).toHaveBeenCalledWith('1');
```

No real WebSocket / fetch — the mock fakes the entire transport.

## Subpaths

| Subpath | Contents |
| ------- | -------- |
| `@omnitron-dev/netron-react` | Root — everything |
| `@omnitron-dev/netron-react/core` | `NetronReactClient`, `NetronProvider`, context hooks |
| `@omnitron-dev/netron-react/hooks` | `useQuery`, `useMutation`, `useSubscription`, etc. |
| `@omnitron-dev/netron-react/service` | `useService`, `createServiceHook` |
| `@omnitron-dev/netron-react/cache` | `QueryCache`, `MutationCache` |
| `@omnitron-dev/netron-react/multi-backend` | `MultiBackendProvider`, per-backend hooks |
| `@omnitron-dev/netron-react/auth` | `AuthProvider`, `useAuth`, `<AuthGuard>`, `<GuestGuard>` |
| `@omnitron-dev/netron-react/state` | atoms, stores |
| `@omnitron-dev/netron-react/devtools` | `<NetronDevtools>` |
| `@omnitron-dev/netron-react/middleware` | React-specific middleware (cache tags, suspense) |
| `@omnitron-dev/netron-react/test` | `MockProvider`, mocking helpers |

## Suspense + concurrent mode

```tsx
const { data } = users.getUser.useSuspenseQuery([id]);
// throws Promise → caught by <Suspense>; never returns undefined
```

The suspense variant skips the `isLoading` branch — wrap in
`<Suspense fallback={<Skeleton />}>` at the page level.

## Best practices

- **Prefer `useService` over raw `useQuery`.** Types flow from
  the interface; refactors are safe.
- **One client per backend.** Treat as long-lived singletons —
  recreating on render destroys cache and connection.
- **Invalidate by tag, not key.** Mutations that affect multiple
  views should invalidate at the broadest sensible scope.
- **Use `select` to extract slices.** Reduces re-renders when
  only part of `data` changes.
- **Optimistic updates** for fast user feedback; rollback in
  `onError`; invalidate in `onSettled`.
- **`enabled: false`** for conditional queries — better than
  early return from the component (preserves cache).

## Anti-patterns

- **Calling `useQuery` inside loops conditionally.** React
  hooks rules — use `useQueries` instead.
- **Storing query results in component state.** Defeats cache
  sharing; use the cache directly.
- **Skipping `<AuthGuard>` on protected routes.** Per-component
  auth checks drift over time.
- **Custom retry on top of provider retry.** Doubled retries
  amplify failure load.
- **Mounting `<MultiBackendProvider>` per route.** It's app-level
  state — mount once at the root.
- **Polling instead of `useSubscription`** when the server
  exposes streaming. Subscriptions are cheaper and more
  responsive.

## See also

- [netron-browser](./browser.md) — the underlying transport
- [Prism](../prism/index.md) — UI components that pair with these hooks
- [Frontend overview](../overview.md) — the three-package picture
- [Console](../../omnitron/console.md) — real production app using these hooks
