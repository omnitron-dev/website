---
sidebar_position: 9
title: Error handling
description: Typed errors across the wire, retry classification, recovery patterns.
---

# Error handling

Server-side `TitanError` subclasses arrive on the client as the
**same class** — the wire format preserves constructor name +
`code`. This lets you `instanceof`-check exactly as you would
server-side.

## TitanError

```typescript
import { TitanError, ErrorCode } from '@omnitron-dev/netron-browser';

try {
  await users.findById('missing');
} catch (e) {
  if (!(e instanceof TitanError)) throw e;

  switch (e.code) {
    case ErrorCode.NOT_FOUND:         return null;
    case ErrorCode.UNAUTHORIZED:      return reauth();
    case ErrorCode.FORBIDDEN:         return showAccessDenied();
    case ErrorCode.TOO_MANY_REQUESTS: return scheduleRetry(e);
    case ErrorCode.VALIDATION_ERROR:  return showFieldErrors(e.details?.errors);
    case ErrorCode.SERVICE_UNAVAILABLE: return showOutage();
    case ErrorCode.REQUEST_TIMEOUT:   return showTimeout();
    default:                          throw e;
  }
}
```

The full `ErrorCode` enum mirrors HTTP status codes — see
[Titan / Errors catalog](../../titan/modules/errors-catalog.mdx)
for the complete reference.

## Transport-level errors

Errors that don't come from the server's `TitanError` system:

| Class | When | Recoverable? |
| ----- | ---- | :----------: |
| `NetworkError` | DNS failure, connection refused, browser offline | ✓ (often) |
| `TimeoutError` | Request exceeded `timeout` | ⚠ (sometimes) |
| `ConnectionError` | WS upgrade failed; HTTP cert invalid | ✗ |
| `TransportError` | Generic transport-layer failure | ⚠ |

These are exported from the package root alongside the other
Netron error classes (`NetronError`, `ProtocolError`,
`ServiceError`, `MethodNotFoundError`, `InvalidArgumentsError`,
`SerializationError`).

> There is **no** `CircuitOpenError` class. When the fluent HTTP
> interface's circuit breaker is open it throws a `TitanError`
> with `code: ErrorCode.SERVICE_UNAVAILABLE` (message
> `"Circuit breaker is open"`) — check the code, not a class.

```typescript
import {
  NetworkError, TimeoutError, ConnectionError,
  TitanError, ErrorCode,
} from '@omnitron-dev/netron-browser';

try {
  await users.findById(id);
} catch (e) {
  if (e instanceof NetworkError) {
    return showOfflineBanner();
  }
  if (e instanceof TimeoutError) {
    return showSlowNetworkWarning();
  }
  // Circuit breaker open (fluent HTTP interface):
  if (e instanceof TitanError && e.code === ErrorCode.SERVICE_UNAVAILABLE) {
    return showServiceUnavailable();
  }
  throw e;
}
```

## Errors in `useQuery` / `useMutation`

Errors land on `error`:

```tsx
const { data, error, isError } = users.getUser.useQuery([id]);

if (isError) {
  if (error instanceof TitanError && error.code === ErrorCode.NOT_FOUND) {
    return <NotFoundCard />;
  }
  return <ErrorCard error={error} onRetry={() => refetch()} />;
}
```

For mutations:

```tsx
const invite = users.invite.useMutation({
  onError: (error) => {
    if (error instanceof TitanError && error.code === ErrorCode.VALIDATION_ERROR) {
      for (const fieldErr of error.details?.errors ?? []) {
        form.setError(fieldErr.path, { type: 'server', message: fieldErr.message });
      }
    } else {
      toast.error('Could not send invite');
    }
  },
});
```

## Server-side validation errors

When the server's `@Validate(schema)` rejects, the error
carries field-level details:

```typescript
{
  code: ErrorCode.VALIDATION_ERROR,
  message: 'Validation failed',
  details: {
    errors: [
      { path: 'email',    message: 'Invalid email format',  expected: 'email', received: 'foo' },
      { path: 'password', message: 'Must be ≥ 8 characters' },
    ],
  },
}
```

Map these onto form fields:

```tsx
catch (e) {
  if (e instanceof TitanError && e.code === ErrorCode.VALIDATION_ERROR) {
    for (const err of e.details?.errors ?? []) {
      form.setError(err.path as any, { type: 'server', message: err.message });
    }
    return;
  }
  form.setError('root', { message: 'Something went wrong' });
}
```

The error appears under the matching `<Field>` exactly like
client-side errors — no special UI path.

## Retry classification

The fluent HTTP interface's retry (`RetryOptions`, via
`.retry({ ... })`) ships a default `shouldRetry` that classifies
failures by whether the request provably never reached the
server vs. an *ambiguous* failure where it may have been
processed. Ambiguous failures are retried **only when you mark
the call `idempotent: true`**, so a mutation is never silently
re-executed:

| Failure | Retried by default? | Why |
| ------- | :-----------------: | --- |
| Connection refused / DNS / unreachable | ✓ | Request provably never reached the server |
| `429 TOO_MANY_REQUESTS` | ✓ | Server rejected without processing; honours `Retry-After` |
| Connection reset / timeout | only if `idempotent` | Ambiguous — may have been processed |
| `5xx` (server) / `408` | only if `idempotent` | Ambiguous |
| `SERVICE_UNAVAILABLE` / `REQUEST_TIMEOUT` / `INTERNAL_ERROR` | only if `idempotent` | Ambiguous |
| Other `4xx` (`400`/`403`/`404`/`409`/`422`) | ✗ | Deterministic client error — won't change |
| `TypeError` / `ReferenceError` | ✗ | Programming bug |
| `401 UNAUTHORIZED` | special | An auth-error middleware refreshes the token and re-invokes once (separate from retry) |

A custom `shouldRetry` overrides the gate entirely — you own the
decision (signature `(error, attempt) => boolean | Promise<boolean>`):

```typescript
const users = await peer.queryFluentInterface<UserService>('users@1.0.0');

await users
  .retry({
    attempts: 3,
    shouldRetry: (error, attempt) => {
      // Cap retries on timeout (it may have succeeded server-side):
      if (error instanceof TimeoutError && attempt >= 2) return false;
      // Retry network failures and 5xx:
      return error instanceof NetworkError ||
             (error instanceof TitanError && error.code >= 500);
    },
  })
  .api.findById(id);
```

## Circuit breaker integration

The circuit breaker is **not** a middleware — it lives on a
`RetryManager` (the fluent HTTP interface) configured with
`CircuitBreakerOptions`:

```typescript
import { RetryManager } from '@omnitron-dev/netron-browser';

const retryManager = new RetryManager({
  circuitBreaker: {
    threshold:    5,         // open after 5 failures…
    windowTime:   10_000,    // …within a 10s window
    cooldownTime: 30_000,    // try half-open after 30s
  },
});

peer.setRetryManager(retryManager);

const users = await peer.queryFluentInterface<UserService>('users@1.0.0');
await users.retry({ attempts: 3 }).api.findById(id);
```

The breaker is checked **before each attempt**: while it is open,
calls fail fast — the `RetryManager` throws a `TitanError` with
`code: ErrorCode.SERVICE_UNAVAILABLE` (message `"Circuit breaker
is open"`) without attempting the request. After `cooldownTime`
one probe runs; success closes the breaker. There is no
`CircuitOpenError` class — match on the code.

## Error UI patterns

### Inline form errors (mutations)

`FormAlert` takes the message as **children** — there is no
`error` prop. The distinction matters more than it looks: the
component renders with empty children rather than unmounting (so
a conditional slot causes no layout shift), and it announces
itself with `role="alert"`, `aria-live="assertive"` and
`aria-atomic="true"`. Passing the error object to a prop that
does not exist therefore produces an alert that a screen reader
announces as empty — silence where the failure should be.

```tsx
<form>
  {form.formState.errors.root && (
    <FormAlert title="Couldn't sign in">
      {form.formState.errors.root.message}
    </FormAlert>
  )}
  <Field name="email" />
  <Field name="password" />
</form>
```

### Page-level error (query failure)

```tsx
if (error instanceof TitanError && error.code === ErrorCode.NOT_FOUND) {
  return <EmptyContent
    illustration="error-404"
    title="Not found"
    description="The thing you're looking for doesn't exist."
    action={<Button onClick={() => navigate('/')}>Home</Button>}
  />;
}

if (error) {
  return <EmptyContent
    illustration="error-500"
    title="Something broke"
    description={error.message}
    action={<Button onClick={() => refetch()}>Try again</Button>}
  />;
}
```

### Toast (background failure)

```tsx
const save = useMutation({
  onError: (error) => {
    toast.error(`Save failed: ${error instanceof TitanError ? error.message : 'unknown'}`);
  },
});
```

Toasts for **background events** (autosave failed, webhook
errored); page-level cards for primary content; inline alerts
for form submissions.

## Error boundaries

For synchronous render errors (rare with proper data fetching):

```tsx
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';

<ErrorBoundary
  fallback={(error, reset) => (
    <EmptyContent
      illustration="error-500"
      title="Something broke"
      description={error.message}
      action={<Button onClick={reset}>Reload section</Button>}
    />
  )}
  onError={(error, info) => reportToSentry(error, info)}
>
  <SuspectComponent />
</ErrorBoundary>
```

Boundary catches **render-time** errors only — async failures
go through the standard `useQuery` `error` flow.

## Global error handling

```typescript
client.on('error', (error, ctx) => {
  if (error instanceof TitanError && error.code === ErrorCode.UNAUTHORIZED) {
    auth.clear();
    navigate('/sign-in');
    return;
  }
  reportToSentry(error, { service: ctx.service, method: ctx.method });
});
```

Use sparingly — most errors should be handled at the call site
where the context is richer.

## Reporting to Sentry

```typescript
import {
  type MiddlewareFunction,
  MiddlewareStage,
} from '@omnitron-dev/netron-browser';

const sentryMiddleware: MiddlewareFunction = async (ctx, next) => {
  Sentry.withScope((scope) => {
    scope.setTag('rpc.service', ctx.service);
    scope.setTag('rpc.method',  ctx.method);
    scope.setContext('rpc',     { args: ctx.args });
    Sentry.captureException(ctx.error);   // populated in the error stage
  });
  await next();        // re-throw
};

// Register on the error stage:
client.use(sentryMiddleware, { name: 'sentry', priority: 200 }, MiddlewareStage.ERROR);
```

Filter noise — don't report `NOT_FOUND` or `UNAUTHORIZED`,
they're not bugs.

## Anti-patterns

- **Catching `Error` generically.** Loses the typed identity;
  always check `instanceof TitanError`.
- **Mapping every error to "Something went wrong".** Users get
  no actionable info; check `code` and route accordingly.
- **Retry on `4xx`.** Won't help; logs the user out of all
  patience.
- **Logging full `TitanError` details client-side.** Server
  details may be sensitive; log `code` + `message`.
- **Throwing custom error classes without registering them.**
  Wire-format only preserves classes the receiver knows about;
  for app-specific errors, extend `TitanError` and ensure both
  sides import the same definition.
- **No error UI for `useQuery`.** Users see infinite spinner
  on backend failure; always handle `isError`.

## Best practices

- **Switch on `code`, not `message`.** Messages are
  human-readable; codes are stable.
- **Show field-level errors next to fields**; form-level
  errors above the form; transient/background errors in toasts.
- **Wire `SentryMiddleware` once** for global reporting; let
  call sites handle UI.
- **Pair retry with circuit breaker.** Configure the
  `RetryManager` with `circuitBreaker` so retries don't amplify
  failure load on a sick backend.
- **Mark idempotent calls `idempotent: true`.** The default
  fluent retry only retries ambiguous failures (5xx / reset /
  timeout) for idempotent calls — mutations stay safe.
- **Honour `Retry-After`** on `TOO_MANY_REQUESTS` — the fluent
  `RetryManager` reads it automatically; do it manually if you
  write your own retry loop.

## See also

- [Titan / Errors catalog](../../titan/modules/errors-catalog.mdx) — full server-side error reference
- [Browser client / Fluent HTTP interface](./browser.md#fluent-http-interface--caching-retry-circuit-breaking) — fluent retry & circuit breaking
- [Middleware / Not middleware](./middleware.md#not-middleware) — why retry/cache/circuit-breaking aren't middleware
- [Auth / 401 handling](./auth.md#auto-refresh-flow)
