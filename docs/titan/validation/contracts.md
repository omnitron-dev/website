---
sidebar_position: 2
title: Contracts
description: Method contracts — bind input + output schemas as a single declaration.
---

# Contracts

A `@Contract` is a method-level declaration that bundles input
validation, output validation, and contract metadata (description,
examples, version) into one decorator.

It is the recommended form for `@Public` methods — it puts the wire
contract next to the method body where readers expect it.

## Basic shape

```typescript
import { contract } from '@omnitron-dev/titan/validation';

const FindByIdContract = contract({
  name:        'users.findById',
  version:     '1.0.0',
  description: 'Look up a user by ID. Returns null if not found.',
  input:       z.object({ id: z.string().uuid() }),
  output:      z.union([UserSchema, z.null()]),
});

@Service('users@1.0.0')
class UsersService {
  @Public()
  @Contract(FindByIdContract)
  async findById(input: z.infer<typeof FindByIdContract.input>) {
    return this.repo.findById(input.id);
  }
}
```

Three things happen:

1. **Input validation.** `input` is parsed against
   `FindByIdContract.input`. Failures throw `ValidationError`.
2. **Output validation.** The return value is parsed against
   `FindByIdContract.output`. Failures throw `ContractError` (server
   bug — your method returned the wrong shape).
3. **Metadata exposure.** The contract is registered with the
   service descriptor so clients (and the Omnitron console) can
   introspect it.

## Why contracts, not just schemas

A bare `@Validate(Schema)` validates input. A `@Contract` adds:

- **Output validation in development.** Catches "I returned
  `undefined` when I promised a `User`" bugs at the boundary.
- **Wire-format introspection.** The Omnitron console can render
  the contract for any registered service.
- **Versioning.** A contract carries its own version; you can ship
  v1 and v2 side by side and route to either.
- **Examples for documentation.** Contracts can carry sample
  inputs/outputs that surface in DevTools and generated API docs.

## Versioning

A contract version is independent of the service version. You can
bump a single method's contract without bumping the whole service:

```typescript
const FindByIdV2 = contract({
  name:    'users.findById',
  version: '2.0.0',                  // method bumped, service still 1.0.0
  input:   z.object({ id: z.string().uuid(), include: z.array(z.string()).optional() }),
  output:  UserSchemaV2,
});
```

The Netron client requests a specific version; mismatches surface as
typed errors.

## Examples in contracts

```typescript
const FindByIdContract = contract({
  name:    'users.findById',
  version: '1.0.0',
  input:   z.object({ id: z.string().uuid() }),
  output:  UserSchema,
  examples: [
    {
      description: 'happy path',
      input:       { id: '550e8400-e29b-41d4-a716-446655440000' },
      output:      { id: '550e8400-…', email: 'ada@example.com', name: 'Ada' },
    },
    {
      description: 'not found',
      input:       { id: '00000000-0000-0000-0000-000000000000' },
      output:      null,
    },
  ],
});
```

Examples surface in:

- The Omnitron console's method invoker (pre-fills the form).
- Generated API docs.
- The DevTools service descriptor inspector.

They are also useful as readable test fixtures.

## When to use `@Validate` vs `@Contract`

| Use `@Validate(Schema)` when …                   | Use `@Contract(c)` when …                     |
| ------------------------------------------------- | --------------------------------------------- |
| The method is internal (no `@Public`)             | The method is public                          |
| You only need to validate one parameter           | You want input + output + metadata in one place |
| The output is implicit from the TypeScript type   | You want runtime output validation in dev     |
| The contract surface is small and unstable        | The contract is stable and may be versioned   |

For a stable public API, prefer contracts. For internal helpers,
`@Validate` is enough.

## Output validation in production

Output validation is on by default. In high-throughput production
services, the cost is small but non-zero (~1µs per object). To
disable in production while keeping it on in dev:

```typescript
const FindByIdContract = contract({
  // …
  output:           UserSchema,
  validateOutputIn: ['development', 'test'],     // skip in production
});
```

Use sparingly. Output validation catches bugs that would otherwise
ship as wire-format-incompatible responses.

## Anti-patterns

- **Schema inline at every method.** Define schemas once (in a
  `schemas.ts` file) and import. Inline schemas lead to drift
  between server and client.
- **Validating outputs of every method.** Use contracts for
  `@Public` methods. Internal methods are typed by TypeScript;
  runtime validation there is overhead with no benefit.
- **Forgetting `version`.** A contract without a version is the
  default `1.0.0` — fine for v1, painful when you need to ship v2
  and discover everything has been at v1 forever.

→ Next: [Error Handling](./error-handling.md).
