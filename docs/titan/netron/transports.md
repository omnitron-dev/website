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

Register transports on the application's `Netron` instance **before
startup**. `registerTransportServer` stores a server configuration;
`app.start()` starts the registered listeners:

```typescript
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';
// WebSocket / TCP / Unix transports auto-register in Node; HTTP must be
// registered explicitly.

const app = await Application.create(AppModule);
const netron = app.netron!;

netron.registerTransport('http', () => new HttpTransport());
netron.registerTransportServer('http',      { name: 'api',  options: { port: 3000 } });
netron.registerTransportServer('websocket', { name: 'ws',   options: { port: 3001 } });
netron.registerTransportServer('tcp',       { name: 'tcp',  options: { port: 4001 } });
netron.registerTransportServer('unix',      { name: 'sock', options: { path: '/tmp/myapp.sock' } });
await app.start();
```

`registerTransportServer(name, { name, options })` takes a transport
key, a server label, and an `options` bag (`{ host?, port?, path?, … }`).
Only the transports you start are bound. An unrestricted published service
is reachable over each bound transport. Restrict its remote surface at the
service or member declaration:

```typescript
@Service({ name: 'orders', transports: [new HttpTransport()] })
class OrdersService {
  @Public({ transports: ['http'], auth: { roles: ['operator'] } })
  async list() { /* … */ }
}
```

The effective surface is the intersection of service and member restrictions.
Omitting `transports` adds no restriction; `[]` denies all remote transports.
`ws` normalizes to `websocket`. Custom transports use their implementation's
`name`, not a listener label. Invalid declarations fail during publication.
Restrictions do not start listeners or replace authentication and permissions.

The server determines the ingress transport. A request header or RPC argument
cannot select another transport identity. HTTP calls and batches, persistent
method calls and property operations all enforce the same boundary. Discovery,
OpenAPI and returned nested service interfaces show the corresponding surface;
calling a known service name or definition ID does not bypass it. Trusted
in-process calls remain local operations.

If interface discovery is denied by a transport restriction, the client receives
the same service-not-found response as for an unknown service. The server logs
a warning with the requested service, peer ID and actual ingress transport, so
operators can distinguish a denied route from a missing publication without
revealing a private service to the caller.

Forwarded definitions carry optional transport restrictions. A gateway cannot
widen them; definitions from older publishers without these fields remain
unrestricted by transport. Remote forwarding also requires an explicit
[gateway ACL](./authentication.md#forwarding-through-a-gateway).

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

Cost: one persistent TCP connection per peer pair. RPC calls are multiplexed on
that connection; an additional connection pool is not required.

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
| `connectTimeout`    | `10_000`               | Transport establishment and peer greeting deadline, on client and server |
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

## Share a request budget across HTTP and WebSocket

Create one limiter per process and pass the same object to the listeners that serve the same clients. A client key has one fixed window across both transports. The limiter also has a fixed window for all clients. Each window starts on its first accepted request and resets after `windowMs`.

```typescript
import { TransportRequestLimiter } from '@omnitron-dev/titan/netron';

const requestLimiter = new TransportRequestLimiter({
  enabled: true, windowMs: 60_000, maxRequests: 300, globalMaxRequests: 2_000,
});
netron.registerTransportServer('http', {
  name: 'api', options: { host: '127.0.0.1', port: 8010, requestLimiter },
});
netron.registerTransportServer('websocket', {
  name: 'events', options: { host: '127.0.0.1', port: 8011, requestLimiter },
});
```

HTTP reserves one unit before reading the body. A batch of N calls requires another N−1 units before the first handler runs. If the batch exceeds the remaining allowance, the ingress request still counts and no handler runs. Opening a WebSocket and initiating a call or task each consume one unit. Responses to requests already in flight can complete when the window is full.

The default key is the remote socket address. Enable `trustProxy` only on a listener reachable exclusively through a trusted proxy that overwrites the forwarding headers on ordinary requests and upgrades. An exhausted HTTP request or upgrade receives `429` and `Retry-After` in seconds. On an established WebSocket the caller receives a Netron rate-limit error. A stream that cannot deliver its next frame, or a peer that keeps sending while its refusal is still pending, closes with WebSocket code 1013. Handle that close with bounded reconnect backoff. A key on the optional `whitelist` bypasses both ceilings. Separate daemon processes maintain independent windows. Method authorization still applies after transport admission.

## Connection limits and lifecycle

`Netron` enforces `maxTotalConnections` (default **100**) and
`maxConnectionsPerPeer` (default **10**) through one connection manager. Pending
incoming greetings occupy capacity. Outbound HTTP peer handles count too;
inbound HTTP requests use their transport middleware limits. Configure limits
from measured peak concurrency before upgrading an older build in which these
settings only emitted a warning.

```typescript
const netron = new Netron(logger, {
  maxTotalConnections: 500,
  maxConnectionsPerPeer: 10,
});
```

`netron.connectionManager.getStats()` reports actual connections, per-peer counts
and transport byte totals. Slots are released on disconnect, rejected handshake
and shutdown, including clients that never start a listening server.

A peer ID is a routing identity, **not authentication**. Incoming greetings cannot
replace an already-connected identity. Use a separate `Netron` instance for each
concurrent authenticated principal; disconnect the old connection before reusing
its identity on the same server. IDs are limited to 256 characters without
whitespace/control characters. A greeting must fit in 4096 bytes and finish within
`connectTimeout`.

Netron owns reconnect together with the peer handshake. Raw transport reconnect
is disabled for sockets it owns, preventing competing recovery loops. Stopping
Netron cancels pending handshakes and reconnects; late results are closed.

Startup succeeds only when every configured server transport is available and has
started. If any listener fails, Netron waits for the other factories to settle,
then closes all created listeners and connections through the same cleanup path
as `stop()`. A late factory cannot leave a socket behind a failed startup.
WebSocket readiness waits for the native listener, including host resolution and
an external HTTP server. Bind errors reject startup instead of returning a ready
adapter. Port `0`, in options or a `ws://host:0` address, asks the OS for a free
port; it never selects the protocol default.
Concurrent `stop()` joins that lifecycle; a new `start()` or `connect()` is refused
while cleanup is running. The configuration remains available for a retry.

A close failure is reported rather than treated as a clean stop. Other resources
are still released; failed listeners remain registered so `stop()` can retry.
`start()` cannot claim readiness over a listener left by an incomplete cleanup.
Inspect the original startup error and any cleanup errors before retrying.

Persistent RPC connections stay leased until disconnect. Pool size, idle cleanup
and pool heartbeat options apply to unleased spare connections managed directly
through `connectionManager`; they neither create additional RPC sockets nor evict
an otherwise idle persistent peer. Transport keepalive owns its liveness.

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
- **WS connection state** persists across calls. The initial credential is
  revalidated before each invocation; revocation and role changes are not frozen
  at connection time. HTTP authenticates per request.

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

## HTTP failures and deadlines

Titan and the browser client decode HTTP errors through the same
`netron-protocol` contract. Numeric, decimal-string and shared symbolic codes
retain their category on peer, direct connection and per-request-hint paths.
Unknown application symbols remain in `details.errorCode`, with the HTTP failure
status as the category. Request, correlation and trace headers survive decoding.
A 401/403 refusal must not turn into an internal error or a retryable outage.

A request deadline covers both response headers and body consumption. Each
concurrent request has its own cancellation controller; closing the connection
cancels every pending request. A valid request sent through `connection.send()`
propagates transport failures and remote refusals to its caller. A timeout means
that confirmation was not received, not that a remote mutation was undone.

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
