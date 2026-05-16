---
title: titan-metrics
---

# titan-metrics

Counters, gauges, and histograms with time-series storage. No
external metrics backend required — pluggable storage (memory,
PostgreSQL, SQLite). A Netron RPC service exposes the metrics
for the Omnitron console.

```bash
pnpm add @omnitron-dev/titan-metrics
```

## Setup

```typescript
import { TitanMetricsModule } from '@omnitron-dev/titan-metrics';

@Module({
  imports: [
    TitanMetricsModule.forRoot({
      storage:       { type: 'memory' },     // 'memory' | 'postgres' | 'sqlite'
      retention:     7 * 24 * 60 * 60 * 1000, // 7d in-memory retention
      flushInterval: 30_000,
    }),
  ],
})
class AppModule {}
```

For SQL-backed storage:

```typescript
TitanMetricsModule.forRoot({
  storage: { type: 'postgres', /* … connection details … */ },
})
```

### `IMetricsModuleOptions`

| Option           | Type                                                |
| ---------------- | --------------------------------------------------- |
| `storage`        | `{ type: 'memory' \| 'postgres' \| 'sqlite'; ... }` |
| `retention`      | `number` (ms)                                       |
| `flushInterval`  | `number` (ms)                                       |
| `isGlobal`       | `boolean`                                           |

Also exported: `forRootAsync(factory)`.

## `MetricsService`

```typescript
import { MetricsService, METRICS_SERVICE_TOKEN } from '@omnitron-dev/titan-metrics';

@Service({ name: 'users' })
class UsersService {
  constructor(@Inject(METRICS_SERVICE_TOKEN) private readonly metrics: MetricsService) {}

  private readonly created = this.metrics.counter('users.created.total', { labels: ['source'] });
  private readonly latency = this.metrics.histogram('users.find.ms', {
    buckets: [1, 5, 25, 100, 500, 2500],
  });

  @Public()
  async create(input: CreateInput) {
    const user = await this.repo.create(input);
    this.created.inc({ source: input.source });
    return user;
  }

  @Public()
  async findById(id: string) {
    const t0 = performance.now();
    try {
      return await this.repo.findById(id);
    } finally {
      this.latency.observe(performance.now() - t0);
    }
  }
}
```

## `@Metrics` decorator

```typescript
import { Metrics } from '@omnitron-dev/titan-metrics';

@Public()
@Metrics({ counter: 'orders.processed', histogram: 'orders.process.ms' })
async process(order: Order) { /* … */ }
```

## Storage backends

| Backend        | When                                                    |
| -------------- | ------------------------------------------------------- |
| `'memory'`     | Default. In-process buffer. Console reads from it.      |
| `'postgres'`   | Persist for cross-pod aggregation                       |
| `'sqlite'`     | Local persistence for single-node deployments           |

## RPC endpoint

`MetricsRpcService` is a Netron service exposing aggregated metrics
to the Omnitron CLI / web console.

## Exposed classes

`MetricsService`, `MetricsCollector`, `MetricsRegistry`,
`MemoryMetricsStorage`, `PostgresMetricsStorage`,
`SQLiteMetricsStorage`, `MetricsRpcService`.

## Exported tokens

| Token                       |
| --------------------------- |
| `METRICS_SERVICE_TOKEN`     |
| `METRICS_OPTIONS_TOKEN`     |
| `METRICS_STORAGE_TOKEN`     |
