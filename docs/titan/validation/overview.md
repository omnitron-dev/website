---
sidebar_position: 1
title: Validation
description: Schema-driven input validation at the service boundary.
---

# Validation

A service's job is to trust its inputs. To do that, the framework
needs to know the *shape* the inputs are supposed to have. Titan's
validation system uses Zod schemas at the service boundary —
declarative, fast, and type-safe.

## What Titan validates

By default, **only what you ask it to**. Titan does not auto-validate
every parameter — that would force every method to have a schema even
when the type system already gives you the guarantee.

Where validation pays:

| Boundary                                                 | Validate |
| -------------------------------------------------------- | -------- |
| `@Public` method called from a Netron client             | Yes      |
| Internal method called from another `@Service` in-process | Optional |
| Private helper inside a class                             | No       |
| Constructor parameters                                    | No       |

The general rule: validate at *trust boundaries*. A `@Public` method
is the canonical trust boundary; what crosses the wire is untrusted
until it has been parsed against a schema.

## The minimal example

```typescript
import { z } from '@omnitron-dev/titan/validation';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(120),
  age:   z.number().int().min(13).optional(),
});

@Service('users@1.0.0')
class UsersService {
  @Public()
  async create(@Validate(CreateUserSchema) input: z.infer<typeof CreateUserSchema>) {
    // input is parsed and trusted here.
    // The TypeScript type matches the schema exactly.
    return this.repo.create(input);
  }
}
```

The body of `create` runs only if the input passes validation. If
not, the caller receives a typed `ValidationError` with the schema's
field-level error messages.

## How validation runs

Validation happens **before** the method body, as part of the
Netron call dispatch:

1. Transport receives bytes.
2. msgpack decodes into the call's argument object.
3. `@Validate(Schema)` runs the schema against each marked argument.
4. On success: the parsed (and possibly transformed) value replaces
   the raw input. The method body runs with the trusted value.
5. On failure: a `ValidationError` is sent back to the client. The
   method body does not run.

The schema is **pre-compiled** at decorator time, not on every call.
Validation overhead per call is microseconds for typical schemas.

## What you can express

Zod gives you the full toolkit:

- Primitive types (`string`, `number`, `boolean`, `date`).
- Composite types (`object`, `array`, `tuple`, `union`, `intersection`).
- Refinements (`min`, `max`, `regex`, `email`, custom predicates).
- Transformations (`trim`, `toLowerCase`, custom maps).
- Discriminated unions (`z.discriminatedUnion`).
- Recursive schemas (`z.lazy`).
- Branded types (`.brand<'UserId'>`).

```typescript
const OrderSchema = z.object({
  id:        z.string().uuid(),
  items:     z.array(z.object({
    productId: z.string(),
    quantity:  z.number().int().positive(),
  })).min(1),
  payment:   z.discriminatedUnion('method', [
    z.object({ method: z.literal('card'),    last4: z.string().length(4) }),
    z.object({ method: z.literal('bank'),    iban:  z.string() }),
  ]),
  metadata:  z.record(z.string(), z.unknown()).optional(),
});
```

The TypeScript type `z.infer<typeof OrderSchema>` is the type your
method body sees.

## Validation result options

By default, `@Validate(Schema)` runs the schema in **parse** mode —
unknown properties are rejected. Pass options for other behaviour:

```typescript
@Validate(Schema, { stripUnknown: true })   // unknown keys silently dropped
@Validate(Schema, { passthrough: true })    // unknown keys preserved
```

For development and debugging, `stripUnknown` is sometimes useful;
for production APIs, the default (reject unknown) is safer.

## Read on

| Page                                              | When to read                                   |
| ------------------------------------------------- | ---------------------------------------------- |
| [Contracts](./contracts.md)                       | Per-method input + output schemas as contracts |
| [Error Handling](./error-handling.md)             | What clients see when validation fails         |

→ Next: [Contracts](./contracts.md).
