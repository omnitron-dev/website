---
sidebar_position: 1
title: Netron RPC
description: A transport-agnostic RPC plane — same service surface across HTTP, WebSocket, TCP, Unix.
---

# Netron RPC

Netron is the RPC plane Titan ships. It does one thing: take a
TypeScript class, expose its methods over the wire, dispatch incoming
calls back to the methods. The wire format is binary msgpack; the
contract is the TypeScript interface.

This page is the Netron entry point. The mechanics live in:

| Page                                              | Topic                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| [Services](./netron/services.md)                  | Defining `@Service` classes, descriptors, peers        |
| [Transports](./netron/transports.md)              | HTTP / WebSocket / TCP / Unix — when to choose what    |
| [Middleware](./netron/middleware.md)              | Per-call wrapping (auth, rate limit, tracing)          |
| [Authentication](./netron/authentication.md)      | Identity, claims, policies                             |
| [Streaming](./netron/streaming.md)                 | AsyncIterable methods, backpressure                   |
| [Multi-backend](./netron/multi-backend.md)        | Client → many servers, failover, load balancing       |
| [Serialization](./netron/serialization.md)        | Wire format, msgpack, custom codecs                    |

## The five-line tour

Server:

```typescript
@Service('users@1.0.0')
class UsersService {
  @Public() async findById(id: string): Promise<User | null> { /* … */ }
}

await Application.create(AppModule, { netron: { http: { port: 3000 } } }).then(a => a.start());
```

Client:

```typescript
const client = new NetronClient({ url: 'http://localhost:3000' });
const users  = await client.queryInterface<UsersService>('users@1.0.0');
const user   = await users.findById('u_42');
```

That is the whole API surface for a typical service. Versioning,
routing, serialisation, error mapping, and trace propagation all
happen behind it.

## What Netron is

A few specific things, each with a deliberate scope:

- **A service descriptor system.** `@Service` registers a typed
  contract; clients resolve it by name and version.
- **A transport abstraction.** Four transports built in, all sharing
  the same service surface; pluggable for custom ones.
- **A middleware stack.** Per-call wrapping for cross-cutting
  concerns — auth, rate limiting, tracing, logging.
- **An auth policy framework.** Authentication and authorisation are
  separate concerns with composable policies via `BuiltInPolicies`
  (`requireRole`, `requireAnyRole`, `requirePermission`, …).
- **A multi-backend client.** One client can route to many servers
  with health-aware failover and method-level rules.
- **A streaming primitive.** `AsyncIterable<T>` return types map to
  long-lived streams over WebSocket / TCP.

## What Netron is not

- **Not a service mesh.** Discovery, mTLS, traffic shaping at
  cluster scope are out of scope. Use a real mesh (Linkerd, Istio,
  Consul Connect) for that.
- **Not a queue.** Netron calls are request/response; the response
  may be a stream. For decoupled work, use
  [`titan-events`](./modules/events) or
  [`titan-notifications`](./modules/notifications).
- **Not a schema language.** The TypeScript interface is the schema.
  No `.proto` files, no OpenAPI YAML.

## Performance characteristics

Per-call cost on a warmed-up connection (HTTP/1.1, localhost,
no middleware):

| Op                              | Approx cost       |
| ------------------------------- | ----------------- |
| msgpack encode (small payload)  | 5–10 µs           |
| Service descriptor lookup       | <1 µs             |
| Validation (typical schema)     | 1–5 µs            |
| Method invocation (your code)   | varies            |
| msgpack decode                  | 5–10 µs           |
| HTTP framing                    | 50–200 µs         |

For sustained throughput, use WebSocket (no per-call HTTP framing
cost) or TCP. For bursty short-lived clients, HTTP is fine and works
through any reverse proxy.

→ Read on: [Services](./netron/services.md).
