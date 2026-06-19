---
sidebar_position: 3
title: Validation Error Handling
description: What clients see when validation fails — and how to shape it.
---

# Validation Error Handling

When validation fails, the framework throws a `ValidationError`. The
client receives the same class with the same payload over the wire.
This page covers what's in the error and how to customise the
client-facing shape.

## Default error shape

The canonical `ValidationError` (from `@omnitron-dev/titan/errors`)
extends `TitanError`, so it carries `code` / `httpStatus` / `details`
like any other. The validation issues live in `details.errors`, and
each issue's location is a **dotted-string `path`**:

```typescript
{
  name:       'ValidationError',
  code:       422,                       // ErrorCode.VALIDATION_ERROR
  httpStatus: 422,
  message:    'Validation failed',
  details: {
    errors: [
      { path: 'email', message: 'Invalid email format', code: 'invalid_string' },
      { path: 'age',   message: 'Number must be greater than 12', code: 'too_small' },
    ],
  },
  timestamp:  1747339200000,
}
```

> The lightweight `ValidationError` from
> `@omnitron-dev/titan/validation` (used by `ValidationEngine`)
> differs: there, `code` is the string `'VALIDATION_ERROR'` and
> `statusCode` is `422`, and its `toJSON()` emits `{ code, message,
> errors }`. Both expose the issues under an `errors` array, not
> `fields`.

Status code `422` follows REST convention for "syntactically valid but
semantically wrong". For requests that fail to parse at all (malformed
msgpack, unknown service), the framework uses `400`.

## On the client side

```typescript
import { ValidationError } from '@omnitron-dev/titan/errors';

try {
  await users.create(input);
} catch (e) {
  if (e instanceof ValidationError) {
    for (const err of e.validationErrors) {       // also at e.details.errors
      console.log(`field=${err.path}: ${err.message}`);
    }
  }
}
```

The error is preserved across the wire — Netron serialises the
`TitanError` and rehydrates it as the same class (the hierarchy is
shared via `@omnitron-dev/netron-protocol`), so `code`, `httpStatus`,
and `details` survive intact.

## Structured field errors

Each entry in `validationErrors` (mirrored at `details.errors`):

| Field      | Type       | Meaning                                       |
| ---------- | ---------- | --------------------------------------------- |
| `path`     | `string`   | Dotted path to the bad field (`'address.zip'`)|
| `message`  | `string`   | Human-readable message (from Zod or override) |
| `code`     | `string`   | Zod issue code (`invalid_string`, `too_small`)|
| `expected` | `unknown?` | What was expected (when applicable)           |
| `received` | `unknown?` | What was received (when applicable)           |

`path` is built by joining the Zod issue path with `.` — so nested
fields read like `'address.zip'`. Frontend forms can use it directly:

```typescript
catch (e) {
  if (e instanceof ValidationError) {
    e.validationErrors.forEach((err) => {
      form.setFieldError(err.path, err.message);
    });
  }
}
```

## Customising messages

Per-field messages via Zod:

```typescript
const Schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  age:   z.number().int().min(13, { message: 'You must be 13 or older.' }),
});
```

Or globally through a custom error map:

```typescript
import { z } from '@omnitron-dev/titan/validation';

z.setErrorMap((issue, ctx) => {
  if (issue.code === 'invalid_string' && issue.validation === 'email') {
    return { message: 'Bad email.' };
  }
  return { message: ctx.defaultError };
});
```

## Translating to client formats

The canonical `ValidationError` has helper methods for common
formats and per-field queries:

```typescript
const e = ...; // ValidationError instance

e.getSimpleFormat();
// { code: 'VALIDATION_ERROR', message, errors: ['Invalid email format', …] }

e.getDetailedFormat();
// { code: 'VALIDATION_ERROR', message, errors: [{ path, message, code, expected?, received? }, …] }

e.hasFieldError('email');   // boolean
e.getFieldErrors('email');  // [{ message, code }, …]
```

(`getSimpleFormat` / `getDetailedFormat` are also the right things to
put in an API response body.)

## Validation vs domain errors

Two error categories are easy to confuse:

- **`ValidationError`** — the input does not match the schema. Status
  422. Client should fix the input.
- **A conflict / domain error** — the input matches the schema but
  cannot be applied (email already taken, order already shipped).
  Status 409, thrown via `Errors.conflict(...)` (a `TitanError` with
  `ErrorCode.CONFLICT`) or a `DomainError`. Client should retry with
  different input or show a domain message.

Use the right one. Throwing `ValidationError` for "email already
taken" tells the client "your email is malformed", which is wrong.

```typescript
@Public()
@Validate({ input: CreateUserSchema })
async create(input: z.infer<typeof CreateUserSchema>) {
  const existing = await this.repo.findByEmail(input.email);
  if (existing) throw Errors.conflict('email already registered', { email: input.email });
  // … create user
}
```

## Anti-patterns

- **Catching `ValidationError` and re-throwing as `Error`.** Strips
  the structured detail; the client sees an opaque 500.
- **Validating in the method body manually.** Defeats the
  pre-compiled validator's performance gain and duplicates the
  schema. Use `@Validate` or `@Contract`.
- **Returning validation errors as success values.** A 200 response
  with an `errors` array makes the client check both the HTTP status
  and the body. Throw the error; let the framework signal failure.

→ Back to [Validation Overview](./overview.md).
