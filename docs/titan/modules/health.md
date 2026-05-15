---
title: titan-health
---

# titan-health

Health and readiness probes with extensible indicators. Used by load
balancers, orchestrators, and `titan-discovery`'s heartbeat.

## Install

```bash
pnpm add @omnitron-dev/titan-health
```

## Setup

```typescript
import { HealthModule } from '@omnitron-dev/titan-health';

@Module({
  imports: [
    HealthModule.forRoot({
      indicators: [
        DatabaseHealth,        // From titan-database
        RedisHealth,           // From titan-redis
        DiskSpaceHealth,
      ],
      route: '/healthz',       // HTTP probe path
    }),
  ],
})
export class AppModule {}
```

## Custom indicator

```typescript
@Injectable()
export class StripeHealth implements HealthIndicator {
  async check(): Promise<HealthResult> {
    try {
      await this.stripe.balance.retrieve();
      return { status: 'up' };
    } catch (e) {
      return { status: 'down', error: String(e) };
    }
  }
}
```

## Probes

| Endpoint        | Returns                                          |
| --------------- | ------------------------------------------------ |
| `/healthz`      | Liveness — is the process alive?                 |
| `/readyz`       | Readiness — is the app ready to serve?           |
| `/healthz/full` | Detailed indicator-by-indicator JSON             |

A failing indicator marks the app `not ready`; the orchestrator stops
sending new requests until it recovers.
