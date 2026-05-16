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
import { cuid } from '@omnitron-dev/cuid';

const id = cuid();      // e.g. 'clh3k7v0a0000q9zoo3y3a8oz'
```

That's the whole surface. One function, one return type.

## Properties

| Property | Value |
| -------- | ----- |
| Length | 25 characters |
| Alphabet | `[a-z0-9]` (URL-safe, case-insensitive) |
| Time-prefixed | Yes — IDs sort approximately by creation time |
| Collision-resistant | 10^15+ per host per millisecond before practical collision |
| Predictable | No — middle bytes are random |
| Speed | ~3M IDs/sec on modern CPUs |

## Format

```text
c          lh3k7v0a    000a    q9zoo3y3a8oz
↑          ↑           ↑       ↑
prefix     timestamp   counter random
(version)  (base36)            (per-process entropy)
```

The leading `c` identifies the format (cuid v1); timestamp +
counter give monotonic sort within a host; the random tail
guarantees collision-resistance across hosts.

## When to use cuid

- **Distributed primary keys** — generate on the client, ship to
  server, no coordination round-trip.
- **Public-facing IDs** — short enough for URLs, opaque enough
  not to leak ordering or scale info.
- **Time-orderable lists** — sortable by ID gives
  approximately-chronological order without an extra timestamp
  column.

## When NOT to use cuid

- **Cryptographic randomness** — cuid is collision-resistant but
  not cryptographically random. For session tokens / API keys
  use `crypto.randomBytes`.
- **Sequential keys for analytics** — sort order is per-process
  + per-millisecond. Multi-host inserts can re-order.
- **Numeric IDs** — cuid is a string. If you need integer
  primary keys, use a snowflake-style scheme.
- **Sub-millisecond uniqueness** — within one process, one
  millisecond, you get the counter. Below ~10^7 IDs/sec/process,
  no collisions. Above — extremely unlikely but theoretically
  possible.

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
