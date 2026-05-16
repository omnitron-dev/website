---
sidebar_position: 2
title: Retry
description: The retry() function, the @Retry decorator, and the backoff helpers.
---

# Retry

Three retry surfaces, from simplest to most flexible.

## The `@Retry` decorator (simplest)

Fixed-delay retry on a method. Three attempts by default, 1000 ms
between them.

```typescript
import { Retry } from '@omnitron-dev/titan/decorators';

@Retry({ attempts: 3, delay: 200 })
async fetchUpstream() {
  return await fetch(this.url);
}
```

| Option     | Default | Effect                                  |
| ---------- | ------- | --------------------------------------- |
| `attempts` | `3`     | Total attempts (including the first try) |
| `delay`    | `1000`  | ms between attempts                     |

`@Retry` retries on **any** thrown error — there is no classifier
in the decorator. If you need to retry only on specific errors
(transient), wrap the work yourself with the `retry()` function
described below.

## The `retry()` function (flexible)

From `@omnitron-dev/titan/utils`:

```typescript
import { retry, BackoffStrategy } from '@omnitron-dev/titan/utils';
import { isOperationalError } from '@omnitron-dev/titan/utils';

await retry(
  () => fetch(url),
  {
    maxAttempts:  3,
    initialDelay: 100,
    maxDelay:     5_000,
    multiplier:   2,
    jitter:       true,
    backoff:      BackoffStrategy.Exponential,
    shouldRetry:  (error) => isOperationalError(error),
    onRetry:      (error, attempt) => log.warn('retry', { attempt }),
  },
);
```

Real shape of `RetryOptions` lives in `utils/resilience.ts`. Common
knobs:

- `maxAttempts` — total attempts.
- `initialDelay` / `maxDelay` — bounds.
- `multiplier` — for exponential backoff.
- `jitter` — `true` to randomise around the computed delay.
- `backoff` — `BackoffStrategy.Fixed | .Linear | .Exponential |
  .Fibonacci`.
- `shouldRetry` — classifier predicate; default retries everything.
- `onRetry` — callback per attempt.

## The `computeBackoff` helper

For custom retry loops where `retry()` doesn't fit:

```typescript
import { computeBackoff } from '@omnitron-dev/titan/utils';

let attempt = 0;
while (true) {
  try {
    return await fetch(url);
  } catch (e) {
    if (++attempt >= 3) throw e;
    const delayMs = computeBackoff({
      attempt,
      baseMs:     100,
      maxMs:      5_000,
      multiplier: 2,
      jitter:     0.25,
    });
    await sleep(delayMs);
  }
}
```

`IBackoffOptions` covers exponential backoff with jitter — the same
math `retry()` uses internally.

## Retry strategies registry

`utils/retry.ts` exposes a richer family of named strategies:

```typescript
import {
  RetryStrategies,
  calculateStrategyDelay,
  createRetryDelayFn,
  addJitter,
  getFibonacciDelay,
} from '@omnitron-dev/titan/utils';
```

`RetryStrategies` is a registry of named delay functions
(exponential, linear, fixed, fibonacci, custom). Use when you want to
plug a strategy by name from configuration.

## When NOT to retry

- **Validation failures.** They will fail again on retry.
- **Auth failures (401, 403).** They won't change with retry.
- **Idempotency-unsafe operations.** A POST that creates a resource
  should not be retried unless you have an idempotency key.

The default `shouldRetry: (e) => isOperationalError(e)` handles the
first two. The third is your responsibility — wrap idempotency-
sensitive calls with an idempotency key your backend honours.

## Compose with a circuit breaker

A retry without a circuit breaker can hammer a failing backend:

```typescript
import { CircuitBreaker, retry, isOperationalError } from '@omnitron-dev/titan/utils';

const breaker = new CircuitBreaker({ failureThreshold: 5, timeout: 60_000 });

await breaker.execute(() =>
  retry(() => callBackend(), { maxAttempts: 3, shouldRetry: isOperationalError }),
);
```

When the circuit is open, retries fail fast — they never call the
backend, so no exponential pile-up.

## Anti-patterns

- **Unlimited retries.** Always bound with `maxAttempts`.
- **Retry on every error.** Use a `shouldRetry` predicate
  (`isOperationalError` is the safe default).
- **No backoff.** Immediate retry is a thundering herd. Use one of
  the named strategies.
- **No jitter.** Synchronised retries from many clients create
  bursts. Enable `jitter: true`.

→ Next: [Circuit Breaker](./circuit-breaker.md).
