---
sidebar_position: 3
title: Netron RPC
---

# Netron RPC

Netron is Titan's transport-agnostic RPC plane. The same `@Service`
surface is reachable over four transports with the same calling convention
and the same middleware stack.

## Transports

| Transport  | Use case                                  | Default port |
| ---------- | ----------------------------------------- | ------------ |
| HTTP       | Browsers, REST-style integrations         | 3000         |
| WebSocket  | Browser subscriptions, streaming          | 3001         |
| TCP        | Service-to-service inside a cluster       | 4001         |
| Unix       | Sidecars, CLI ↔ daemon, low-overhead IPC  | n/a (path)   |

Configure them at boot:

```typescript
const app = await Application.create(AppModule, {
  netron: {
    http:      { port: 3000 },
    websocket: { port: 3001 },
    tcp:       { port: 4001 },
    unix:      { path: '/run/myapp.sock' },
  },
});
```

A service does not know which transport it is being called over. The
method body sees a normal TypeScript invocation; the wire format is
the framework's concern.

## Service descriptors

Every `@Service` registers a *descriptor* — a typed record of the
service's name, version, methods, and parameter schemas. The descriptor
is what the client resolves against `queryInterface<T>()`.

```typescript
const users = await client.queryInterface<UsersService>('users@1.0.0');
//    ^? UsersService — full method signatures, fully typed
```

Versioning is part of the identity: `users@1.0.0` and `users@2.0.0` can
coexist on the same app, and clients pin to one explicitly.

## Middleware

Middleware runs around every Netron call. The same middleware stack
applies to every transport.

```typescript
@Module({
  imports: [
    NetronModule.forRoot({
      middleware: [
        AuthMiddleware,            // From titan-auth
        RateLimitMiddleware,        // From titan-ratelimit
        TracingMiddleware,
      ],
    }),
  ],
})
export class AppModule {}
```

Custom middleware:

```typescript
@Injectable()
export class TimingMiddleware implements NetronMiddleware {
  async handle(ctx: NetronContext, next: () => Promise<unknown>) {
    const start = performance.now();
    try {
      return await next();
    } finally {
      Logger.info('netron.call', {
        service: ctx.service,
        method:  ctx.method,
        ms:      performance.now() - start,
      });
    }
  }
}
```

## Authentication

`titan-auth` provides JWT validation as a middleware. The decoded claims
are attached to the `NetronContext`.

```typescript
@Service('orders@1.0.0')
export class OrdersService {
  @Public()
  @RequireAuth({ scope: 'orders:read' })
  async list(@Context() ctx: NetronContext) {
    return this.repo.listForUser(ctx.auth.userId);
  }
}
```

## Discovery

`titan-discovery` registers running services in Redis so clients can
locate them by name without hardcoded URLs.

```typescript
const client = new NetronClient({
  discovery: { redis: { url: process.env.REDIS_URL } },
});

const users = await client.queryInterface<UsersService>('users@1.0.0');
//                          // resolves the URL via discovery
```

## Multi-backend services

A single `queryInterface` call can fan out to multiple service instances
for read-side replication or partitioning. See the `multi-backend`
sub-module of `titan/netron`.

## Error mapping

Server-side errors travel as typed `NetronError` subclasses. The client
receives them as the same class:

```typescript
try {
  await users.findById('missing');
} catch (e) {
  if (e instanceof NotFoundError) {
    // typed
  }
}
```

## Read next

- [netron-browser](../frontend/netron-browser.md) — browser-side client.
- [netron-react](../frontend/netron-react.md) — React hooks.
- [titan-auth module](./modules/auth.md) — JWT middleware.
- [titan-discovery module](./modules/discovery.md) — Redis discovery.
