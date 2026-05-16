---
sidebar_position: 4
title: Timeout
description: Bounded calls — every external dependency needs a deadline.
---

# Timeout

Every call to an external dependency should have a timeout. A call
without one can hang forever, holding a request slot, a connection,
a worker thread.

## `withTimeout()` — the function

```typescript
import { withTimeout } from '@omnitron-dev/titan/utils';

const result = await withTimeout(
  () => fetch(url),
  { timeoutMs: 5_000 },
);
```

The exact shape of `TimeoutOptions` lives in
`utils/resilience.ts`. After the timeout, the framework rejects with
a typed error (use `isTimeoutError(e)` to check).

The underlying operation is **not** automatically cancelled — see
"Cancellation" below.

## `@Timeout` — the decorator

`@omnitron-dev/titan/decorators` exports a `Timeout` method
interceptor:

```typescript
import { Timeout } from '@omnitron-dev/titan/decorators';

@Timeout({ ms: 5_000 })
async fetchUpstream() {
  return await fetch(this.url);
}
```

Wraps the method body in a timeout. Like `withTimeout`, does not
cancel the underlying operation.

## Cancellation

A timeout that doesn't cancel the underlying operation merely
*ignores* the result — the operation keeps running, holding
resources. For cooperative cancellation, pass an `AbortSignal`:

```typescript
async function fetchWithDeadline(url: string, signal: AbortSignal) {
  return fetch(url, { signal });
}

const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

try {
  await fetchWithDeadline(url, controller.signal);
} catch (e) {
  if (e.name === 'AbortError') {
    // cleanly aborted
  }
}
```

For libraries without abort support, the operation runs to
completion in the background. Your method returns the timeout error
anyway.

## Choosing a timeout

A timeout should be longer than the worst legitimate latency you
expect, plus margin:

| Operation                                  | Reasonable range  |
| ------------------------------------------ | ----------------- |
| Cache lookup                               | 100 ms            |
| In-cluster RPC                             | 1–5 s             |
| External HTTP API                          | 5–30 s            |
| Long-running upstream                      | 60 s+             |

Too short → spurious timeouts on legitimate slow paths.
Too long → resource exhaustion when the dependency hangs.

Measure first; pick a timeout at p99.9 × 2.

## Cascading timeouts

A timeout on a chain (your service → A → B → C) is the *minimum*
along the chain. If the inner C has a 30 s timeout and your service
has a 10 s timeout, the user sees 10 s and you see C still running
in the background.

Pattern: pass deadlines down. Make the inner timeouts shorter than
the outer, by some margin.

## Detecting timeouts

```typescript
import { isTimeoutError } from '@omnitron-dev/titan/utils';

catch (e) {
  if (isTimeoutError(e)) {
    // handle timeout specifically
  }
}
```

## Anti-patterns

- **No timeout on outbound calls.** The most common production bug
  in distributed systems.
- **Same timeout everywhere.** A 30 s timeout on a cache lookup is
  pointless; a 5 s timeout on a long upload is broken. Match to
  the operation.
- **Timeout but no cancellation.** The framework returns; the
  operation keeps running. Resources accumulate. Use abort
  signals.
- **Catching `TimeoutError` and continuing.** A timed-out operation
  may still complete in the background. Catching can produce
  duplicate side effects when both paths run.

→ Back to [Resilience Overview](./overview.md).
