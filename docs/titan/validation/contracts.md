---
sidebar_position: 2
title: Contracts
description: Method contracts — bind input + output schemas as a single declaration.
---

# Contracts

A `Contract` bundles per-method input/output schemas (plus optional
metadata) for a whole service. `@Contract` applies it to the service
**class**, mapping each method name to its `{ input, output, … }`.

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
`errors` (a `Record<httpStatus, ZodSchema>`), `stream`, `options`
(`ValidationOptions`), and an `http` extension
(`{ status?, contentType?, streaming?, responseHeaders?, openapi? }`).
What happens when the contract is applied — the `ValidationMiddleware`
wraps each method whose contract declares an `input` or `output`
(`src/validation/validation-middleware.ts`):

1. **Input validation.** The first argument is parsed against the
   method's `input` before the method body runs. Failures throw
   `ValidationError` (status 422).
2. **Output validation.** The return value is parsed against
   `output` after the method body runs. Failures throw the same
   `ValidationError` — output validation runs through the identical
   `validateAsync` path as input. For a `stream` method, each yielded
   item is validated against `output`.
3. **Metadata exposure.** The decorator stores the contract in
   reflection metadata (`validation:contract`) and merges it into the
   service's `netron:service` metadata, so clients (and the Omnitron
   console) can introspect it.

## Why contracts, not just schemas

A method-level `@Validate(mc)` validates one method in place. A
class-level `@Contract` adds:

- **One contract object for the whole service.** Define every method's
  `input`/`output` in a single map, import it, reuse it on the client.
- **Output validation at the boundary.** Catches "I returned
  `undefined` when I promised a `User`" bugs before the value leaves
  the service. (Runs in dev and prod alike — see below.)
- **Wire-format introspection.** Because the contract is stored in the
  service's metadata, the Omnitron console can render it for any
  registered service.
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

// create/read/update/delete/list; second arg overrides the id schema
// (default z.string().uuid()). Ships 409 on create, 404 on update/delete,
// and a paginated { items, total, offset, limit } list output.
const UserContract = Contracts.crud(UserSchema);
const KeyedContract = Contracts.crud(UserSchema, z.number());

// subscribe (stream: true) + unsubscribe; second arg is the filter schema
const FeedContract = Contracts.streaming(PostSchema);

// single execute(input) -> output method
const CalcContract = Contracts.rpc(InputSchema, OutputSchema);
```

For a fully custom contract there is also a fluent `contractBuilder()`:
`contractBuilder().method(name, mc).withMetadata({ … }).build()`.

## Per-status error schemas

A `MethodContract` can declare the error payload for each status (the
`errors` field is `Record<number, ZodSchema>` — HTTP status → payload
schema):

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

These schemas are *typed contracts for the errors you emit*, not an
automatic interceptor. Throw a contract-validated error with
`ContractError.create(contract, method, status, payload)` — it looks
up the schema for that method+status and parses `payload` against it,
so a malformed error payload fails fast at the source:

```typescript
import { ContractError } from '@omnitron-dev/titan/errors';

async create(input: CreateUser) {
  if (await this.repo.exists(input.email)) {
    // payload is type-checked against the 409 schema above
    throw ContractError.create(UsersContract, 'create', 409, {
      code: 'ALREADY_EXISTS',
      message: 'A user with that email already exists',
    });
  }
  return this.repo.create(input);
}
```

The static type of `payload` is inferred from the contract via
`ContractTypes.Errors`, so an unlisted status or a payload that
doesn't match the schema is a compile-time error.

## When to use `@Validate` vs `@Contract`

Both decorators carry the **same `MethodContract` shape** — `@Validate`
takes one `MethodContract` and `@Contract` takes a map of them. So the
choice is not about *which validation features* you get (both support
`input`, `output`, `errors`, `stream`, `options`); it is about *where
the schema lives* and whether you want a single named, versioned,
introspectable contract object.

| Use `@Validate(mc)` (method) when …                 | Use `@Contract(c)` (class) when …               |
| --------------------------------------------------- | ----------------------------------------------- |
| You want to annotate one method in place            | You want one contract covering many methods     |
| The schema is local to that method                  | You want a single reusable contract object       |
| You don't need a named/versioned contract           | The contract is stable and worth versioning      |
| The contract surface is small / ad hoc              | Clients/console should introspect the whole API  |

`@Validate` is the per-method method decorator; `@Contract` is the
service-wide class decorator. When both are present, the method-level
`@Validate` wins for that method (the middleware checks
`validation:method` before the class contract). Convenience aliases
`@ValidateInput(schema)` and `@ValidateOutput(schema)` wrap `@Validate`
for the input-only / output-only cases.

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
