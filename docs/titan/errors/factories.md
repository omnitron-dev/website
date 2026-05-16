---
sidebar_position: 3
title: Error Factories
description: The Errors / NetronErrors / HttpErrors / AuthErrors namespaces.
---

# Error Factories

A factory is a function that produces a properly-typed `TitanError`
for a common pattern. Titan groups factories into four namespaces.

## `Errors` — the general namespace

```typescript
import { Errors } from '@omnitron-dev/titan/errors';
```

| Factory                                          | Status | Code                  |
| ------------------------------------------------ | ------ | --------------------- |
| `Errors.badRequest(message?, details?)`          | 400    | `BAD_REQUEST`         |
| `Errors.unauthorized(message?, details?)`        | 401    | `UNAUTHORIZED`        |
| `Errors.forbidden(message?, details?)`           | 403    | `FORBIDDEN`           |
| `Errors.notFound(resource, id?)`                 | 404    | `NOT_FOUND`           |
| `Errors.conflict(message, details?)`             | 409    | `CONFLICT`            |
| `Errors.alreadyExists(resource, identifier?)`    | 409    | `CONFLICT`            |
| `Errors.validation(message, fields?)`            | 422    | `VALIDATION_ERROR`    |
| `Errors.rateLimit(message?, details?)`           | 429    | `RATE_LIMITED`        |
| `Errors.internal(message?, details?)`            | 500    | `INTERNAL_ERROR`      |
| `Errors.unavailable(message?, details?)`         | 503    | `SERVICE_UNAVAILABLE` |
| `Errors.invalidCredentials(message?)`            | 401    | `UNAUTHORIZED`        |
| `Errors.create(code, message, details?)`         | varies | any                   |

The catalogue is exhaustive — check the source for the latest
methods. Use `Errors.create(code, message, details)` for codes that
don't have a dedicated factory.

## `NetronErrors` — RPC-specific

```typescript
import { NetronErrors } from '@omnitron-dev/titan/errors';
```

Wraps transport-layer failures. Used internally by Netron; you
usually catch these on the client rather than throwing them on the
server.

| Factory                                          | What it represents                  |
| ------------------------------------------------ | ----------------------------------- |
| `NetronErrors.serviceNotFound(name, version?)`   | No such service                     |
| `NetronErrors.methodNotFound(service, method)`   | No such method on the service       |
| `NetronErrors.transportError(transport, cause)`  | Transport-layer failure             |
| `NetronErrors.timeout(operation, ms)`            | Call exceeded deadline              |
| `NetronErrors.protocolError(reason)`             | Malformed packet                    |
| `NetronErrors.serviceUnavailable(name, reason)`  | Service is registered but not ready |

## `HttpErrors` — when you need an `HttpError` subclass

```typescript
import { HttpErrors } from '@omnitron-dev/titan/errors';
```

Like `Errors`, but produces `HttpError` instances (or its
subclasses) so `instanceof HttpError` works:

```typescript
import { HttpErrors, HttpError } from '@omnitron-dev/titan/errors';

throw HttpErrors.notFound('User not found', { userId });

catch (e) {
  if (e instanceof HttpError) {
    console.log(e.httpStatus);  // typed as number
  }
}
```

## `AuthErrors` — auth-specific subclasses

```typescript
import { AuthErrors } from '@omnitron-dev/titan/errors';
```

Produces `AuthError`, `PermissionError`, or `RateLimitError`
instances. Use when class-based dispatch matters on the client.

## Conversion helpers

### `toTitanError(error)`

Convert any thrown value (a native `Error`, a string, an object) into
a `TitanError`:

```typescript
try {
  await someThirdPartyCall();
} catch (e) {
  throw toTitanError(e);
}
```

Useful at boundaries where you do not control what's thrown.

### `ensureError(value)`

Coerce a value into a `TitanError`. Same as `toTitanError` but with
a slightly different policy for non-error inputs.

### `assert(condition, errorOrMessage, details?)`

Throw a `TitanError` if the condition is falsy. Type-narrows on the
truthy branch:

```typescript
import { assert, Errors } from '@omnitron-dev/titan/errors';

function process(input: Input | null) {
  assert(input !== null, Errors.badRequest('input required'));
  // input is `Input` here, not `Input | null`.
}
```

### `assertDefined(value, message)`

Specialised `assert` for null/undefined:

```typescript
import { assertDefined } from '@omnitron-dev/titan/errors';

const user = await this.repo.findById(id);
assertDefined(user, 'user not found');
// `user` is `User`, not `User | undefined`.
```

### `assertType(value, predicate, message)`

Specialised `assert` with a type predicate.

## Custom project factories

For domain-specific errors that recur across modules, wrap the
generic factories in a per-domain helper:

```typescript
// users/errors.ts
import { Errors } from '@omnitron-dev/titan/errors';

export const usersErrors = {
  notFound:   (id: string)    => Errors.notFound('user', id),
  emailTaken: (email: string) => Errors.alreadyExists('user', email),
  inactive:   (id: string)    => Errors.conflict('user inactive', { userId: id }),
};

// users/users.service.ts
import { usersErrors } from './errors.js';

throw usersErrors.notFound(id);
```

Worth doing when the same error appears in multiple methods.

→ Next: [Classification](./classification.md).
