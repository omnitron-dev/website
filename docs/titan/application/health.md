---
id: "titan/application/health"
slug: "/docs/titan/application/health"
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

The kernel exposes an aggregate roll-up directly: `app.health()`
returns an `IHealthStatus` combining every registered module's health,
and `app.checkHealth(moduleName)` returns one module's status. Richer
indicator registration and HTTP probes come from the
[`titan-health`](../modules/health) ecosystem module.

## Reading health from inside the app {#reading-health-from-inside-the-app}

`titan-health` ships an `HealthService` and registers indicators with
the application. Inject it where you need to read aggregate health:

```typescript
import { Inject, Service } from '@omnitron-dev/titan';
import { Public } from '@omnitron-dev/titan/decorators';
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

## Indicators {#indicators}

An *indicator* answers "is this dependency healthy?". The aggregator
collects indicators from registered sources and combines them with a
worst-status-wins rule:

| Composition                    | Result        |
| ------------------------------ | ------------- |
| All `healthy`                  | `healthy`     |
| Any `degraded`, none `unhealthy` | `degraded`  |
| Any `unhealthy`                | `unhealthy`   |

`degraded` reports a warning; `unhealthy` reports a failed check. Readiness
decides whether the application can serve a particular workload. An operational
failure must not become a warning just because other checks pass, and a warning
must remain visible when readiness permits traffic.

## Adding an indicator {#adding-an-indicator}

The indicator interface and registration helper live in
`titan-health`. Typically:

```typescript
import { Injectable } from '@omnitron-dev/titan';
import type { IHealthIndicator } from '@omnitron-dev/titan-health';

@Injectable()
export class StripeHealth implements IHealthIndicator {
  // Required. `registerIndicator` throws BadRequest without it —
  // it is also the key the indicator is reported under.
  readonly name = 'stripe';

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

Then register it. There are two paths, and they are not equivalent:

```typescript
// 1. Module options — the module does `new IndicatorClass()` itself.
HealthModule.forRoot({ indicators: [ClockSkewHealth] });

// 2. Through DI, for an indicator that HAS dependencies.
@Inject(HEALTH_SERVICE_TOKEN) private readonly health: IHealthService;
// …then, once your own dependencies are resolved:
this.health.registerIndicator(this.stripeHealth);
```

The `indicators` array constructs with **no arguments**
(`new IndicatorClass()`), so `StripeHealth` registered that way would
get `stripe === undefined` and fail at its first check rather than at
registration. Use it for indicators that need nothing; resolve the
others from DI and hand over the instance.

## Liveness vs readiness {#liveness-vs-readiness}

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

## Data origin during development {#data-origin-during-development}

Working-tree execution and an installed immutable release provide different
origin evidence. A running process or a successful health probe does not establish
that data came from a verified artifact. Report origin separately from database,
transport and worker availability.

Make the application's readiness policy explicit. A workload that requires
verified producers should reject missing origin evidence by default. A local
development stack can explicitly allow operational readiness while retaining an
origin warning. That choice must not change persisted provenance, relabel old
records or admit unverified observations to consumers that require verified data.
Do not infer this exception merely from a project name or a missing environment
variable.

Preserve check severity through every adapter: a warning remains a warning in
process health, CLI and Console; any actual failed dependency remains a failure.
Document what an operator can use now, what evidence is missing, and what would
make the warning clear. Test both policies through the actual configuration loader
and the shared process-health adapter.

## Probe routes {#probe-routes}

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

## Programmatic shutdown on unhealthy {#programmatic-shutdown-on-unhealthy}

```typescript
const status = await app.health();   // aggregate IHealthStatus
if (status.status === 'unhealthy' && status.modules?.['database']?.status === 'unhealthy') {
  void app.stop();   // graceful stop; supervisor restarts the process
}
```

`app.health()` returns the aggregate `IHealthStatus`
(`{ status, message?, modules?, details? }`); `app.checkHealth(name)`
returns the status for a single module. Note `HealthCheck`
(`'health:check'`) is a reserved event the kernel does not emit on its
own — drive health checks by calling `app.health()` (e.g. from a
readiness probe or an interval), not by subscribing to it. This pattern
is rare — usually you want the readiness probe to handle this
transparently — but it is available when you need it.

## Anti-patterns {#anti-patterns}

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
