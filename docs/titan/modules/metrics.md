---
title: titan-metrics
---

# titan-metrics

Counters, gauges, histograms, and a time-series buffer. Pluggable
exporters (Prometheus, OTLP, custom).

## Install

```bash
pnpm add @omnitron-dev/titan-metrics
```

## Setup

```typescript
import { MetricsModule } from '@omnitron-dev/titan-metrics';

@Module({
  imports: [
    MetricsModule.forRoot({
      exporter: { type: 'prometheus', port: 9090, path: '/metrics' },
      defaultLabels: { service: 'users', env: process.env.NODE_ENV },
    }),
  ],
})
export class AppModule {}
```

## Use

```typescript
@Service('users@1.0.0')
export class UsersService {
  constructor(private readonly metrics: MetricsService) {}

  private readonly created = this.metrics.counter('users.created.total', {
    help:   'Number of users created',
    labels: ['source'],
  });

  private readonly latency = this.metrics.histogram('users.find.ms', {
    help:    'findById latency in ms',
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
    return this.latency.timeAsync(() => this.repo.findById(id));
  }
}
```

## Decorator form

```typescript
@Public()
@Metered({ counter: 'orders.processed.total', histogram: 'orders.process.ms' })
async process(order: Order) { /* … */ }
```

## In-memory time series

For local dashboards, the module keeps a rolling buffer of the last N
samples per metric. The Omnitron web console reads from it directly.
