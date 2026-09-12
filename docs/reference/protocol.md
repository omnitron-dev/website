---
title: Protocol and HTTP primitives
description: Shared wire contracts and HTTP machinery used by the server and browser clients.
---

# Protocol and HTTP primitives

Two packages hold definitions shared by Titan and the browser client.
Most applications use the higher-level
[server](../titan/netron.md) and [client](../frontend/netron/browser.md)
APIs. These packages matter when building an adapter, inspecting the wire
contract or diagnosing compatibility.

## `@omnitron-dev/netron-protocol`

| Export family | Purpose |
| --- | --- |
| `Uid`, `uuid`, `MAX_UID_VALUE` | Identifier generation and its wire limit |
| `Definition`, `Reference` | Service definitions and remote references |
| `ServiceContract`, `ServiceMetadata`, `ArgumentInfo`, `MethodInfo`, `PropertyInfo` | Shared service-description types |
| `Packet`, `createPacket`, `TYPE_*`, `StreamType` | Packet construction, operation codes and stream kinds |
| `ErrorCode`, `ErrorCategory`, `ERROR_METADATA` | Error taxonomy shared by the two ends |
| `TitanError`, `AggregateError`, `ErrorPool` | Structured failures |
| `createError`, `ensureError`, `isErrorCode` | Error construction and narrowing |
| `isClientError`, `isServerError`, `isRetryableError`, `getErrorCategory`, `toHttpStatus` | Classification for callers and transports |
| `getErrorName`, `getDefaultMessage` | Stable names and fallback descriptions |

The package has no runtime dependencies. It is more than a set of numeric
constants: service definitions, packet shapes and the error hierarchy are
also shared. Check the [API index](./api-index.mdx) for the exact exports
in the current source tree.

A compatible packet does not establish authentication or validate a
business payload. Keep those concerns at their documented boundaries.
Do not assign private meanings to an existing operation code; both peers
must agree on any protocol extension.

## `@omnitron-dev/netron-http-core`

| Export | Responsibility |
| --- | --- |
| `HttpCacheManager` | Shared HTTP cache mechanics |
| `RetryManager` | Retries and circuit-breaker behaviour |
| `QueryBuilder` | Query configuration |
| `ConfigurableProxy` | Fluent request configuration around an executor |
| `IHttpRequestExecutor` | Adapter contract for executing a configured request |
| `HttpRequestContext`, `HttpRequestHints`, `HttpRequestMessage` | Request types shared by adapters |
| `HttpCoreLogger` | Minimal logging contract |

The companion types include `CacheOptions`, `CacheStats`, `RetryOptions`,
`RetryStats`, `CircuitBreakerOptions` and `QueryOptions`.
This entry point does not export a `RequestBatcher`.

Prefer the [browser client's HTTP interface](../frontend/netron/browser.md)
unless you are implementing an executor. Define ownership for cache
invalidation, cancellation and disposal. Retry a side-effecting request
only when the operation's idempotency contract permits it.

## Upgrade server and client deliberately

Pin application dependencies and preserve the lockfile. Compile against
the intended contract, then exercise a real call and an error round trip.
Already-deployed clients do not acquire a new contract when the server
is rebuilt. See [compatibility](./compatibility.md) and
[serialization](../titan/netron/serialization.md).
