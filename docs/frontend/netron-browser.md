---
sidebar_position: 3
title: netron-browser
---

# netron-browser

Browser-optimised Netron RPC client. Speaks HTTP and WebSocket against
a Titan service with full TypeScript types.

## Install

```bash
pnpm add @omnitron-dev/netron-browser
```

## Use

```typescript
import { NetronClient } from '@omnitron-dev/netron-browser';
import type { UsersService } from '@my/contracts';

const client = new NetronClient({
  url: '/api',                    // Same-origin or absolute
  transport: 'http',              // 'http' | 'websocket' | 'auto'
});

const users = await client.queryInterface<UsersService>('users@1.0.0');
const user  = await users.findById('u_42');
```

## Transports

### HTTP

The default. One request per call. Works through any reverse proxy,
no special routing required.

### WebSocket

For subscriptions and bidirectional streaming. The same service
interface is reachable over WS once the server exposes that transport:

```typescript
const wsClient = new NetronClient({
  url: 'wss://api.example.com',
  transport: 'websocket',
});
```

### Auto

Picks WebSocket if the service exposes streaming methods, HTTP otherwise.

## Middleware

Middleware runs around every call:

```typescript
const client = new NetronClient({
  url: '/api',
  middleware: [
    AuthBearerMiddleware(() => localStorage.getItem('token')),
    RetryMiddleware({ maxAttempts: 3, on: ['network', '5xx'] }),
    LoggingMiddleware,
  ],
});
```

Custom middleware:

```typescript
const TimingMiddleware: NetronMiddleware = async (ctx, next) => {
  const start = performance.now();
  try {
    return await next();
  } finally {
    console.debug(`${ctx.service}.${ctx.method}`, performance.now() - start);
  }
};
```

## Errors

Server-side `NetronError` subclasses arrive as the same class on the
client:

```typescript
import { NotFoundError, UnauthorizedError } from '@omnitron-dev/netron-browser';

try {
  await users.findById('missing');
} catch (e) {
  if (e instanceof NotFoundError) { /* … */ }
  if (e instanceof UnauthorizedError) {
    // re-auth flow
  }
}
```

## Subpaths

| Subpath       | Contents                                          |
| ------------- | ------------------------------------------------- |
| `client`      | NetronClient, transport adapters                  |
| `types`       | Public interfaces (NetronContext, descriptor types) |
| `errors`      | NetronError hierarchy                             |
| `middleware`  | AuthBearer, Retry, Logging, Tracing               |
| `packet`      | Wire-format helpers (rarely used directly)        |
| `utils`       | URL parsing, header normalisation                 |

## Read also

- [netron-react](./netron-react.md) — React hooks built on this client.
- [Titan / Netron](../titan/netron.md) — server side.
