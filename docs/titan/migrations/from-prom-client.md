---
sidebar_position: 4
title: From prom-client
description: Replacing prom-client with titan-metrics.
---

# From prom-client

[`prom-client`](https://github.com/siimon/prom-client) is the
de-facto Prometheus client for Node. It is excellent at what it
does — instrument code, expose `/metrics`, hand off to a real
Prometheus server. `titan-metrics` covers the same use case while
also persisting samples to a storage backend (memory / SQLite /
Postgres), letting you query time-series **inside** your app and
ship cross-pod aggregates without standing up Prometheus first.

This page is the surgical recipe for moving from one to the other.

## At a glance

| `prom-client`                             | `titan-metrics`                                |
| ----------------------------------------- | ---------------------------------------------- |
| `new Registry()`                          | `MetricsService` (DI-provided singleton)       |
| `new Counter({ name, help, labelNames })` | `metrics.recordTyped('counter', name, labels, 1)` |
| `new Gauge(...)`                          | `metrics.recordTyped('gauge', name, labels, v)` |
| `new Histogram({ buckets })`              | `metrics.recordTyped('histogram', name, labels, v)` + `@Metrics` decorator |
| `register.metrics()`                      | `metrics.getPrometheusText()`                  |
| `collectDefaultMetrics()`                 | `collection: { process: true, system: true }` |
| Custom registry per app                   | `appName` option (tags every sample)           |
| (no built-in storage)                     | `storage: 'memory' \| 'sqlite' \| 'postgres'` |
| (manual cleanup)                          | `retention: { maxAge: '7d' }` (automatic)      |
| (manual exposition route)                 | `MetricsRpcService` over Netron (or roll your own) |

## A side-by-side concrete example

Suppose you currently instrument an HTTP handler like this:

```typescript
// prom-client
import { Counter, Histogram, register, collectDefaultMetrics }
  from 'prom-client';

collectDefaultMetrics();

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests',
  labelNames: ['route', 'status'],
});

const httpDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP latency (ms)',
  labelNames: ['route'],
  buckets:    [5, 25, 100, 500, 2500],
});

app.post('/orders', async (req, res) => {
  const end = httpDuration.startTimer({ route: '/orders' });
  try {
    const order = await orders.create(req.body);
    res.json(order);
    httpRequests.inc({ route: '/orders', status: '200' });
  } catch (e) {
    httpRequests.inc({ route: '/orders', status: '500' });
    throw e;
  } finally { end(); }
});

app.get('/metrics', async (_req, res) => {
  res.type(register.contentType).end(await register.metrics());
});
```

The Titan equivalent leans on the `@Metrics` decorator:

```typescript
// titan-metrics
import { Module, Service, Public, Inject } from '@omnitron-dev/titan';
import { TitanMetricsModule, MetricsService, METRICS_SERVICE_TOKEN, Metrics }
  from '@omnitron-dev/titan-metrics';

@Service('orders@1.0.0')
class OrdersService {
  @Public()
  @Metrics({
    counter:   { name: 'orders.processed.total' },
    histogram: { name: 'orders.process.ms', buckets: [5, 25, 100, 500, 2500] },
  })
  async create(input: CreateOrder) {
    return this.repo.create(input);
  }
}

@Module({
  imports: [
    TitanMetricsModule.forRoot({
      appName:    'orders-api',
      collection: { enabled: true, process: true, system: true, rpc: true },
      storage:    { type: 'memory' },
    }),
  ],
  providers: [OrdersService],
})
class AppModule {}
```

If you need the raw Prometheus text:

```typescript
const text = await metrics.getPrometheusText();
// Serve from any HTTP route, or expose via the RPC service.
```

## Step-by-step migration

### 1. Install the module, keep `prom-client` for now

```bash
pnpm add @omnitron-dev/titan-metrics
```

Don't uninstall `prom-client` yet — you'll cut it last.

### 2. Boot the module

```typescript
TitanMetricsModule.forRoot({
  appName:    'my-service',
  collection: { enabled: true, process: true, system: true, rpc: true },
  storage:    { type: 'memory' },  // try sqlite/postgres later
})
```

`collection.process: true` replaces `collectDefaultMetrics()` —
RSS, heap, event loop, CPU.

### 3. Migrate one metric at a time

For each existing counter / gauge / histogram, write the Titan
equivalent:

```typescript
// Before
const userCreated = new Counter({
  name: 'users_created_total',
  help: 'Users created',
  labelNames: ['source'],
});
userCreated.inc({ source: 'web' });

// After
metrics.recordTyped('counter', 'users.created.total', { source: 'web' }, 1);
```

`recordTyped` is the canonical API — it keeps the Prometheus
registry and storage backend synchronised in a single call.

### 4. Migrate the exposition route

```typescript
// Before
app.get('/metrics', async (_req, res) => {
  res.type(register.contentType).end(await register.metrics());
});

// After (HTTP)
app.get('/metrics', async (_req, res) => {
  res.type('text/plain; version=0.0.4').end(await metrics.getPrometheusText());
});

// After (via Netron RPC — what the Omnitron console reads)
// MetricsRpcService auto-registers when the module is loaded;
// no extra wiring needed.
```

### 5. Drop `prom-client`

Once every `Counter` / `Gauge` / `Histogram` is gone:

```bash
pnpm remove prom-client
```

## Naming conventions

`prom-client` uses `snake_case`; `titan-metrics` accepts both.
The Prometheus exposition normalises to `snake_case` (dots become
underscores), so:

| Source name              | Prometheus exposition       |
| ------------------------ | --------------------------- |
| `users.created.total`    | `users_created_total`       |
| `http.request.duration`  | `http_request_duration`     |
| `orders_processed_total` | `orders_processed_total`    |

Pick one convention per codebase; `dot.notation` reads more
naturally in TypeScript.

## Labels

Same advice as `prom-client`: keep label cardinality small.

- **Good:** `tier`, `region`, `status`, `route`, `version`.
- **Bad:** `userId`, `requestId`, `email` — every value creates a
  fresh time series.

`titan-metrics` will happily accept high-cardinality labels and
your storage backend will fill up. Discipline lives in the call
sites.

## Histograms

Both use bucket arrays of the form `[1, 5, 25, 100, 500]`. The
defaults differ — `titan-metrics` does not assume a one-size-fits-
all set, so always pass `buckets` for histograms you care about.

Five-to-ten buckets is usually right. Each bucket is a separate
time-series, so over-bucketing has real cost.

## Default metrics

| `prom-client`                  | `titan-metrics`                            |
| ------------------------------ | ------------------------------------------ |
| `collectDefaultMetrics()`      | `collection: { process: true }`            |
| `collectDefaultMetrics({ register })` | (registry is module-managed; nothing to pass) |
| GC / event-loop / RSS / FDs    | All included; sample at `collection.interval` (default 5s) |

## Persistence — the bit `prom-client` doesn't do

`titan-metrics` writes samples to a storage backend on a
`flushInterval` (default 5s). This unlocks queries from inside your
app:

```typescript
const series = await metrics.querySeries({
  name:  'orders.process.ms',
  from:  Date.now() - 3_600_000,
  to:    Date.now(),
  step:  60_000,
});
```

Use cases:

- **Operator console** without Prometheus.
- **Auto-degradation logic** that reads its own metrics.
- **Cross-pod aggregation** by pointing `storage: 'postgres'` at
  a shared connection.

If you don't need these, the `'memory'` backend is essentially
free — the ring buffer caps RAM use, the exposition path is
identical to a plain registry, and you keep the option of turning
persistence on later.

## What's different

- **No registry per-instance.** The container provides one
  `MetricsService` per app; multi-registry scenarios are rare and
  handled by `appName` tags or separate processes.
- **`recordTyped` instead of typed builders.** Less verbose,
  fewer pre-declared objects, but you lose the compile-time
  guarantee that the label set matches the declaration.
- **`@Metrics` decorator** for the common method-instrumentation
  pattern — you'll reach for it more than the imperative API.

## See also

- [`titan-metrics`](../modules/metrics.mdx) — full reference
- [Best Practices / Observability](../best-practices/observability.md)
- [`titan-telemetry-relay`](../modules/telemetry-relay.mdx) —
  store-and-forward shipping for offline/edge deployments
