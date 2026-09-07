---
sidebar_position: 6
title: Identifiers
description: Which ID generator to reach for, and why the default is time-ordered.
---

# Identifiers

`@omnitron-dev/titan/utils` ships eight ID generators. They differ in what they
guarantee, and the differences matter most where the ID becomes a database key.

```typescript
import { generateUuidV7 } from '@omnitron-dev/titan/utils';
```

## `generateUuidV7()` — the default for stored rows

An RFC 9562 UUIDv7: a 48-bit millisecond timestamp, then a 12-bit counter, then
74 bits of randomness. Two properties follow, and both are worth having.

**It sorts by creation time as a string.** `01a07bd1-66a7-7c7a-…` — the leading
hex is the timestamp, so lexical order is chronological order. A B-tree keyed
on it appends to one side instead of writing into random pages, which is the
difference between a hot leaf page and a scattered index. A UUIDv4 primary key
gives up that locality for nothing.

**It is monotonic within a process.** Same millisecond, the counter increments
(4096 per ms). On counter overflow the timestamp advances by one instead of
repeating — so ordering holds even under a burst faster than the clock.

Measured, not inferred: 20 000 consecutive calls come out already sorted, with
no duplicates.

The randomness comes from `node:crypto`, drawn from a 640-byte pool refilled
every ~64 IDs, so a burst pays one syscall rather than sixty-four.

`generateUuid()` is an alias for this one. Prefer the explicit name — `Uuid`
alone reads as "v4" to most people, and the version is the whole point.

## The rest

| Function                    | Shape                          | For                                   |
| --------------------------- | ------------------------------ | ------------------------------------- |
| `generateResolutionId()`    | `res_` + 32 hex (from a v7)    | one DI resolution — time-ordered too   |
| `generateConnectionId()`    | `conn_` + 16 hex               | a transport connection                 |
| `generateTraceId()`         | 32 hex                         | W3C Trace Context trace-id             |
| `generateSpanId()`          | 16 hex                         | W3C Trace Context span-id              |
| `generateLockValue()`       | 32 hex                         | the fencing value of a distributed lock |
| `generatePrefixedId(prefix)`| `<prefix>_` + 16 hex           | anything else that wants a readable tag |

The trace and span widths are not a style choice: W3C Trace Context fixes them
at 16 and 8 bytes, so a value of any other length is rejected by every consumer
of the header.

`generateLockValue()` is random rather than time-ordered on purpose. A lock
value is compared for equality when releasing — the point is that nobody can
guess or reconstruct it, and ordering would be an invitation to try.

## Choosing

Use `generateUuidV7()` for anything that lands in a table. Use a prefixed hex ID
for things that live in memory or in a log line, where a human reading it
benefits from seeing what kind of thing it is. Use the trace and span helpers
only for their protocol.

For URL-safe IDs shorter than a UUID — a share link, a public handle — see
[`@omnitron-dev/cuid`](../utilities/cuid.md): 16 base36 characters against a
UUID's 36, with no dashes to escape or lose in a double-click.

What you give up is the ordering, and it is worth being exact about why. A cuid
DOES embed a base36 timestamp — but behind a random leading letter, so
consecutive IDs do not sort chronologically. Measured: 5 000 in a row come out
unsorted, while 20 000 UUIDv7s come out already sorted.

You also give up the *format*: a `uuid` column in Postgres, and every tool that
recognises the shape.

So: cuid where the ID is read or typed by a person, `generateUuidV7()` where it
is a key.
