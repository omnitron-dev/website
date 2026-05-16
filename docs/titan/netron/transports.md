---
sidebar_position: 2
title: Transports
description: HTTP, WebSocket, TCP, Unix — how to choose and how to configure.
---

# Transports

A transport is the wire protocol Netron speaks. Four are built in;
each is opt-in. The same `@Service` class is reachable over any
transport you bind, with the same calling convention and the same
middleware stack.

## The four transports

| Transport  | Best for                                            | Latency | Throughput | Streaming |
| ---------- | --------------------------------------------------- | ------- | ---------- | --------- |
| HTTP       | Browsers, REST integrations, reverse-proxy environments | Med  | Low–med    | No        |
| WebSocket  | Browser subscriptions, persistent client sessions   | Low     | High       | Yes       |
| TCP        | Service-to-service inside a cluster                 | Lowest  | Highest    | Yes       |
| Unix       | Sidecars, CLI ↔ daemon, low-overhead local IPC     | Lowest  | Highest    | Yes       |

## Configuring transports

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

Only the transports you list are bound. A service is reachable over
*every* listed transport — no per-method or per-service binding.

## When to choose what

### HTTP

Choose HTTP when:

- Browsers call your service directly. (Use WebSocket only if you
  need streaming or long-lived sessions.)
- A reverse proxy sits between client and server (NGINX, Cloud Load
  Balancer, K8s Ingress). HTTP/1.1 traverses these without special
  config.
- You want curl-debuggable endpoints.

Cost: per-call HTTP framing overhead (~50–200 µs). Negligible for
human-driven traffic; significant for service-to-service hot paths.

### WebSocket

Choose WebSocket when:

- You need server-push (subscriptions, long-lived events).
- You need persistent sessions (auth setup once per connection,
  reused across many calls).
- You want low per-call overhead from a browser.

Cost: connection state on the server. WebSocket is stateful; a
per-pod connection limit applies.

### TCP

Choose TCP when:

- Server-to-server inside a cluster, behind a private network.
- You need the lowest possible latency.
- You don't need a reverse proxy (TCP doesn't traverse most HTTP-only
  proxies).

Cost: one TCP connection per (peer pair). Connection pooling
required.

### Unix sockets

Choose Unix when:

- Two processes on the same host need to communicate (sidecar pattern,
  CLI ↔ daemon).
- You want OS-level access control via filesystem permissions.
- You want zero TCP/TLS overhead.

Limitation: same-host only. The Omnitron CLI uses Unix sockets to
talk to local supervisors.

## Transport options — common

All four transports share these options:

| Option              | Default              | Effect                                          |
| ------------------- | -------------------- | ----------------------------------------------- |
| `port` / `path`     | (required)           | Where to listen                                 |
| `host`              | `'0.0.0.0'`          | Interface to bind (HTTP / WS / TCP only)        |
| `tls`               | `undefined`          | TLS config — see below                          |
| `maxPayloadBytes`   | `10_000_000` (10 MB) | Reject payloads above this size                 |
| `keepAliveMs`       | varies               | TCP/WS keepalive interval                       |
| `connectionTimeoutMs` | `30_000`           | Drop connections that idle this long            |

## TLS

```typescript
http: {
  port: 443,
  tls: {
    cert: fs.readFileSync('./cert.pem'),
    key:  fs.readFileSync('./key.pem'),
    // Optional client cert verification:
    requestClientCert: true,
    ca: fs.readFileSync('./ca.pem'),
  },
}
```

Same shape across HTTP / WS / TCP. Unix sockets do not use TLS;
their access control is filesystem permissions.

For production, terminate TLS at the load balancer or ingress when
possible. Application-level TLS is heavier and harder to rotate.

## Same service, multiple transports — what changes?

Nothing in the service code. Same dispatch logic, same middleware
stack, same error mapping. The transport is invisible to the method
body.

A few client-side differences:

- **Browser** can only use HTTP and WebSocket.
- **Streaming methods** (returning `AsyncIterable<T>`) require WS, TCP,
  or Unix — HTTP cannot stream.
- **WS connection state** persists across calls; auth happens once
  per connection. HTTP authenticates per request.

## The transport registry

Transports are pluggable. The framework auto-registers the four
built-ins; you can add your own by implementing the transport
interface and registering with `TransportRegistry`.

```typescript
import { TransportRegistry, type ITransport } from '@omnitron-dev/titan/netron/transport';

class QuicTransport implements ITransport {
  // …
}

TransportRegistry.register('quic', QuicTransport);
```

Most apps never touch the registry. It exists for adapter packages
(WebTransport, QUIC, message queues exposed as Netron transports).

## Cross-runtime transport availability

| Runtime | HTTP | WebSocket | TCP | Unix |
| ------- | ---- | --------- | --- | ---- |
| Node    | ✓    | ✓         | ✓   | ✓    |
| Bun     | ✓    | ✓         | ✓   | ✓    |
| Deno    | ✓    | ✓         | ✓   | ✓    |
| Browser | ✓    | ✓         | —   | —    |

The transport registry detects runtime and registers what's available.
A browser-side `NetronClient` will refuse a TCP URL with a clear error.

## Anti-patterns

- **Binding all four transports by default.** Each open transport
  is a port and an attack surface. Bind only what's needed.
- **HTTP for service-to-service hot paths.** Per-call framing cost
  dominates. Use TCP or WS within the cluster.
- **WebSocket for short-lived clients.** A short-lived client that
  connects, makes one call, disconnects pays for the connection
  setup over and over. HTTP is simpler.
- **No `maxPayloadBytes` set.** A 10 MB default is generous for
  most services. Size it down if your contract enforces small
  payloads — defends against accidental memory amplification.

→ Next: [Middleware](./middleware.md).
