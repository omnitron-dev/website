---
id: "frontend/netron/transports"
slug: "/docs/frontend/netron/transports"
sidebar_position: 4
title: Transports
description: Choose a Netron transport, bound the lifetime of a call, and observe connection recovery.
---

# Transports

Choose the transport the service exposes at the URL you are calling. A gateway
can serve HTTP RPC at one path and WebSocket upgrades at another.

| Client | Use it for | Transport selection |
| --- | --- | --- |
| `createClient` / `NetronClient` | Framework-independent RPC to one backend | `http` by default, or explicit `websocket` |
| `HttpClient` | HTTP RPC with authentication or custom middleware | HTTP |
| `WebSocketClient` | Binary RPC, server-initiated tasks and reconnect events | WebSocket |
| `createMultiBackendClient` | Several backends with separate endpoints and policies | Configure `http` or `websocket` per backend |
| `NetronReactClient` | React queries, mutations and event subscriptions | `http`, `websocket` or React-specific `auto` |

## HTTP {#http}

Supply an absolute base URL. The browser client appends `/netron/invoke` and
sends a JSON POST. HTTP `connect()` initializes the client locally. To check
whether a service is reachable, invoke a permitted read or its readiness probe.

```typescript
import { createClient } from '@omnitron-dev/netron-browser';

const client = createClient({
  url: new URL('/api', window.location.origin).href,
  transport: 'http',
  timeout: 10_000,
  headers: { 'X-Client': 'web/1.0' },
  http: { retry: true, maxRetries: 3, redirect: 'error' },
});
await client.connect();
```

### Invocation lifetime and replay {#invocation-lifetime-and-replay}

```typescript
const controller = new AbortController();
const result = await client.invoke('Catalog', 'list', [], {
  signal: controller.signal,
  timeout: 10_000,
  idempotent: true,
});
```

`signal` is local control state, never part of the wire payload. Cancellation
rejects with `signal.reason`. The deadline covers transport attempts, backoff,
response-body decoding and response middleware. A response whose headers arrive
before the deadline can still time out while its body is being read.
Cancellation and deadline expiry do not trigger network retry or auth refresh.
Aborting the caller does not roll back an operation already accepted by the server.

Network retries require **both** client `http.retry: true` and invocation
`idempotent: true`. The second option is the caller's assertion about the operation,
not an idempotency key or a server deduplication guarantee. Do not set it for a
write merely because a failed connection returned no answer. Use a domain
operation ID with server-side replay semantics when a write must be retried.
The direct HTTP client does not infer this property from a method name.

For a fixed RPC endpoint, use `http.redirect` on `createClient` or pass
`redirect: 'error'` directly to `HttpClient`.
Fetch then rejects a redirect before replaying the request at another address.
This protects publication bodies and custom credential headers. With multiple
backends, set `http.redirect` on the backend that needs this policy. Omitting
the option preserves the default Fetch redirect behavior.

Service query hooks forward the query cancellation signal. A component unmount does
not automatically cancel a mutation: its server-side outcome may already be committed.

### HTTP wire format {#http-wire-format}

The direct browser transport posts JSON to `/netron/invoke`:

```json
{"id":"request-id","service":"Catalog","method":"list","input":[]}
```

A successful reply contains the same `id`, `success: true`, and `data`.
A failed invocation contains `success: false` and a structured `error`. Titan may
also reject a request before RPC admission with an HTTP transport error. The
client distinguishes that refusal from a successful RPC envelope. A mismatched
ID, malformed envelope or an HTTP failure carrying an RPC success is rejected.
Application payloads still require their own runtime schemas; a TypeScript
return type cannot validate bytes received over the network.

## WebSocket {#websocket}

Use the URL of a binary Netron WebSocket listener. Await `connect()` before
issuing calls. It waits for the Netron handshake. Use the direct client for
connection events, service discovery or server-initiated task handlers.

```typescript
import { WebSocketClient } from '@omnitron-dev/netron-browser';

const socket = new WebSocketClient({
  url: 'wss://api.example.com/rpc',
  enableServiceDiscovery: true,
  reconnect: true,
  reconnectInterval: 1_000,
  maxReconnectAttempts: 12,
});

socket.on('reconnecting', ({ attempt, delay, announced }) => {
  console.info(announced ? 'Server restarting' : 'Connection lost', { attempt, delay });
});
await socket.connect();
try {
  const items = await socket.invoke('Catalog@1.0.0', 'list', []);
  console.info(items);
} finally {
  await socket.disconnect();
}
```

Service discovery resolves a service's wire definition ID on the connected
server. It is opt-in. Only enable it for a trusted endpoint. Alternatively,
supply a known `serviceDefinitions` map. Register a named server-initiated task
with `socket.onTask(name, handler)` when the service contract requires it.

### Reconnect behaviour {#reconnect-behaviour}

Automatic reconnect is enabled by default. The base retry interval is 1,000 ms
and the default attempt limit is `Infinity`. Ordinary retries use exponential
backoff with jitter, capped at 30 seconds with the default base. A server restart
announced by close code 1012 gets an initial jittered delay of 1–3 seconds.
The `reconnecting` event exposes the actual delay. Exhausting a finite limit
sets the state to `failed` and emits `reconnect-failed`. Explicit `disconnect()`
ends the reconnect loop.

A closed socket rejects its pending invocations. For an interrupted write,
check its recorded outcome before submitting it again. For events, the React
subscription manager re-registers subscribed names after reconnect. Recover
events missed during the outage using the service's cursor or a fresh snapshot.

## React transport selection {#react-transport-selection}

Use `transport: 'http'` for an HTTP-only API, including a React application
behind an HTTP gateway. Use `'websocket'` for a WebSocket-only service.

`NetronReactClient` defaults to `'auto'`. Without a browser `window` it selects
HTTP. In the browser it opens WebSocket first, waits for the handshake, then
initializes HTTP with the same configured URL. Calls prefer the connected
WebSocket and can use the initialized HTTP client while the socket is down.
If the initial WebSocket connection fails, `connect()` rejects before HTTP
initialization. For this mode, supply an absolute HTTP(S) base that serves
both the WebSocket upgrade and the HTTP RPC path. For separate endpoints,
configure each backend explicitly.

## Connection state and metrics {#connection-state-and-metrics}

The direct browser clients expose `getState()` and `getMetrics()`.
Connection states are `disconnected`, `connecting`, `connected`,
`reconnecting` and `failed`. A React component inside `NetronProvider`
can read `state`, `error` and `reconnect` from `useNetronConnection()`.

```typescript
const { transport, state, requestsSent, responsesReceived, errors, avgLatency } =
  client.getMetrics();
```

These counters belong to this client. `avgLatency` is optional and measured
in milliseconds. Use a query cache or the [fluent HTTP interface](./browser.md#fluent-http-interface--caching-retry-circuit-breaking)
when individual reads require caching or deduplication.

## See also {#see-also}

- [HTTP and WebSocket clients](./browser.md)
- [Authentication and cookie transport](./auth.md)
- [React subscriptions](./react.md)
- [Multi-backend routing](./multi-backend.md)
