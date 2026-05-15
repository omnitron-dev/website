---
sidebar_position: 4
title: netron-react
---

# netron-react

Production-grade React bindings for Netron. Type-safe hooks, query and
mutation cache, real-time subscriptions, devtools.

## Install

```bash
pnpm add @omnitron-dev/netron-react @omnitron-dev/netron-browser
```

## Provider

```tsx
import { NetronProvider } from '@omnitron-dev/netron-react';
import { NetronClient }   from '@omnitron-dev/netron-browser';

const client = new NetronClient({ url: '/api' });

export function App() {
  return (
    <NetronProvider client={client}>
      <Routes />
    </NetronProvider>
  );
}
```

## Queries

```tsx
import { useNetronQuery } from '@omnitron-dev/netron-react';
import type { UsersService } from '@my/contracts';

function UserCard({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useNetronQuery(
    UsersService,
    'findById',
    [id],
  );

  if (isLoading) return <Spinner />;
  if (error)     return <Error error={error} retry={refetch} />;

  return <h3>{data?.email}</h3>;
}
```

The hook returns `data` typed as the **return type of `findById`**. No
codegen, no schema file — the TypeScript type comes from the imported
service interface.

## Mutations

```tsx
import { useNetronMutation } from '@omnitron-dev/netron-react';

function InviteForm() {
  const invite = useNetronMutation(UsersService, 'invite', {
    onSuccess: (user) => toast.success(`Invited ${user.email}`),
    invalidate: [['users', 'list']],
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      invite.run(new FormData(e.currentTarget).get('email') as string);
    }}>
      <input name="email" />
      <button disabled={invite.isLoading}>Invite</button>
    </form>
  );
}
```

`invalidate` re-fetches the listed query keys after the mutation
succeeds.

## Subscriptions

For methods that return an `AsyncIterable` (server-side streaming):

```tsx
import { useNetronSubscription } from '@omnitron-dev/netron-react';

function LiveOrders() {
  const { events } = useNetronSubscription(OrdersService, 'watchAll', []);
  return <Stream events={events} />;
}
```

Subscriptions automatically reconnect with exponential backoff on
WebSocket drops.

## Cache

Queries are cached by `[service, method, args]` and shared across
components. Manual control:

```tsx
const cache = useNetronCache();
cache.invalidate(['users', 'list']);
cache.set(['users', 'findById', id], updatedUser);
cache.subscribe(['users', 'list'], (data) => { /* … */ });
```

## Devtools

```tsx
import { NetronDevtools } from '@omnitron-dev/netron-react/devtools';

<NetronDevtools position="bottom-right" />
```

Shows in-flight requests, cache contents, and middleware chains.

## Subpaths

| Subpath        | Contents                                                |
| -------------- | ------------------------------------------------------- |
| `hooks`        | useNetronQuery, useNetronMutation, useNetronSubscription |
| `state`        | NetronProvider, useNetronCache                          |
| `auth`         | useAuth, login/logout flows                             |
| `cache`        | Cache primitives if you don't use the provider          |
| `devtools`     | NetronDevtools panel                                    |
| `test`         | Mock provider for unit and integration tests            |

## Read also

- [Prism](./prism.md) — bound blocks (`DataTable`, `Form`) compose with
  these hooks.
