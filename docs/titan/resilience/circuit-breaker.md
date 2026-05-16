---
sidebar_position: 3
title: Circuit Breaker
description: Stop calling a failing dependency. Let it cool down. Resume gradually.
---

# Circuit Breaker

`CircuitBreaker` is a class from `@omnitron-dev/titan/utils`. There is
no `@CircuitBreaker` decorator — instantiate the class and use
`.execute()` around the work you want to protect.

## States

```typescript
enum CircuitState {
  Closed   = 'closed',
  Open     = 'open',
  HalfOpen = 'half-open',
}
```

| State        | Behaviour                                                       |
| ------------ | --------------------------------------------------------------- |
| **Closed**   | Calls pass through. Failures count toward the threshold.        |
| **Open**     | Calls fail immediately. No backend hit.                         |
| **HalfOpen** | One probe call goes through. Success → Closed. Failure → Open.  |

Transitions:

```
Closed   ──[N failures]──→ Open
Open     ──[timeout elapsed]──→ HalfOpen
HalfOpen ──[probe success]──→ Closed
HalfOpen ──[probe failure]──→ Open
```

## Basic usage

```typescript
import { CircuitBreaker, CircuitState } from '@omnitron-dev/titan/utils';

const breaker = new CircuitBreaker({
  failureThreshold: 5,             // 5 failures opens the circuit
  timeout:          60_000,        // ms before allowing a probe
  // …additional knobs in CircuitBreakerConfig
});

// Use it to wrap calls.
try {
  const result = await breaker.execute(() => callStripe(req));
} catch (e) {
  // If the circuit is open, .execute throws immediately.
}
```

The full `CircuitBreakerConfig` shape lives in
`utils/resilience.ts`. Common knobs (consult the source for the
canonical list):

- `failureThreshold` — failures before opening.
- `timeout` — ms in `Open` before transitioning to `HalfOpen`.
- `successThreshold` — successful probes in `HalfOpen` before
  returning to `Closed`.
- `volumeThreshold` — minimum number of calls before the failure
  threshold takes effect (avoids tripping on a single bad sample).

## Per-instance state

Each `CircuitBreaker` instance has its own state. Use one instance
per dependency you want to protect:

```typescript
@Service({ name: 'Payments' })
class PaymentsService {
  private readonly stripeBreaker  = new CircuitBreaker({ failureThreshold: 5, timeout: 60_000 });
  private readonly paypalBreaker  = new CircuitBreaker({ failureThreshold: 3, timeout: 30_000 });

  @Public()
  async chargeStripe(req: ChargeRequest) {
    return this.stripeBreaker.execute(() => this.stripe.charge(req));
  }

  @Public()
  async chargePaypal(req: ChargeRequest) {
    return this.paypalBreaker.execute(() => this.paypal.charge(req));
  }
}
```

A failure in `chargeStripe` opens *only* the Stripe circuit;
PayPal stays available.

## Observability

`CircuitBreaker` extends `EventEmitter`. Subscribe to state changes
and probe outcomes:

```typescript
breaker.on('open',  () => metrics.counter('breaker.open').inc());
breaker.on('close', () => metrics.counter('breaker.close').inc());
breaker.on('halfOpen', () => log.info('probing recovery'));
```

The exact event names live in `utils/resilience.ts`; check the
source for the current set.

## Reading state

```typescript
breaker.state                  // CircuitState
breaker.getMetrics()           // CircuitBreakerMetrics — total calls, failures, etc.
```

## Composing with retry

```typescript
import { CircuitBreaker, retry, isOperationalError } from '@omnitron-dev/titan/utils';

const breaker = new CircuitBreaker({ failureThreshold: 5, timeout: 60_000 });

await breaker.execute(() =>
  retry(() => callBackend(), { maxAttempts: 3, shouldRetry: isOperationalError }),
);
```

Breaker outside, retry inside. When the circuit is open, retries
don't run — the breaker rejects before `retry()` is called.

## Anti-patterns

- **Threshold too low.** A breaker that opens on the first failure
  flaps constantly. Pair `failureThreshold` with `volumeThreshold`
  (or per-window counts).
- **`timeout` too short.** The dependency hasn't recovered; the
  probe fails; the circuit re-opens. Real recovery takes seconds
  to minutes.
- **Same breaker for unrelated dependencies.** A failure in one
  service opens the circuit for another. Use one breaker per
  dependency.
- **No fallback.** Every breaker should have a "what do we do when
  the circuit is open" plan. Cached value? Default? Error to the
  user? Decide explicitly.

→ Next: [Timeout](./timeout.md).
