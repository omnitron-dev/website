---
sidebar_position: 4
title: eventemitter
description: Async event emitter with parallel/serial/reduce patterns.
---

# @omnitron-dev/eventemitter

```bash
pnpm add @omnitron-dev/eventemitter
```

An async-first event emitter built on top of `eventemitter3`,
adding parallel/serial/reduce emission patterns, wildcard
subscriptions, history, and metrics.

Verified against `packages/eventemitter/src/`.

## Why not just use `eventemitter3`?

`eventemitter3` (and the Node built-in `EventEmitter`) call
handlers **synchronously** in registration order. That's wrong
for two common cases:

1. **Async handlers that need to run in parallel** — synchronous
   emit doesn't await; promises slip through `.emit()`.
2. **Async handlers that produce a derived result** — there's no
   built-in way to reduce.

This package solves both. Drop-in API-compatible with the
`eventemitter3` surface; adds new methods.

## Quick start

```typescript
import { EventEmitter } from '@omnitron-dev/eventemitter';

const bus = new EventEmitter<{
  'user.created':  [user: User];
  'order.placed':  [order: Order, source: string];
}>();

bus.on('user.created', async (user) => {
  await sendWelcomeEmail(user);
});

await bus.emitParallel('user.created', newUser);
```

## Four emission patterns

| Method | Behaviour | Use case |
| ------ | --------- | -------- |
| `emit(event, ...args)` | Synchronous (inherited from eventemitter3) | Fire-and-forget, sync handlers |
| `emitParallel(event, ...args)` | Awaits all handlers concurrently | Independent side-effects (email + log + analytics) |
| `emitSerial(event, ...args)` | Awaits handlers one-by-one in registration order | Order-sensitive pipelines |
| `emitReduce(event, init, ...args)` | Chains handlers; each receives the prior return | Building up a result through middleware |
| `emitReduceRight(event, init, ...args)` | Like `emitReduce` but reverse order | Right-associative pipelines |

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

Each handler receives the **return value** of the previous one
as its first argument. Middleware-style.

## Concurrency control

```typescript
const bus = new EventEmitter({ concurrency: 3 });

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

const bus = new EnhancedEventEmitter();

bus.on('user.*', (event, ...args) => {
  console.log(`user event: ${event}`, args);
});

bus.emit('user.created', user);    // matches
bus.emit('user.deleted', user);    // matches
bus.emit('order.placed', order);   // doesn't match
```

`EnhancedEventEmitter` adds wildcard + namespace handling on top
of the standard `EventEmitter` interface.

## History

```typescript
import { EventHistory } from '@omnitron-dev/eventemitter';

const history = new EventHistory({ maxSize: 1_000, ttlMs: 60_000 });
bus.use(history);

bus.emit('user.created', user);

history.query({ event: 'user.*' });
history.replay({ event: 'user.created' });
// Re-fires the events through the bus (useful for debugging / disaster recovery)
```

Bounded ring buffer with TTL eviction. Used by `titan-events`'s
`EventHistoryService`.

## Metrics

```typescript
import { EventMetrics } from '@omnitron-dev/eventemitter';

const metrics = new EventMetrics();
bus.use(metrics);

// Some time later:
metrics.snapshot();
// {
//   'user.created': { emissions: 1234, errors: 2, avgDurationMs: 12.3 },
//   'order.placed': { emissions: 567,  errors: 0, avgDurationMs: 45.1 },
// }
```

Per-event counts, error counts, latency. Used by
`titan-telemetry-relay` for internal observability.

## Scheduled emissions

```typescript
import { EventScheduler } from '@omnitron-dev/eventemitter';

const scheduler = new EventScheduler(bus);

// Fire once in 5 seconds:
scheduler.scheduleAt(Date.now() + 5_000, 'reminder.fire', { userId });

// Every 10 minutes:
scheduler.scheduleInterval(10 * 60_000, 'cache.refresh');

// Cancel:
const id = scheduler.scheduleAt(...);
scheduler.cancel(id);
```

Used internally by `titan-events`'s `EventSchedulerService`.

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
| Single sync `emit()` | < 1 μs (eventemitter3 baseline) |
| `emitParallel` with N async handlers | dominated by the slowest handler |
| `emitSerial` with N async handlers | sum of all handlers + Promise overhead |
| Wildcard match | O(handlers) per emission (linear scan) |
| Subscribe / unsubscribe | O(1) |

## See also

- [titan-events](../titan/modules/events.mdx) — Titan module built on this
- [common](./common.md) — sibling utility
- [eventemitter3](https://github.com/primus/eventemitter3) — underlying base
