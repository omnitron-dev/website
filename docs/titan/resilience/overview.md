---
sidebar_position: 1
title: Resilience
description: Defending against partial failure — retry, circuit breaker, timeout, backoff.
---

# Resilience

Titan ships a small set of resilience primitives in
`@omnitron-dev/titan/utils`. They are **functions and classes**, not
decorators — designed to be composed inside your service methods at
the call boundary.

| Primitive       | What it does                                          | Page                              |
| --------------- | ----------------------------------------------------- | --------------------------------- |
| `computeBackoff` | Compute delay between attempts                       | shared in [Retry](./retry.md)     |
| `retry()`       | Re-attempt a failed operation                         | [Retry](./retry.md)               |
| `CircuitBreaker` class | Stop calling a backend after failures          | [Circuit Breaker](./circuit-breaker.md) |
| `withTimeout()` | Abandon a call that takes too long                    | [Timeout](./timeout.md)           |
| `FailureTracker` | Sliding-window error counting                        | source: `utils/failure-tracker.ts` |
| `ResilientHandle` | Bundled retry + breaker + timeout for one dep       | source: `utils/resilience.ts`     |

There is also a `@Retry` decorator in
`@omnitron-dev/titan/decorators` for simple fixed-delay retry on a
method — but it is intentionally minimal (no exponential backoff, no
classifier). For sophisticated resilience, use the primitives from
`utils/`.

## When you need each

- **Retry** — for transient failures: network errors, 503s,
  timeouts. Use `isOperationalError(e)` to classify.
- **Circuit breaker** — when retrying a failing dependency makes
  the problem worse. Open the circuit; let it cool down.
- **Timeout** — for any external call. A call without a timeout can
  hang forever, taking a request slot with it.
- **FailureTracker** — when you need a sliding-window error count
  for custom logic (e.g. dynamic throttling based on recent error
  rate).

These compose. A typical "outbound call" pattern:

```
withTimeout → CircuitBreaker.execute → retry → the actual call
```

- Timeout outermost — even retries shouldn't extend the deadline.
- Circuit breaker next — if open, fail fast (no retries).
- Retry — re-attempt on transient failures.

For this exact composition, use `ResilientHandle` from
`utils/resilience.ts` — see the source for the current API surface.

## The minimal example

```typescript
import { retry, withTimeout, CircuitBreaker } from '@omnitron-dev/titan/utils';

@Service({ name: 'Payments' })
class PaymentsService {
  private readonly stripeBreaker = new CircuitBreaker({
    failureThreshold: 5,
    timeout:          60_000,
  });

  @Public()
  async charge(req: ChargeRequest) {
    return withTimeout(
      () => this.stripeBreaker.execute(() =>
        retry(() => this.stripe.charge(req), { maxAttempts: 3 })
      ),
      { timeoutMs: 5_000 },
    );
  }
}
```

## Read on

- [Retry](./retry.md) — backoff strategies, the `retry()` function,
  the `@Retry` decorator.
- [Circuit Breaker](./circuit-breaker.md) — `CircuitBreaker` class
  semantics.
- [Timeout](./timeout.md) — `withTimeout()`, abort signals.

→ Next: [Retry](./retry.md).
