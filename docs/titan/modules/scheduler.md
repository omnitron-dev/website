---
title: titan-scheduler
---

# titan-scheduler

Cron, intervals, and timeouts with optional persistence and per-job
metrics.

## Install

```bash
pnpm add @omnitron-dev/titan-scheduler
```

## Setup

```typescript
import { SchedulerModule } from '@omnitron-dev/titan-scheduler';

@Module({
  imports: [
    SchedulerModule.forRoot({
      persistence: 'redis',     // 'memory' | 'redis'
      redis:       { url: env.REDIS_URL },
    }),
  ],
})
export class AppModule {}
```

## Decorators

```typescript
@Injectable()
export class CleanupJobs {
  @Cron('0 3 * * *', { timezone: 'UTC' })
  async nightlyCleanup() { /* … */ }

  @Interval(60_000)
  async refreshTokenCache() { /* … */ }

  @Timeout(5_000, { runOnStart: true })
  async warmCachesAfterBoot() { /* … */ }
}
```

## Programmatic

```typescript
@Service('jobs@1.0.0')
export class JobsService {
  constructor(private readonly scheduler: SchedulerService) {}

  @Public()
  async scheduleOnce(at: Date, payload: unknown) {
    return this.scheduler.schedule({
      runAt: at,
      handler: 'process-event',
      payload,
    });
  }
}

@Injectable()
export class EventProcessor {
  @ScheduledJob('process-event')
  async run(payload: unknown) { /* … */ }
}
```

## Persistence and metrics

With `persistence: 'redis'`, scheduled jobs survive process restarts.
The module records execution counts, durations, and failures via
`titan-metrics` if it's available.

## Coordination

For cluster deployments, combine with [titan-lock](./lock.md) to ensure
each scheduled job runs once per fleet, not once per pod.
