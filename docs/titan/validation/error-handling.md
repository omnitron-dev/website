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

```typescript
{
  name:       'ValidationError',
  code:       'VALIDATION_FAILED',
  statusCode: 422,
  message:    'Input validation failed',
  details: {
    fields: [
      { path: ['email'], message: 'Invalid email format', code: 'invalid_string' },
      { path: ['age'],   message: 'Number must be greater than 12', code: 'too_small' },
    ],
  },
  timestamp:  '2026-05-15T20:00:00.000Z',
}
```

Status code `422` follows REST convention for "syntactically valid but
semantically wrong". For requests that fail to parse at all (malformed
msgpack, unknown service), the framework uses `400`.

## On the client side

```typescript
import { ValidationError } from '@omnitron-dev/netron-browser';

try {
  await users.create(input);
} catch (e) {
  if (e instanceof ValidationError) {
    for (const f of e.details.fields) {
      console.log(`field=${f.path.join('.')}: ${f.message}`);
    }
  }
}
```

The error class is identical on both sides — Netron preserves the
constructor name, status code, and details when serialising/deserialising
across the wire.

## Structured field errors

The `fields` array is the contract:

| Field      | Type       | Meaning                                       |
| ---------- | ---------- | --------------------------------------------- |
| `path`     | `string[]` | Path to the bad field (`['address', 'zip']`)  |
| `message`  | `string`   | Human-readable message (from Zod or override) |
| `code`     | `string`   | Zod issue code (`invalid_string`, `too_small`)|
| `expected` | `unknown?` | What was expected (when applicable)           |
| `received` | `unknown?` | What was received (when applicable)           |

Frontend forms can map `path` directly to form fields:

```typescript
catch (e) {
  if (e instanceof ValidationError) {
    e.details.fields.forEach((f) => {
      form.setFieldError(f.path.join('.'), f.message);
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

`ValidationError` has helper methods that produce common error formats:

```typescript
const e = ...; // ValidationError instance

e.toFormErrors();
// { 'email': 'Invalid email format', 'age': 'Number must be greater than 12' }

e.toFlatList();
// ['email: Invalid email format', 'age: Number must be greater than 12']

e.getDetailedFormat();
// Full structured detail (useful in API responses)
```

## Validation vs domain errors

Two error categories are easy to confuse:

- **`ValidationError`** — the input does not match the schema. Status
  422. Client should fix the input.
- **`ConflictError`** (or other `DomainError`) — the input matches the
  schema but cannot be applied (email already taken, order already
  shipped). Status 409. Client should retry with different input or
  show a domain message.

Use the right one. Throwing `ValidationError` for "email already
taken" tells the client "your email is malformed", which is wrong.

```typescript
@Public()
@Validate(CreateUserSchema)
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
