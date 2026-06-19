---
sidebar_position: 3
title: cuid
description: Collision-resistant URL-safe unique IDs for distributed systems.
---

# @omnitron-dev/cuid

```bash
pnpm add @omnitron-dev/cuid
```

Fast, collision-resistant unique identifier generator. URL-safe,
monotonically sortable, suitable for distributed systems where
coordination-free ID generation is required.

Verified against `packages/cuid/src/`.

## API

```typescript
import { cuid, isCuid, createOptimizedCuid } from '@omnitron-dev/cuid';

const id = cuid();             // e.g. 'k3j7v0a8z4m1qp9x'
isCuid(id);                    // true

// Custom-length / pre-seeded factory:
const makeId = createOptimizedCuid({ length: 24 });
const longId = makeId();
```

- `cuid()` — generate an ID (default 16 chars).
- `isCuid(id)` — cheap validity check (first char `a-z`, rest `[a-z0-9]`, length 2–32).
- `createOptimizedCuid({ length?, fingerprint?, initialCount? })` — returns a closure
  generating IDs of a custom length / fingerprint / counter seed.

## Properties

| Property | Value |
| -------- | ----- |
| Length | 16 characters (default; configurable via `createOptimizedCuid`) |
| Alphabet | `[a-z0-9]` (URL-safe, case-insensitive) |
| Time-seeded | Yes — `Date.now()` + a per-process counter feed the hash, but the output is a SHA3-512 digest, **not** a literal time prefix |
| Collision-resistant | Hash of time + per-call salt + monotonic counter + per-process fingerprint |
| Predictable | No — salted hash output |
| Speed | ~3M IDs/sec on modern CPUs |

## Format

```text
k    3j7v0a8z4m1qp9x
↑    ↑
↑    SHA3-512 digest of (time + salt + counter + fingerprint), base36, sliced
random first letter (a–z)
```

The first character is a random `a–z` letter; the remainder is a base36
SHA3-512 digest of the timestamp, a per-call salt, a monotonic counter, and a
per-process fingerprint. There is **no** literal time/counter substring you can
parse back out — sortability is approximate, not lexical.

## When to use cuid

- **Distributed primary keys** — generate on the client, ship to
  server, no coordination round-trip.
- **Public-facing IDs** — short enough for URLs, opaque enough
  not to leak ordering or scale info.
- **Opaque, coordination-free identifiers** — generate anywhere
  without a central allocator and without leaking row counts or
  insertion order.

## When NOT to use cuid

- **Cryptographic randomness** — cuid is collision-resistant but
  not cryptographically random. For session tokens / API keys
  use `crypto.randomBytes`.
- **Lexically time-sortable keys** — the output is a salted hash,
  not a sortable time prefix. Sorting by cuid does **not** give
  chronological order. Use a snowflake/ULID scheme if you need that.
- **Numeric IDs** — cuid is a string. If you need integer
  primary keys, use a snowflake-style scheme.

## Examples

### Generate IDs for entities

```typescript
import { cuid } from '@omnitron-dev/cuid';

interface User {
  id:    string;
  email: string;
  // ...
}

const user: User = {
  id:    cuid(),
  email: 'a@b.c',
};
```

### Request IDs

```typescript
const requestId = cuid();
logger.info({ requestId }, 'incoming request');
```

### Idempotency keys

```typescript
async function chargeOnce(amount: number) {
  const idempotencyKey = cuid();
  return paymentProvider.charge({ amount, idempotencyKey });
}
```

The client generates a key, retries on network error using the
same key — server deduplicates.

### Database default

```typescript
// titan-database / Kysera repository
class UsersTable {
  id:        Generated<string>;   // defaults via cuid()
  email:     string;
  createdAt: Generated<Date>;
}
```

Most repositories default ID columns to cuid; you almost never
generate them manually for inserts.

## Performance

| Scenario | Throughput |
| -------- | ---------- |
| Single-thread modern CPU | ~3M IDs/sec |
| Within hot loop (no I/O) | ~5M+ IDs/sec |
| Cross-process (per-process counter resets) | linear, no contention |

The generator is stateless from the caller's view — no
lock contention across calls.

## Where it's used in the stack

- **`titan-database`** — default for repository primary keys.
- **Omnitron** — internal request IDs, process IDs, run IDs.
- **`titan-pm`** — worker pool IDs.
- **`titan-events`** — message IDs.

## See also

- [common](./common.md) — sibling utility (predicates, promises, …)
- [titan-database](../titan/modules/database.mdx) — primary use case for cuid
- [`crypto.randomUUID`](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) —
  cryptographic alternative when collision-resistance isn't enough
