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
import { Validate } from '@omnitron-dev/titan/decorators';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(120),
  age:   z.number().int().min(13).optional(),
});

@Service('users@1.0.0')
class UsersService {
  // @Validate is a METHOD decorator taking a MethodContract
  // ({ input, output?, options? }) — not a parameter decorator.
  @Public()
  @Validate({ input: CreateUserSchema })
  async create(input: z.infer<typeof CreateUserSchema>) {
    // The first argument is parsed and trusted here.
    // The TypeScript type matches the schema exactly.
    return this.repo.create(input);
  }
}
```

`@Validate` validates the method's **first argument** against
`input`. Shorthands `@ValidateInput(schema, options?)` and
`@ValidateOutput(schema, options?)` exist for the common cases.

The body of `create` runs only if the input passes validation. If
not, the caller receives a typed `ValidationError` with the schema's
field-level error messages.

## How validation runs

```mermaid
flowchart LR
  Wire[Bytes arrive] --> Decode[msgpack decode]
  Decode --> Lookup[Service descriptor lookup]
  Lookup --> Validate{@Validate / @Contract}
  Validate -- valid --> Body[Method body runs]
  Validate -- invalid --> Err[ValidationError 422]
  Body --> Output[Result]
  Output --> Encode[msgpack encode]
  Err --> Encode
  Encode --> WireOut[Bytes sent]
```

Validation happens **before** the method body, as part of the
Netron call dispatch:

1. Transport receives bytes.
2. msgpack decodes into the call's argument object.
3. `@Validate({ input })` (or a class-level `@Contract`) runs the
   schema against the method's first argument.
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

Behaviour is controlled by the contract's `options`
(`ValidationOptions`). The `mode` field decides how unknown keys are
treated:

```typescript
@Validate({ input: Schema, options: { mode: 'strip' } })        // unknown keys dropped
@Validate({ input: Schema, options: { mode: 'passthrough' } })  // unknown keys preserved
@Validate({ input: Schema, options: { mode: 'strict' } })       // unknown keys rejected
```

Other `ValidationOptions` include `abortEarly`, `coerce`,
`errorFormat` (`'simple' | 'detailed'`), `errorMap`, and
`cacheValidators`. The exact default depends on the schema (a plain
`z.object` strips unknown keys unless `.strict()`/`.passthrough()` is
applied); for production APIs, be explicit.

## Read on

| Page                                              | When to read                                   |
| ------------------------------------------------- | ---------------------------------------------- |
| [Contracts](./contracts.md)                       | Per-method input + output schemas as contracts |
| [Error Handling](./error-handling.md)             | What clients see when validation fails         |

→ Next: [Contracts](./contracts.md).
