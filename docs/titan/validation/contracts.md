---
sidebar_position: 2
title: Contracts
description: Method contracts — bind input + output schemas as a single declaration.
---

# Contracts

A `Contract` bundles per-method input/output schemas (plus optional
metadata) for a whole service. `@Contract` applies it to the service
**class**, mapping each method name to its `{ input, output, … }`.

> ⚠️ **NEEDS REWRITE.** This page previously described `@Contract` as
> a *method* decorator wrapping a single method's input/output, and a
> contract as `contract({ name, version, input, output })`. Both are
> wrong: `contract(definition, metadata?)` takes a **map of method
> name → `MethodContract`**, and `@Contract(c)` is a **class**
> decorator (`src/decorators/validation.ts`). The corrected shape is
> below; the per-method narrative further down still needs reworking.

## Basic shape

```typescript
import { contract } from '@omnitron-dev/titan/validation';
import { Contract } from '@omnitron-dev/titan/decorators';

// A contract is a map of method-name → MethodContract, plus metadata.
const UsersContract = contract(
  {
    findById: {
      input:  z.object({ id: z.string().uuid() }),
      output: z.union([UserSchema, z.null()]),
    },
  },
  { name: 'users', version: '1.0.0', description: 'User service' },
);

@Service('users@1.0.0')
@Contract(UsersContract)          // class-level, not per-method
class UsersService {
  @Public()
  async findById(input: { id: string }) {
    return this.repo.findById(input.id);
  }
}
```

Each `MethodContract` may declare `input`, `output`,
`errors` (a `Record<httpStatus, ZodSchema>`), `stream`, `options`,
and an `http` extension (`{ status?, contentType?, streaming?,
openapi? }`). What happens when the contract is applied:

1. **Input validation.** The first argument is parsed against the
   method's `input`. Failures throw `ValidationError`.
2. **Output validation.** The return value is parsed against
   `output`. Failures throw `ContractError`.
3. **Metadata exposure.** The contract is stored in service metadata
   so clients (and the Omnitron console) can introspect it.

## Why contracts, not just schemas

A method-level `@Validate({ input })` validates one method's input. A
class-level `@Contract` adds:

- **Output validation in development.** Catches "I returned
  `undefined` when I promised a `User`" bugs at the boundary.
- **Wire-format introspection.** The Omnitron console can render
  the contract for any registered service.
- **Versioning.** A contract carries metadata including `version`,
  alongside the service version.
- **Per-status error schemas.** A `MethodContract`'s `errors` map
  binds a Zod schema to each HTTP status the method can return.

## Versioning

A contract's `version` lives in its metadata, independent of the
service version:

```typescript
const UsersContractV2 = contract(
  {
    findById: {
      input:  z.object({ id: z.string().uuid(), include: z.array(z.string()).optional() }),
      output: UserSchemaV2,
    },
  },
  { name: 'users', version: '2.0.0' },   // contract metadata
);
```

## Predefined contract templates

The `Contracts` namespace ships ready-made shapes:

```typescript
import { Contracts } from '@omnitron-dev/titan/validation';

const UserContract = Contracts.crud(UserSchema);              // create/read/update/delete/list
const FeedContract = Contracts.streaming(PostSchema);          // subscribe (stream)/unsubscribe
const CalcContract = Contracts.rpc(InputSchema, OutputSchema); // single execute() method
```

There is also a fluent `contractBuilder()` (`.method(name, mc).build()`).

## Per-status error schemas

A `MethodContract` can declare the error payload for each status:

```typescript
const UsersContract = contract({
  create: {
    input:  CreateUserSchema,
    output: UserSchema,
    errors: {
      409: z.object({ code: z.literal('ALREADY_EXISTS'), message: z.string() }),
    },
  },
});
```

## When to use `@Validate` vs `@Contract`

| Use `@Validate({ input })` (method) when …       | Use `@Contract(c)` (class) when …             |
| ------------------------------------------------- | --------------------------------------------- |
| You want to annotate one method in place          | You want input + output for many methods       |
| The method is internal (no `@Public`)             | The methods are public                         |
| The output is implicit from the TypeScript type   | You want runtime output validation             |
| The contract surface is small                     | The contract is stable and worth versioning    |

`@Validate` is the per-method method decorator; `@Contract` is the
service-wide class decorator.

## Output validation

When a `MethodContract` declares `output`, the return value is
validated (in dev and prod alike). The cost is small but non-zero
(~1µs per object). There is no built-in per-environment toggle field
on the contract; gate it yourself (e.g. omit `output` outside dev, or
via `options`) if profiling shows it matters. Output validation
catches bugs that would otherwise ship as wire-incompatible responses.

## Anti-patterns

- **Schema inline at every method.** Define schemas once (in a
  `schemas.ts` file) and import. Inline schemas lead to drift
  between server and client.
- **Validating outputs of every method.** Reserve output schemas for
  `@Public` methods. Internal methods are typed by TypeScript;
  runtime validation there is overhead with no benefit.

→ Next: [Error Handling](./error-handling.md).
