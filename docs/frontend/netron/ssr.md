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
    ssr:       { enabled: true },
  });
  await client.connect();

  // Prefetch everything the page needs:
  const users    = client.service<UserService>('users');
  const projects = client.service<ProjectService>('projects');
  await client.prefetchQuery(['users', 'list', { filter: 'active' }], () => users.list.call({ filter: 'active' }));
  await client.prefetchQuery(['projects', 'getMine'], () => projects.getMine.call());

  const dehydratedState = client.dehydrate();

  return { dehydratedState };
}

// client-side root:
function App({ dehydratedState }: { dehydratedState: DehydratedState }) {
  const [client] = useState(() => {
    const c = new NetronReactClient({ url: '/api', transport: 'auto' });
    c.hydrate(dehydratedState);    // populate cache from server
    return c;
  });

  return (
    <NetronProvider client={client}>
      <Outlet />
    </NetronProvider>
  );
}
```

The server's `dehydrate()` returns a plain-object snapshot of
the cache (synchronously — no `await`). The client's `hydrate()`
method populates the fresh client's cache from that snapshot.

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
sections; pass `{ suspense: true }` to `useQuery` and it
integrates cleanly.

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
    dehydratedState: client.dehydrate(),
  };
}
```

Server-side prefetch carries the user's token; the dehydrated
cache is specific to that user. Don't share dehydrated state
across users — leak risk.

## Excluding queries from dehydration

`dehydrate()` takes no arguments — it automatically dehydrates
only **successful** queries. Errored / in-flight queries are
skipped so the client retries fresh, and mutation state is
request-local. To keep sensitive entries out of the snapshot,
remove them from the cache before dehydrating:

```typescript
// Drop sensitive queries before serialising:
client.removeQueries({ queryKey: ['admin'] });
client.removeQueries({ queryKey: ['tokens'] });

const dehydratedState = client.dehydrate();
```

## Bundle size considerations

The SSR client is identical to the browser client — there's no
separate "server" build. If you're SSR-targeting workers /
edge runtimes:

- HTTP transport only (no WebSocket on edge).
- `transport: 'http'` explicitly to avoid the WebSocket bundle.
- Skip persistent `AuthenticationClient` storage (no localStorage
  on edge); use cookie-based auth (`CookieClientTokenTransport` +
  `NoopTokenStorage`).

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
- **`client.hydrate()` without a matching server prefetch.** The
  cache is empty; you've added complexity for nothing.

## See also

- [Caching](./caching.md) — `dehydrate` / `prefetchQuery`
- [netron-react](./react.md) — `useQuery` SSR semantics
- [Transports](./transports.md) — HTTP for edge runtimes
