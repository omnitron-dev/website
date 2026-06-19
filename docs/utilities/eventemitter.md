---
sidebar_position: 4
title: eventemitter
description: Async event emitter with parallel/serial/reduce patterns.
---

# @omnitron-dev/eventemitter

```bash
pnpm add @omnitron-dev/eventemitter
```

An async-first event emitter (custom implementation — no
`eventemitter3` dependency) that works in Node, Bun, and the
browser. Adds parallel/serial/reduce emission patterns on top of a
standard sync emitter, plus an `EnhancedEventEmitter` subclass with
wildcards, history, metrics, and scheduling.

Verified against `packages/eventemitter/src/`.

## Why not just a plain sync emitter?

The Node built-in `EventEmitter` calls handlers **synchronously** in
registration order. That's wrong for two common cases:

1. **Async handlers that need to run in parallel** — synchronous
   emit doesn't await; promises slip through `.emit()`.
2. **Async handlers that produce a derived result** — there's no
   built-in way to reduce.

This package solves both. The standard `on` / `once` / `emit` /
`off` surface is preserved; the async `emit*` methods are additive.

## Quick start

```typescript
import { EventEmitter } from '@omnitron-dev/eventemitter';

const bus = new EventEmitter();

bus.on('user.created', async (user) => {
  await sendWelcomeEmail(user);
});

await bus.emitParallel('user.created', newUser);
```

> The base `EventEmitter` is **not** generic over an event map and
> uses loose `(event, ...args)` typing. For type-safe mapped events
> (`emitTyped`), wildcards, history, and metrics, use
> `EnhancedEventEmitter<TEventMap>` (below).

## Four emission patterns

| Method | Behaviour | Use case |
| ------ | --------- | -------- |
| `emit(event, ...args)` | Synchronous, returns `boolean` | Fire-and-forget, sync handlers |
| `emitParallel(event, ...args)` | Awaits all handlers concurrently; resolves to an array of results | Independent side-effects (email + log + analytics) |
| `emitSerial(event, ...args)` | Awaits handlers one-by-one in registration order; resolves to an array of results | Order-sensitive pipelines |
| `emitReduce(event, ...args)` | Chains handlers; each receives the prior return | Building up a result through middleware |
| `emitReduceRight(event, ...args)` | Like `emitReduce` but reverse order | Right-associative pipelines |

### `emitParallel`

```typescript
bus.on('order.placed', async (order) => sendConfirmation(order));
bus.on('order.placed', async (order) => updateInventory(order));
bus.on('order.placed', async (order) => trackAnalytics(order));

await bus.emitParallel('order.placed', order);
// All three handlers run concurrently; resolves when all complete.
// If any throws, the others still run; the error propagates.
```

### `emitSerial`

```typescript
bus.on('migration.run', async () => createTables());
bus.on('migration.run', async () => seedDefaults());
bus.on('migration.run', async () => buildIndexes());

await bus.emitSerial('migration.run');
// Runs in order; awaits each before next.
// If one throws, subsequent handlers don't run.
```

### `emitReduce`

```typescript
bus.on('request.transform', async (req) => ({ ...req, signed: true }));
bus.on('request.transform', async (req) => ({ ...req, compressed: true }));
bus.on('request.transform', async (req) => ({ ...req, retries: 3 }));

const final = await bus.emitReduce('request.transform', initialReq);
// final = { ...initialReq, signed: true, compressed: true, retries: 3 }
```

The seed is the argument(s) you pass after the event name; each
handler receives the **return value** of the previous one as its
argument. Middleware-style.

## Concurrency control

```typescript
const bus = new EventEmitter(3);     // or: bus.setConcurrency(3)

bus.on('image.process', heavyTransform);

// Even if you emit 100 events in a tight loop, at most 3
// instances of heavyTransform run concurrently.
for (const img of images) {
  bus.emitParallel('image.process', img);
}
```

Useful to avoid stampeding handlers that hit limited resources
(database connections, third-party APIs, CPU-bound work).

## Subscription management

```typescript
const unsubscribe = bus.subscribe('user.created', handler);
// later:
unsubscribe();

// Or use once:
bus.once('user.created', handleFirstOnly);
```

`subscribe()` returns an `() => void` — cleaner than `.off()` in
React `useEffect` cleanup.

## Wildcard subscriptions

```typescript
import { EnhancedEventEmitter } from '@omnitron-dev/eventemitter';

const bus = new EnhancedEventEmitter();   // wildcards on by default; delimiter '.'

bus.on('user.*', (data, metadata) => {
  // wildcard handlers receive (data, metadata); the matched event
  // name is in metadata.event
  console.log(`user event: ${metadata.event}`, data);
});

bus.emit('user.created', user);    // matches
bus.emit('user.deleted', user);    // matches
bus.emit('order.placed', order);   // doesn't match
```

`EnhancedEventEmitter` (a subclass of `EventEmitter`) adds wildcard
+ namespace handling, plus history, metrics, and scheduling. Its
constructor takes `{ wildcard?, delimiter?, concurrency? }` —
wildcards are enabled unless `wildcard: false`. Use `**` to match
across delimiter levels.

## History

History is built into `EnhancedEventEmitter` — enable it, then
query or replay:

```typescript
import { EnhancedEventEmitter } from '@omnitron-dev/eventemitter';

const bus = new EnhancedEventEmitter();
bus.enableHistory({ maxSize: 1_000, ttl: 60_000 });   // options: { maxSize?, ttl?, filter?, storage? }

bus.emit('user.created', user);

await bus.getHistory({ event: 'user.*' });   // EventFilter: { event?, from?, to?, tags?, correlationId? }
await bus.replay({ event: 'user.created' });
// Re-fires matching events through the bus (useful for debugging / disaster recovery)
```

Backed by `MemoryEventStorage` (a bounded buffer) by default; pass
a custom `storage` implementing the `EventStorage` interface. The
`EventHistory` / `MemoryEventStorage` classes are also exported if
you want to wire history up by hand.

## Metrics

Metrics are likewise built into `EnhancedEventEmitter`:

```typescript
const bus = new EnhancedEventEmitter();
bus.enableMetrics({ slowThreshold: 100, sampleRate: 1 });

// Some time later:
const m = bus.getMetrics();
// {
//   eventsEmitted, eventsFailed,
//   eventCounts:       Map<event, count>,
//   errorCounts:       Map<event, count>,
//   avgProcessingTime: Map<event, ms>,
//   slowestEvents:     Array<{ event, duration }>,
//   listenerCount:     Map<event, count>,
//   memoryUsage,
// }

bus.getMetricsSummary();   // human-readable string
```

Per-event counts, error counts, latency. The underlying collector
class is exported as `MetricsCollector`.

## Scheduled emissions

Scheduling is built into `EnhancedEventEmitter` via `schedule()`:

```typescript
const bus = new EnhancedEventEmitter();

// Fire once in 5 seconds:
bus.schedule('reminder.fire', { userId }, { delay: 5_000 });

// Fire at a specific time:
const id = bus.schedule('report.run', {}, { at: new Date('2026-01-01T00:00:00Z') });

// Cancel:
bus.cancelSchedule(id);
```

`ScheduleOptions` is `{ delay?, at?, cron?, retry?, persistent? }`.
The standalone `EventScheduler` class — `schedule(event, data,
options, emitFn)`, `cancel(id)`, `cancelAll()` — is also exported.

## Where it's used in the stack

| Module | What for |
| ------ | -------- |
| `titan-events` | Foundation of `EventsService` / `EventBusService` |
| `titan-telemetry-relay` | Internal bus for telemetry entries (subclass of EventEmitter) |
| Omnitron daemon | Inter-subsystem signalling |
| `titan-pm` | Process lifecycle events (`process:crash`, `pool:scaled`, …) |
| `titan-discovery` | Node-registry events |

## When to use this vs `titan-events`

| If you… | Use |
| ------- | --- |
| Need an in-process emitter in a single class / module | This package directly |
| Need a Titan-integrated module with DI, schema validation, persistence | [`titan-events`](../titan/modules/events.mdx) |
| Need cross-process events with at-least-once delivery | [`titan-notifications`](../titan/modules/notifications.mdx) |

This package is the **primitive**; `titan-events` is the
framework integration around it.

## Performance

| Op | Time |
| -- | ---- |
| Single sync `emit()` | < 1 μs (Map-backed listener lookup) |
| `emitParallel` with N async handlers | dominated by the slowest handler |
| `emitSerial` with N async handlers | sum of all handlers + Promise overhead |
| Wildcard match | O(handlers) per emission (linear scan) |
| Subscribe / unsubscribe | O(1) |

## See also

- [titan-events](../titan/modules/events.mdx) — Titan module built on this
- [common](./common.md) — sibling utility (`pLimit` powers the concurrency limiter)
