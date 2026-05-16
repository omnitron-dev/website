---
sidebar_position: 3
title: Observability
description: Logs, metrics, traces — the three pillars and how to use each.
---

# Observability

Three pillars, three purposes:

| Pillar  | Answers                                                  | Cost per event |
| ------- | -------------------------------------------------------- | -------------- |
| Logs    | "What happened?" — exact context for one event           | Highest         |
| Metrics | "How much, how often?" — aggregates over many events     | Lowest          |
| Traces  | "How did the work flow?" — relationship between events   | Medium          |

Each pillar answers a question the others can't. You need all three.

## Logs

For every event you might need to investigate one day. Structured,
contextual, level-appropriate.

```typescript
this.logger.info('order created', {
  orderId:  order.id,
  userId:   ctx.auth.userId,
  amount:   order.total,
  currency: order.currency,
});
```

Don't:

- Log in tight loops without sampling.
- Log secrets (use a `RedactionProcessor`).
- Log objects without bounded size — they end up megabytes long.

→ See [Logging](../logging/overview.md).

## Metrics

For every quantity you want to chart, alert on, or query in
aggregate.

```typescript
metrics.histogram('order.processing.ms', { tier: order.tier }).observe(durationMs);
metrics.counter('order.created.total', { source: 'web' }).inc();
metrics.gauge('cache.size').set(this.cache.size);
```

Three metric types:

- **Counter** — monotonically increasing. Total count of events.
- **Gauge** — point-in-time value. Current size, current connections.
- **Histogram** — distribution of values. Latencies, sizes.

Cardinality matters: every unique combination of label values
creates a separate time series. `tier=basic|pro|enterprise` is fine
(3 series); `userId=…` is not (millions of series).

→ See [titan-metrics](../modules/metrics.md).

## Traces

For finding which call to which service caused the slowness or the
failure. One trace per request, spans for sub-operations.

```typescript
const span = startSpan('upstream.fetch', { attributes: { url: this.url } });
try {
  return await this.fetch();
} finally {
  span.end();
}
```

Don't span every function call. Span:

- Inbound RPC calls (Netron does this automatically).
- Outbound HTTP / DB calls (your responsibility).
- Long units of work that can fail.

→ See [Tracing](../tracing.md).

## What to instrument

A canonical service exposes:

| Signal                                         | Type      | Why                                |
| ---------------------------------------------- | --------- | ---------------------------------- |
| `rpc.call.total{service,method,outcome}`       | Counter   | Throughput, error rate             |
| `rpc.duration_ms{service,method,outcome}`      | Histogram | Latency distribution               |
| `db.query.duration_ms{table}`                  | Histogram | Database tail latency              |
| `outbound.duration_ms{provider}`               | Histogram | Third-party performance            |
| `cache.hit_rate{cache}`                        | Gauge     | Cache effectiveness                |
| `app.active_connections{transport}`            | Gauge     | Resource utilisation               |
| `lifecycle.boot_ms`                            | Histogram | Boot SLA                           |

Most of these are auto-emitted by `titan-metrics` and the relevant
modules. Custom metrics are for domain-specific quantities.

## Alerting policy

Alerts on:

- **Error rate** — `rpc.call.total{outcome=error}` divided by
  `rpc.call.total` exceeds threshold.
- **Latency** — `rpc.duration_ms` p99 > SLO.
- **Resource exhaustion** — connection pool full, queue depth high.
- **Health** — readiness flipping `unhealthy`.

Don't alert on:

- Individual log lines (use logs for investigation, not alerting).
- Counter rate changes that aren't errors (info-level changes don't
  page anyone).
- Cosmetic deviations (a 5% latency increase is normal noise).

## Correlation

The three pillars correlate via shared identifiers:

- **`traceId`** — same across every log line and every span in one
  trace.
- **`service` / `method`** — labels on metrics, fields on logs.
- **`userId` / `requestId`** — fields on logs and span attributes.

In practice: a slow request in your dashboard (metric) has a
`traceId`; pull the trace (spans) to see where time was spent; pull
the logs by `traceId` to see what happened in each span.

## Anti-patterns

- **One pillar.** Logs alone: can't aggregate. Metrics alone:
  can't investigate. Traces alone: can't quantify. Use all three.
- **Logs as metrics.** Counting `grep error /var/log/app.log` is
  slow, brittle, and lossy. Emit a counter; alert on the counter.
- **Metrics as logs.** A metric with a `userId` label is a
  high-cardinality timeseries that explodes the metrics backend.
  Use logs for per-user data.
- **Tracing without sampling.** Every span ends up in the
  collector; the cost is real. Sample at scale (the relay handles
  this).

→ Next: [Performance](./performance.md).
