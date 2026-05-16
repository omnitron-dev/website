---
sidebar_position: 4
title: Performance
description: Where Titan apps win or lose latency and throughput.
---

# Performance

Titan's framework cost is small. Most performance problems live in
your code or your dependencies. This page covers what the framework
contributes — and what's on you.

## Where the framework spends time

Per Netron call, the framework adds:

| Step                          | Typical cost      |
| ----------------------------- | ----------------- |
| Transport receive + decode    | 5–15 µs           |
| Service descriptor lookup     | <1 µs             |
| Validation (typical schema)   | 1–5 µs            |
| Method dispatch               | <1 µs             |
| Result encode + transport send | 5–15 µs          |

Total framework overhead per call: roughly 15–40 µs.

For a method that does a single database query, the database is the
bottleneck — framework overhead is invisible. For a method that does
nothing (a health check), framework overhead dominates. Don't
optimise the wrong layer.

## What's on you

### Database queries

The single most common performance issue. Patterns:

- **N+1.** Loading a list and then one query per item. Use joins or
  batch loads.
- **Missing indexes.** Slow queries on large tables. Profile and
  add indexes for hot paths.
- **Over-fetching.** SELECT * on a wide table when you need three
  columns. Project explicitly.

The framework doesn't help here. `titan-database` exposes Kysely;
write efficient queries.

### Validation overhead

Pre-compiled validators are fast (1–5 µs) but not free. For very
hot paths:

- Keep schemas small.
- Avoid expensive refinements (`z.string().refine(asyncCheck)`).
- For trusted internal calls, skip `@Validate` (TypeScript already
  enforces the type).

### Logging

Every log line costs:

- ~1 µs to format (with pino).
- ~5–10 µs to write to a transport.
- More if a processor runs.

In a tight loop, 1000 log lines / second is fine; 1 million is not.
Promote loop logging to `trace` (off in production) or sample.

### Cache

The single best win for read-heavy services. `titan-cache` with the
LRU tier:

```typescript
@Public()
@Cache({ key: (id) => `user:${id}`, ttlMs: 30_000 })
async findById(id: string) { /* … */ }
```

A 95% cache hit rate cuts your database load by 20×. Worth the
ceremony.

## Measuring

You can't optimise what you don't measure.

### Per-method latency

`titan-metrics` emits `rpc.duration_ms` per method by default. Look
at p99 / p99.9 — averages hide tail behaviour.

### Per-call profiling

For a specific slow method, use the trace:

```typescript
@Public()
async findById(id: string) {
  const dbSpan = startSpan('db.query');
  const user = await this.repo.findById(id);
  dbSpan.end();

  const cacheSpan = startSpan('cache.set');
  await this.cache.set(id, user);
  cacheSpan.end();

  return user;
}
```

The trace shows where time goes. Find the longest span; investigate.

### Process-level profiling

Node.js has built-in CPU profiling:

```bash
node --prof src/main.js
```

Use for finding hot functions across the whole app. Combine with
`--prof-process` for human-readable output.

For production-safe profiling, use `clinic.js` or `0x`.

## Scaling vertically vs horizontally

A single Titan app can comfortably handle several thousand
calls/second on a modest box. When you need more:

- **Vertically.** Bigger machine, more workers via `titan-pm`.
- **Horizontally.** More instances behind a load balancer.

Both are fine. The framework is stateless by default
(singletons hold infrastructure, not request state); horizontal
scaling is the easy path.

## Anti-patterns

- **Premature optimisation.** Don't tune what you haven't measured.
- **Caching everything.** Adds complexity and cache-invalidation
  bugs. Cache hot paths only.
- **Threading inside Node.** Use worker threads via `titan-pm` for
  true CPU-bound work. Don't use raw `Worker` in service code.
- **One giant Singleton state.** A 1 GB cache in a singleton is
  a 1 GB heap. Use external cache (Redis tier) or bounded LRU.

## Read also

- [titan-cache](../modules/cache) — caching strategies.
- [titan-pm](../modules/pm) — worker pools for CPU work.
- [Resilience / Timeout](../resilience/timeout.md) — bounded
  external calls.

→ Back to [Best Practices Overview](../best-practices/structuring-services.md).
