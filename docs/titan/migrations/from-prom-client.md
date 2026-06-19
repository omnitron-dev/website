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
| `new Histogram({ buckets })`              | `metrics.recordTyped('histogram', name, labels, v)`           |
| `register.metrics()`                      | `metrics.getPrometheusText()`                  |
| `collectDefaultMetrics()`                 | `collection: { process: true, system: true }` |
| Custom registry per app                   | `appName` option (tags every sample)           |
| (no built-in storage)                     | `storage: { type: 'memory' \| 'sqlite' \| 'postgres' }` |
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

The Titan equivalent uses the `@Metrics` decorator for automatic
RPC instrumentation, and `recordTyped` for your own counters /
histograms:

```typescript
// titan-metrics
import { Module, Service, Inject } from '@omnitron-dev/titan';
import { Public } from '@omnitron-dev/titan/decorators';
import { TitanMetricsModule, MetricsService, METRICS_SERVICE_TOKEN, Metrics }
  from '@omnitron-dev/titan-metrics';

@Service('orders@1.0.0')
class OrdersService {
  constructor(
    @Inject(METRICS_SERVICE_TOKEN) private readonly metrics: MetricsService,
  ) {}

  // @Metrics() auto-records rpc_requests_total,
  // rpc_request_duration_seconds and rpc_errors_total for this method.
  // The optional string only overrides the `method` label.
  @Public()
  @Metrics()
  async create(input: CreateOrder) {
    const order = await this.repo.create(input);
    // Custom metrics use recordTyped — there is no counter/histogram
    // option on @Metrics.
    this.metrics.recordTyped('counter', 'orders_processed_total', { status: 'ok' }, 1);
    return order;
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

:::note
`@Metrics()` only records once the instance is linked to the
`MetricsService` via `attachMetricsService(instance, service)` —
`forRoot()` does not do this for you. The imperative `recordTyped`
path (using the injected service) works with no extra wiring.
:::

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
RSS, heap, CPU, uptime. (Event-loop lag is not built in; register
a gauge yourself if you need it.)

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
metrics.recordTyped('counter', 'users_created_total', { source: 'web' }, 1);
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
// MetricsRpcService (Netron service name 'OmnitronMetrics') is NOT
// auto-registered by the module — expose it yourself, constructing it
// with the injected MetricsService.
```

### 5. Drop `prom-client`

Once every `Counter` / `Gauge` / `Histogram` is gone:

```bash
pnpm remove prom-client
```

## Naming conventions

`prom-client` uses `snake_case`. **`titan-metrics` does not
normalise metric names** — `getPrometheusText()` emits the name
exactly as you registered it. Prometheus metric names may only
contain `[a-zA-Z0-9_:]`, so a dotted name like `users.created.total`
would be emitted verbatim and produce **invalid** exposition.

Use `snake_case` at the call site:

| What you record          | Prometheus exposition       |
| ------------------------ | --------------------------- |
| `users_created_total`    | `users_created_total`       |
| `http_request_duration`  | `http_request_duration`     |
| `orders_processed_total` | `orders_processed_total`    |

The built-in collectors already follow this (`rpc_requests_total`,
`heap_used_bytes`, …); match it so your custom metrics scrape cleanly.

## Labels

Same advice as `prom-client`: keep label cardinality small.

- **Good:** `tier`, `region`, `status`, `route`, `version`.
- **Bad:** `userId`, `requestId`, `email` — every value creates a
  fresh time series.

`titan-metrics` will happily accept high-cardinality labels and
your storage backend will fill up. Discipline lives in the call
sites.

## Histograms

`prom-client` lets you set buckets per-histogram. `titan-metrics`
applies one **registry-wide** bucket set instead: `recordTyped('histogram',
…)` records against the registry's configured buckets (a default set
unless the registry is constructed with a custom `buckets` array) —
there is no per-call bucket argument.

Five-to-ten buckets is usually right. Each bucket is a separate
time-series, so over-bucketing has real cost.

## Default metrics

| `prom-client`                  | `titan-metrics`                            |
| ------------------------------ | ------------------------------------------ |
| `collectDefaultMetrics()`      | `collection: { process: true }`            |
| `collectDefaultMetrics({ register })` | (registry is module-managed; nothing to pass) |
| heap / RSS / CPU / uptime      | Included via `collection.process`; sample at `collection.interval` (default 5s). Event-loop lag / GC / FDs are not built in. |

## Persistence — the bit `prom-client` doesn't do

`titan-metrics` flushes samples to the storage backend on a fixed
5s cadence. This unlocks queries from inside your app:

```typescript
const series = await metrics.querySeries({
  names:    ['orders_process_ms'],   // array; filter by metric name(s)
  from:     Date.now() - 3_600_000,
  to:       Date.now(),
  interval: '1m',                    // bucket size as a duration string
});
```

Use cases:

- **Operator console** without Prometheus.
- **Auto-degradation logic** that reads its own metrics.
- **Cross-pod aggregation** by pointing `storage: { type: 'postgres' }`
  at a shared connection.

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
- **`@Metrics()` decorator** auto-instruments a Netron method with
  the fixed `rpc_requests_total` / `rpc_request_duration_seconds` /
  `rpc_errors_total` set. It takes only an optional method-label
  string — for custom metrics you still use `recordTyped`.

## See also

- [`titan-metrics`](../modules/metrics.mdx) — full reference
- [Best Practices / Observability](../best-practices/observability.md)
- [`titan-telemetry-relay`](../modules/telemetry-relay.mdx) —
  store-and-forward shipping for offline/edge deployments
