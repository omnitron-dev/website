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

Transports are bound imperatively on the running `Netron` instance.
Each one is *registered* (its factory added to the registry) and then
a *server* is started for it via `registerTransportServer`:

```typescript
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';
// WebSocket / TCP / Unix transports auto-register in Node; HTTP must be
// registered explicitly.

const app = await Application.create(AppModule);
await app.start();
const netron = app.netron!;

netron.registerTransport('http', () => new HttpTransport());
await netron.registerTransportServer('http',      { name: 'api',  options: { port: 3000 } });
await netron.registerTransportServer('websocket', { name: 'ws',   options: { port: 3001 } });
await netron.registerTransportServer('tcp',       { name: 'tcp',  options: { port: 4001 } });
await netron.registerTransportServer('unix',      { name: 'sock', options: { path: '/run/myapp.sock' } });
```

`registerTransportServer(name, { name, options })` takes a transport
key, a server label, and an `options` bag (`{ host?, port?, path?, … }`).
Only the transports you start are bound. A service is reachable over
*every* bound transport — no per-method or per-service binding.

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

All transports extend a shared `TransportOptions` base
(`netron/transport/types.ts`). The most-used fields:

| Option              | Default                | Effect                                          |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `port` / `path`     | —                      | Where to listen (set via the server `options`)  |
| `host`              | `'0.0.0.0'` (TCP/WS), `'localhost'` (HTTP) | Interface to bind             |
| `maxPacketSize`     | `16 * 1024 * 1024` (16 MiB) | Hard ceiling on an inbound packet, checked before decode |
| `connectTimeout`    | `10_000`               | Connection establishment timeout                |
| `requestTimeout`    | `5_000`                | Per-request timeout                             |
| `streamTimeout`     | `30_000`               | Idle-stream timeout                             |
| `keepAlive`         | `{ enabled?, interval?, timeout? }` | Keepalive config object            |
| `compression`       | `false`                | Enable message compression                      |

Transport-specific options layer on top:

- **WebSocket** — `maxPayload`, `perMessageDeflate`, `handshakeTimeout`,
  `protocols`, `pathPrefix`.
- **TCP** — `noDelay` (disable Nagle), `keepAliveDelay`, `allowHalfOpen`.
- **HTTP** — `cors`, `maxRequestSize` (e.g. `'10mb'`),
  `keepAliveTimeout`, `customRoutes`, `maxAsyncGeneratorItems`,
  `pathPrefix`.

There is **no** unified `maxPayloadBytes` / `keepAliveMs` /
`connectionTimeoutMs` option — those names do not exist; use the real
ones above.

## TLS

The Netron transports do not currently expose a built-in TLS/`tls`
option. Terminate TLS at the load balancer, ingress, or reverse proxy
in front of the process — HTTP and WebSocket traverse those cleanly.
For TCP between hosts, run it over a private network or a tunnel.

Unix sockets need no transport encryption; their access control is
filesystem permissions.

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

Transports are pluggable. **Every `Netron` instance owns its own
registry** (`new TransportRegistry()` in the constructor), which
auto-registers `tcp`, `ws`/`websocket` and `unix`. Add your own by
implementing the transport interface and registering it **on the
instance**:

```typescript
import { Netron } from '@omnitron-dev/titan/netron';
// ITransport ships from the http entry point — that is currently its only
// public path, though the interface itself is transport-agnostic.
import type {
  ITransport, ITransportConnection, ITransportServer,
  TransportOptions, TransportAddress,
} from '@omnitron-dev/titan/netron/transport/http';

class QuicTransport implements ITransport {
  readonly name = 'quic';
  readonly capabilities = {
    streaming: true, bidirectional: true, binary: true,
    reconnection: true, multiplexing: true, server: true,
  };

  async connect(address: string, options?: TransportOptions): Promise<ITransportConnection> {
    throw new Error('not implemented');
  }
  async createServer(options?: TransportOptions): Promise<ITransportServer> {
    throw new Error('not implemented');
  }
  isValidAddress(address: string) { return address.startsWith('quic://'); }
  parseAddress(address: string): TransportAddress {
    return { protocol: 'quic', host: 'localhost', port: 4433 };
  }
}

// registerTransport takes a *factory*, not the class itself.
netron.registerTransport('quic', () => new QuicTransport());
netron.registerTransportServer('quic', { name: 'quic', options: { port: 4433 } });
```

`registerTransportServer` throws `NotFound` unless the name was
registered first, so the two calls are ordered.

:::warning There is also a module-global registry. Nothing reads it.

`transport-registry.ts` exports a free `registerTransport(name, factory)`
that writes to a module-level singleton. No `Netron` instance ever
consults that singleton — each builds its own registry — so a transport
registered through the free function is invisible to your application:

```
registerTransport('quic', () => new QuicTransport());  // global registry: OK
netron.registerTransportServer('quic', { … });         // NotFound: Transport with id quic not found
```

The free function is also unreachable from any published entry point:
the package exports `./netron/transport/http`, `/websocket`, `/tcp`
and `/unix`, but not `./netron/transport` itself. Use the instance
method — it is what every call site in this monorepo uses.
:::

## Cross-runtime transport availability

| Runtime | HTTP | WebSocket | TCP | Unix |
| ------- | ---- | --------- | --- | ---- |
| Node    | ✓    | ✓         | ✓   | ✓    |
| Bun     | ✓    | ✓         | ✓   | ✓    |
| Deno    | ✓    | ✓         | ✓   | ✓    |
| Browser | ✓    | ✓         | —   | —    |

A fresh `Netron` already has `tcp`, `ws`/`websocket` and `unix`.
**HTTP is never auto-registered** — register it on the instance before
starting an HTTP server:

```typescript
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';

netron.registerTransport('http', () => new HttpTransport());
netron.registerTransportServer('http', { name: 'http', options: { port: 8081 } });
``` The browser RPC client lives in the
separate `@omnitron-dev/netron-browser` package.

## Anti-patterns

- **Binding all four transports by default.** Each open transport
  is a port and an attack surface. Bind only what's needed.
- **HTTP for service-to-service hot paths.** Per-call framing cost
  dominates. Use TCP or WS within the cluster.
- **WebSocket for short-lived clients.** A short-lived client that
  connects, makes one call, disconnects pays for the connection
  setup over and over. HTTP is simpler.
- **Leaving the packet ceiling at the 16 MiB default.** Size
  `maxPacketSize` (and HTTP's `maxRequestSize`) down to what your
  contract actually needs — it defends against accidental memory
  amplification on untrusted-peer transports.

→ Next: [Middleware](./middleware.md).
