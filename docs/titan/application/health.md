---
sidebar_position: 4
title: Health
description: Liveness, readiness, indicator-based aggregation.
---

# Health

A Titan application reports three independent signals:

| Signal       | Question it answers                                         | Failure means                              |
| ------------ | ----------------------------------------------------------- | ------------------------------------------ |
| **Liveness** | Is the process alive and responsive?                        | Restart me                                 |
| **Readiness**| Should the load balancer send me traffic right now?         | Take me out of rotation, leave me running  |
| **Healthy**  | Is every dependency I rely on currently working?            | Investigate; possibly degraded service     |

The kernel exposes the aggregate via the application's
`HealthCheck` event and through specific helpers exposed by the
[`titan-health`](../modules/health.md) ecosystem module.

## Reading health from inside the app

`titan-health` ships an `HealthService` and registers indicators with
the application. Inject it where you need to read aggregate health:

```typescript
import { Inject, Service, Public } from '@omnitron-dev/titan';
import { HEALTH_SERVICE_TOKEN, type HealthService }
  from '@omnitron-dev/titan-health';

@Service({ name: 'Admin' })
class AdminService {
  constructor(@Inject(HEALTH_SERVICE_TOKEN) private readonly health: HealthService) {}

  @Public()
  async status() {
    return this.health.check();
  }
}
```

The exact shape of the return value and token names lives in the
`titan-health` package — consult its source for the canonical API.

## Indicators

An *indicator* answers "is this dependency healthy?". The aggregator
collects indicators from registered sources and combines them with a
worst-status-wins rule:

| Composition                    | Result        |
| ------------------------------ | ------------- |
| All `healthy`                  | `healthy`     |
| Any `degraded`, none `unhealthy` | `degraded`  |
| Any `unhealthy`                | `unhealthy`   |

`degraded` means "I am still serving, but a dependency is flaky and
you should know". `unhealthy` means "do not send me traffic".

## Adding an indicator

The indicator interface and registration helper live in
`titan-health`. Typically:

```typescript
import { Injectable } from '@omnitron-dev/titan';
import type { IHealthIndicator } from '@omnitron-dev/titan-health';

@Injectable()
export class StripeHealth implements IHealthIndicator {
  constructor(private readonly stripe: Stripe) {}

  async check() {
    try {
      await this.stripe.balance.retrieve();
      return { status: 'healthy' as const };
    } catch (e) {
      return {
        status:  'degraded' as const,
        details: { error: String(e) },
      };
    }
  }
}
```

Then register through the module configuration that `titan-health`
exposes.

## Liveness vs readiness

The kernel separates these intentionally. Two scenarios make the
distinction important:

- **Slow startup** — your app is alive (liveness ✓) but still warming
  caches and connecting to dependencies (readiness ✗). The
  orchestrator should keep the process running but not send traffic
  yet.
- **Transient dependency failure** — your app is alive (liveness ✓)
  and could serve cached responses (readiness ✓), but Stripe is down
  (healthy ✗). The orchestrator should keep traffic flowing; the
  monitoring system should fire an alert.

If you collapse these into a single signal, the orchestrator will
restart your app (good thing → bad thing) when a dependency hiccups.

## Probe routes

When `titan-health` is loaded with its HTTP probe support, it
exposes routes that map to the three signals (typically `/healthz`,
`/readyz`, plus a detailed JSON variant). The exact path names and
status codes are configured per project — consult `titan-health`.

For Kubernetes (example):

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  initialDelaySeconds: 0
  periodSeconds: 3
```

## Programmatic shutdown on unhealthy

```typescript
import { ApplicationEvent, ShutdownReason } from '@omnitron-dev/titan';

app.on(ApplicationEvent.HealthCheck, (status) => {
  if (status.status === 'unhealthy' && status.modules?.database === 'unhealthy') {
    void app.stop({ reason: ShutdownReason.Error });
  }
});
```

This pattern is rare — usually you want the readiness probe to handle
this transparently — but it is available when you need it.

## Anti-patterns

- **Heavy work in indicators.** Indicators are called frequently
  (every few seconds for readiness probes). They should be cheap
  pings, not full integration tests.
- **Treating every dependency as critical.** Most dependencies
  should degrade, not fail. A cache being down does not mean you
  cannot serve requests; it means you serve them slower.
- **Ignoring liveness.** A process that has deadlocked but kept
  responding to liveness will not be restarted. Liveness should
  exercise enough of the request path to detect a stuck event
  loop.

→ Next: [Events](./events.md).
