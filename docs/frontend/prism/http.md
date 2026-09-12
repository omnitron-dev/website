---
title: HTTP client
description: Typed REST requests, cancellation, interceptors and explicit retries.
---

# HTTP client

`@omnitron-dev/prism/http` provides `createHttpClient` and the shared `http`
instance for ordinary HTTP APIs. It is separate from the Netron RPC client.
Use it for REST endpoints and downloads; use
[Prism's Netron bindings](./index.md#netron-integration--omnitron-devprismnetron)
for named RPC services.

## Make a request

```typescript
import { createHttpClient } from '@omnitron-dev/prism/http';

const api = createHttpClient({
  baseUrl: '/api',
  timeout: 10_000,
  retry: { maxRetries: 0 },
});

interface Profile { id: string; displayName: string }
const response = await api.get<Profile>('/profile');
console.log(response.data.displayName, response.status);
```

The result is `HttpResponse<T>` with `data`, `status`, `statusText`,
`headers` and the original `config`. The generic describes the expected
payload; it does not validate JSON at runtime. Validate untrusted payloads
at the application boundary.

## Request surface

| Method | Arguments |
| --- | --- |
| `get`, `delete`, `head`, `options` | URL and optional request configuration |
| `post`, `put`, `patch` | URL, body and optional request configuration |
| `request` | A complete `HttpRequestConfig` |
| `extend` | Creates another client with merged configuration |
| `getConfig` | Reads the current client configuration |

Use `params` for query parameters, `headers` for per-request headers and
`responseType` for `json`, `text`, `blob` or `arraybuffer`. `withCredentials`
controls cookie credentials; configure the server's CORS and CSRF policy
as well when credentials cross an origin.

## Cancel work on disposal

```typescript
const controller = new AbortController();
const pending = api.get('/reports', { signal: controller.signal });
// On navigation or component cleanup:
controller.abort();
try {
  await pending;
} catch (error) {
  // Distinguish cancellation from an actionable request failure.
}
```

`HttpError` exposes optional `status`, `data`, `headers`, `cancelled` and
`timeout` fields, plus the request `config`. A network failure may have no
HTTP status. Narrow the caught value before reading those properties.

## Interceptors and retries

`addRequestInterceptor`, `addResponseInterceptor` and `addErrorInterceptor`
return removal functions. Install long-lived interceptors once; remove
temporary ones when their owner is disposed.

```typescript
const remove = api.addRequestInterceptor((config) => ({
  ...config,
  headers: { ...config.headers, 'X-Client': 'web' },
}));
// Later, when this integration is disposed:
remove();
```

Retry configuration accepts `maxRetries`, `retryDelay` and
`retryCondition(error, attempt)`. Set retry policy explicitly for the
operation: replaying a payment or creation request may duplicate a side
effect. An idempotency key and server support are needed before such a
request is safe to retry.

The client supplies transport mechanics, not a React cache. Use
[Netron query hooks](../netron/react.md) for Netron server state, or let
the consuming application own caching and invalidation for a REST API.
