---
sidebar_position: 1
title: Errors
description: A typed error system built on TitanError, HTTP status codes, and ErrorCode-driven factories.
---

# Errors

Errors in Titan are **values** — instances of `TitanError` (or one of
its narrow subclasses) carrying a code, an HTTP-style status, a
message, and a structured `details` object. They serialise across
Netron preserving their identity.

This page is the entry point. Detail in:

- [Hierarchy](./hierarchy.md) — every error class.
- [Factories](./factories.md) — the `Errors`, `NetronErrors`,
  `HttpErrors`, `AuthErrors` namespaces.
- [Classification](./classification.md) — partitioning errors for
  telemetry and resilience.

## The base class — `TitanError`

```typescript
class TitanError extends Error {
  readonly code:        ErrorCode | number;
  readonly category:    ErrorCategory;
  readonly httpStatus:  number;
  readonly details:     Record<string, any>;
  readonly context?:    ErrorContext;
  readonly correlationId?: string;
  readonly traceId?:    string;
  readonly retryStrategy?: RetryStrategy;
  // …plus serialise / toJSON helpers
}
```

Three reasons it inherits from native `Error`:

- `instanceof Error` keeps third-party tooling happy.
- The `stack` property is preserved.
- Async stack traces in modern Node attach naturally.

Constructed directly when no factory fits:

```typescript
import { TitanError, ErrorCode } from '@omnitron-dev/titan/errors';

throw new TitanError({
  code:    ErrorCode.CONFLICT,
  message: 'Cannot delete user with active orders',
  details: { userId, orderCount: 5 },
});
```

## `ErrorCode` — the universal vocabulary

`ErrorCode` is the enum the framework uses to classify errors. Each
code maps to:

- An HTTP status (400, 401, 404, 422, 429, 500, 503, …).
- An `ErrorCategory` (client error vs server error vs transient).
- A default message.
- A retry policy hint.

```typescript
import { ErrorCode } from '@omnitron-dev/titan/errors';

ErrorCode.BAD_REQUEST          // 400
ErrorCode.UNAUTHORIZED         // 401
ErrorCode.FORBIDDEN            // 403
ErrorCode.NOT_FOUND            // 404
ErrorCode.CONFLICT             // 409
ErrorCode.VALIDATION_ERROR     // 422
ErrorCode.RATE_LIMITED         // 429
ErrorCode.INTERNAL_ERROR       // 500
ErrorCode.SERVICE_UNAVAILABLE  // 503
// …more
```

## Throwing the right error

The idiomatic way to throw is through the `Errors` namespace —
short factory methods that produce a properly-typed `TitanError`:

```typescript
import { Errors } from '@omnitron-dev/titan/errors';

@Public()
async findById(id: string) {
  const user = await this.repo.findById(id);
  if (!user) throw Errors.notFound('user', id);
  return user;
}

@Public()
async create(input: CreateInput) {
  if (await this.repo.findByEmail(input.email)) {
    throw Errors.alreadyExists('user', input.email);
  }
  return this.repo.create(input);
}
```

The `Errors` namespace has methods for every common case:

| Factory                      | Status | Code                  |
| ---------------------------- | ------ | --------------------- |
| `Errors.badRequest(msg, …)`  | 400    | `BAD_REQUEST`         |
| `Errors.unauthorized(...)`   | 401    | `UNAUTHORIZED`        |
| `Errors.forbidden(...)`      | 403    | `FORBIDDEN`           |
| `Errors.notFound(resource, id?)` | 404 | `NOT_FOUND`          |
| `Errors.conflict(msg, …)`    | 409    | `CONFLICT`            |
| `Errors.alreadyExists(resource, id?)` | 409 | `CONFLICT`       |
| `Errors.validation(msg, fields?)` | 422 | `VALIDATION_ERROR`  |
| `Errors.rateLimit(...)`      | 429    | `RATE_LIMITED`        |
| `Errors.internal(msg, ...)`  | 500    | `INTERNAL_ERROR`      |
| `Errors.unavailable(...)`    | 503    | `SERVICE_UNAVAILABLE` |

Other namespaces:

- **`NetronErrors`** — transport-specific (`serviceNotFound`,
  `methodNotFound`, `transportError`, `timeout`, …).
- **`HttpErrors`** — when you want a `HttpError` subclass
  specifically.
- **`AuthErrors`** — for `AuthError` / `PermissionError` /
  `RateLimitError` subclasses.

See [Factories](./factories.md) for the full surface.

## The HTTP status code is universal

Status codes are the bridge between every transport and every
framework. Even if you serve over WebSocket, your error carries an
HTTP-style status code so the client (or any middleware) can route
on it.

## On the client

Netron preserves the error code, status, and details across the
wire. The client receives a `TitanError` (or matching subclass) with
the same payload:

```typescript
import { TitanError, ErrorCode } from '@omnitron-dev/titan/errors';

try {
  await users.findById('missing');
} catch (e) {
  if (e instanceof TitanError && e.code === ErrorCode.NOT_FOUND) {
    // e.details.resource === 'user', e.details.id === 'missing'
  }
}
```

For class-based discrimination, check against the narrower error
classes (`HttpError`, `AuthError`, `PermissionError`,
`RateLimitError`, `AggregateError`, `DomainError`) — see
[Hierarchy](./hierarchy.md).

## Internal vs domain errors

Two categories the framework distinguishes:

- **Domain errors** — instances of `TitanError` (or its subclasses)
  thrown from your business logic. Client-visible. The client
  receives the typed error with intact code, status, and details.
- **Internal errors** — native `Error` instances bubbling out of
  your service code. The framework wraps them as
  `INTERNAL_ERROR` (status 500), logs the original with the full
  stack, and sends a generic message to the client. The client
  never sees your stack trace or internal class names.

**Always throw `TitanError` (via a factory) for client-visible
failures.** Plain `throw new Error('user not found')` becomes a 500
to the caller, with no structure they can act on.

## Errors in lifecycle hooks

A lifecycle hook that throws aborts the corresponding phase. The
error is logged with the failing provider's name and re-thrown from
`Application.start()` (for `onInit` / `onStart`) or logged and
isolated (for `onStop` / `onDestroy`).

For retryable conditions in `onStart`, use the `computeBackoff`
helper in `@omnitron-dev/titan/utils/backoff` with your own retry
loop. Do not let a transient failure crash the whole boot.

## Helper functions

- `createError(options)` — build a `TitanError` from
  `{ code, message, details, ... }`.
- `isErrorCode(error, code)` — type-narrow check for a specific
  code.
- `ensureError(value)` — coerce any thrown value into a
  `TitanError`. Useful for adapters that catch unknown values.
- `toTitanError(error)` — convert a native `Error` (or another
  error class) into a `TitanError`.
- `assert(condition, errorOrMessage)` — throw a `TitanError` if the
  condition is falsy. Type-narrows the value.

→ Read on: [Hierarchy](./hierarchy.md).
