---
title: titan-scheduler
---

# titan-scheduler

Cron, interval, and timeout scheduling with optional persistence
(memory / Redis / database), metrics integration, and automatic
resume after restarts.

```bash
pnpm add @omnitron-dev/titan-scheduler
```

## Setup

```typescript
import { SchedulerModule } from '@omnitron-dev/titan-scheduler';

@Module({
  imports: [
    SchedulerModule.forRoot({
      persistence:    { provider: 'redis' },
      enableMetrics:  true,
      concurrency:    10,
      timezone:       'UTC',
      autoStart:      true,
    }),
  ],
})
class AppModule {}
```

Also exported: `forRootAsync(options: ISchedulerModuleAsyncOptions)`.

### `ISchedulerModuleOptions`

| Option           | Type                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `persistence`    | `{ provider: 'memory' \| 'redis' \| 'database' }`                 |
| `enableMetrics`  | `boolean`                                                         |
| `listeners`      | `IJobListener[]`                                                  |
| `concurrency`    | `number` — max concurrent jobs                                    |
| `timezone`       | `string`                                                          |
| `autoStart`      | `boolean`                                                         |

## Decorators

| Decorator                  | Effect                                              |
| -------------------------- | --------------------------------------------------- |
| `@Cron(expression)`        | Cron-scheduled job (`CronExpression` enum or string) |
| `@Interval(ms)`            | Periodic job at the given interval                  |
| `@Timeout(ms)`             | One-shot timer                                      |
| `@Schedulable()`           | Mark a class as containing scheduled methods        |

## Example

```typescript
import { Schedulable, Cron, Interval, Timeout } from '@omnitron-dev/titan-scheduler';

@Injectable()
@Schedulable()
export class Jobs {
  @Cron('0 3 * * *', { timezone: 'UTC' })
  async nightlyCleanup() { /* … */ }

  @Interval(60_000)
  async refreshCache() { /* … */ }

  @Timeout(5_000, { runOnStart: true })
  async warmCachesAfterBoot() { /* … */ }
}
```

The discovery service automatically finds decorated methods at boot
and registers them with `SchedulerService`.

## Programmatic API

```typescript
import { SchedulerService, SCHEDULER_SERVICE_TOKEN } from '@omnitron-dev/titan-scheduler';

@Service({ name: 'jobs' })
class JobsService {
  constructor(@Inject(SCHEDULER_SERVICE_TOKEN) private readonly scheduler: SchedulerService) {}

  @Public()
  async scheduleOnce(at: Date, payload: unknown) {
    return this.scheduler.schedule({
      runAt:   at,
      handler: 'process-event',
      payload,
    });
  }
}
```

## Persistence

| Provider class                  | Persistence                                  |
| ------------------------------- | -------------------------------------------- |
| `InMemoryPersistenceProvider`   | None — jobs lost on restart                  |
| `RedisPersistenceProvider`      | Survives restart; cross-pod coordination     |
| `DatabasePersistenceProvider`   | SQL-backed; durable, transactional           |

## Distributed coordination

For multi-pod deployments, combine with `titan-lock` to ensure each
scheduled job runs once per fleet:

```typescript
import { Cron } from '@omnitron-dev/titan-scheduler';
import { WithDistributedLock } from '@omnitron-dev/titan-lock';

@Cron('0 * * * *')
@WithDistributedLock({ key: 'hourly-report', ttl: 10 * 60_000 })
async hourlyReport() { /* … */ }
```

## Metrics integration

`SchedulerMetricsService` records execution counts, durations, and
failures. Picks up `titan-metrics` automatically.

## Health indicator

`SchedulerHealthIndicator` is exported and registers with
`TitanHealthModule`.

## Exported tokens

| Token                                |
| ------------------------------------ |
| `SCHEDULER_CONFIG_TOKEN`             |
| `SCHEDULER_SERVICE_TOKEN`            |
| `SCHEDULER_REGISTRY_TOKEN`           |
| `SCHEDULER_EXECUTOR_TOKEN`           |
| `SCHEDULER_PERSISTENCE_TOKEN`        |
| `SCHEDULER_METRICS_TOKEN`            |
| `SCHEDULER_DISCOVERY_TOKEN`          |
| `SCHEDULER_LISTENERS_TOKEN`          |
