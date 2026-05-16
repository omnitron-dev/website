---
sidebar_position: 11
title: SSR
description: Server-side rendering — dehydrate / hydrate, hydration safety.
---

# SSR

netron-react supports server-side rendering by serialising the
QueryCache on the server and rehydrating on the client.

## Pattern — Next.js / Remix style

```tsx
// server-side route loader:
export async function loader(req) {
  const client = new NetronReactClient({
    url:       process.env.API_URL,
    transport: 'http',
  });
  await client.connect();

  // Prefetch everything the page needs:
  const cache = client.getQueryCache();
  await cache.prefetchQuery({ service: 'users',    method: 'list',    args: [{ filter: 'active' }] });
  await cache.prefetchQuery({ service: 'projects', method: 'getMine', args: [] });

  const dehydratedState = cache.dehydrate();

  return { dehydratedState };
}

// client-side root:
function App({ dehydratedState }: { dehydratedState: DehydratedState }) {
  const [client] = useState(() => new NetronReactClient({
    url:            '/api',
    transport:      'auto',
    hydratedState:  dehydratedState,    // populate cache from server
  }));

  return (
    <NetronProvider client={client}>
      <Outlet />
    </NetronProvider>
  );
}
```

The server's `dehydrate()` returns a plain-object snapshot of
the cache. The client's `hydratedState` option populates the
fresh client's cache from that snapshot.

## Hydration semantics

After hydration:
- Cached queries from the server **don't** refetch on mount
  (until they go stale per `staleTime`).
- Subscriptions don't carry over — they re-subscribe on the
  client side.
- Mutation state isn't dehydrated (it's request-local).

```tsx
useQuery(['users','list', { filter: 'active' }], {
  staleTime: 30_000,
  // Server-fetched + dehydrated; client mount won't refetch unless > 30s stale.
});
```

## `useHydration`

When client-side rendering needs to **branch** on whether
hydration has completed:

```tsx
import { useHydration } from '@omnitron-dev/netron-react';

function ColorMode() {
  const isHydrated = useHydration();
  const mode = useColorMode();

  // Avoid hydration mismatch by deferring colour-mode-dependent UI:
  if (!isHydrated) return null;

  return <Icon name={mode === 'dark' ? 'sun' : 'moon'} />;
}
```

Useful for any UI that depends on browser-only state (localStorage,
`window.matchMedia`, etc.) — render `null` until hydrated to
avoid SSR/client divergence.

## Streaming SSR

```tsx
// Next.js 13+ / React 19 server components:
import { renderToReadableStream } from 'react-dom/server';

const stream = await renderToReadableStream(<App />, {
  onError: console.error,
});
```

For streaming, prefer `<Suspense>` boundaries around data-bound
sections; `useSuspenseQuery` integrates cleanly.

## Per-user dehydration

```typescript
async function loader(req) {
  const authToken = req.cookies.get('session');

  const client = new NetronReactClient({
    url: process.env.API_URL,
    headers: { Authorization: `Bearer ${authToken}` },
  });

  // ... prefetch ...

  return {
    dehydratedState: client.getQueryCache().dehydrate(),
  };
}
```

Server-side prefetch carries the user's token; the dehydrated
cache is specific to that user. Don't share dehydrated state
across users — leak risk.

## Excluding queries from dehydration

```typescript
const dehydratedState = cache.dehydrate({
  shouldDehydrateQuery: (query) => {
    // Skip mutations and sensitive queries:
    if (query.queryKey[0] === 'admin') return false;
    if (query.queryKey[0] === 'tokens') return false;
    return query.state.status === 'success';
  },
});
```

By default, only successful queries dehydrate. Errored / in-flight
queries are skipped so the client retries fresh.

## Bundle size considerations

The SSR client is identical to the browser client — there's no
separate "server" build. If you're SSR-targeting workers /
edge runtimes:

- HTTP transport only (no WebSocket on edge).
- `transport: 'http'` explicitly to avoid the WebSocket bundle.
- Skip `AuthManager` (no localStorage on edge); use cookie-
  based auth.

## Caveats

- **Subscriptions don't persist.** Server-side they aren't
  initiated; client takes over.
- **Optimistic mutations** in flight at dehydration time are
  lost — let them complete first.
- **Time-sensitive data** (clocks, "X minutes ago") needs
  `suppressHydrationWarning` on the wrapper element or
  `useHydration`-gated rendering.

## Best practices

- **Prefetch above-the-fold data.** Don't dehydrate the whole
  app — pick the queries that fill the initial render.
- **Per-user clients.** Don't reuse a server-side client
  across requests.
- **`staleTime > 0` for dehydrated queries.** Otherwise the
  client refetches immediately, defeating SSR.
- **`useHydration` for browser-only UI.** Theme toggle, geolocation,
  feature flags — gate them.

## Anti-patterns

- **Sharing a dehydrated cache across users.** Leaks data.
- **Streaming WebSocket on the server.** WS doesn't work
  pre-hydration; the cache rehydrates, but live subscriptions
  start on the client.
- **`hydratedState` without a matching server prefetch.** The
  cache is empty; you've added complexity for nothing.

## See also

- [Caching](./caching.md) — `dehydrate` / `prefetchQuery`
- [netron-react](./react.md) — `useQuery` SSR semantics
- [Transports](./transports.md) — HTTP for edge runtimes
