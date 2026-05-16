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
| `CircuitOpenError` | CircuitBreakerMiddleware tripped | ✓ (after reset) |
| `BackendNotConfiguredError` | Multi-backend: no route matches | ✗ (config bug) |

```typescript
import {
  NetworkError, TimeoutError, ConnectionError, CircuitOpenError
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
  if (e instanceof CircuitOpenError) {
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

`RetryMiddleware`'s default `on` list classifies failures as
retryable vs not:

| Error | Retryable? | Why |
| ----- | :--------: | --- |
| `NetworkError` | ✓ | Transient |
| `TimeoutError` | ⚠ | Only if idempotent |
| `5xx` (server) | ✓ | Server may recover |
| `429 TOO_MANY_REQUESTS` | ✓ | Honour `retryAfter` |
| `503 SERVICE_UNAVAILABLE` | ✓ | Transient downstream |
| `408 REQUEST_TIMEOUT` | ⚠ | Only if idempotent |
| `4xx` (other) | ✗ | Client mistake — won't change |
| `401 UNAUTHORIZED` | special | Auth middleware refreshes + retries |
| `403 FORBIDDEN` | ✗ | Permission issue |
| `404 NOT_FOUND` | ✗ | Resource doesn't exist |
| `409 CONFLICT` | ✗ | State mismatch — needs resolution |
| `422 VALIDATION_ERROR` | ✗ | Input bug |
| `501 NOT_IMPLEMENTED` | ✗ | Server doesn't have this |

Custom retry predicate:

```typescript
client.use(RetryMiddleware({
  maxAttempts: 3,
  shouldRetry: (error, attempt, ctx) => {
    // Never retry mutating calls automatically:
    if (ctx.method.match(/^(create|update|delete)/)) return false;
    // Cap retries on timeout (it may have succeeded server-side):
    if (error instanceof TimeoutError && attempt >= 2) return false;
    // Default rules:
    return error instanceof NetworkError ||
           (error instanceof TitanError && error.code >= 500);
  },
}));
```

## Circuit breaker integration

```typescript
client.use(CircuitBreakerMiddleware({
  threshold:    5,
  resetTimeout: 30_000,
  on:           ['5xx', 'network', 'timeout'],
  perService:   true,        // separate breaker per service
}));

client.use(RetryMiddleware({ maxAttempts: 3 }));
```

Order matters — the breaker runs **first** in the error stage.
A tripped breaker short-circuits to `CircuitOpenError` without
even attempting the retry.

## Error UI patterns

### Inline form errors (mutations)

```tsx
<form>
  {form.formState.errors.root && (
    <FormAlert error={form.formState.errors.root} />
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
const SentryMiddleware: NetronMiddleware = {
  stage:    'error',
  priority: 200,
  handler:  async (ctx, next) => {
    Sentry.withScope((scope) => {
      scope.setTag('rpc.service', ctx.service);
      scope.setTag('rpc.method',  ctx.method);
      scope.setContext('rpc',     { args: ctx.args, attempt: ctx.attempt });
      Sentry.captureException(ctx.error);
    });
    return next();        // re-throw
  },
};

client.use(SentryMiddleware);
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
- **Pair retry with circuit breaker.** Without the breaker,
  retries amplify failure load on a sick backend.
- **Honour `retryAfter`** on `TOO_MANY_REQUESTS` — auto-retry
  middleware does this; do it manually if you implement custom
  retry.

## See also

- [Titan / Errors catalog](../../titan/modules/errors-catalog.mdx) — full server-side error reference
- [Middleware / RetryMiddleware](./middleware.md#retrymiddleware)
- [Middleware / CircuitBreakerMiddleware](./middleware.md#circuitbreakermiddleware)
- [Auth manager / 401 handling](./auth.md#auto-refresh-flow)
