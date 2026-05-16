---
title: titan-telemetry-relay
---

# titan-telemetry-relay

Store-and-forward telemetry pipeline (logs, metrics, traces) for
distributed services. **Not a Titan module** — exposes a service
class you instantiate directly. Producer nodes buffer telemetry to a
write-ahead log; aggregator nodes drain the buffer and persist to a
backend. Handles network interruptions without data loss.

```bash
pnpm add @omnitron-dev/titan-telemetry-relay
```

## Why it isn't a module

Unlike the other ecosystem packages, `titan-telemetry-relay` doesn't
register itself as a Titan module. Reasons:

- The service can run as either a producer or an aggregator (often
  in different processes).
- The buffer (with write-ahead log) is process-state, not
  application-state.
- Different deployments wire it differently — sidecar, in-process,
  centralised collector.

You construct `TelemetryRelayService` directly and feed it into
whatever orchestration suits your topology.

## Setup — producer

```typescript
import { TelemetryRelayService } from '@omnitron-dev/titan-telemetry-relay';

const relay = new TelemetryRelayService({
  role:    'producer',
  nodeId:  process.env.HOSTNAME,
  // …buffer config
});

await relay.start();

// In your services, push telemetry:
relay.log({ level: 'info', message: 'order placed', orderId });
relay.metric({ name: 'orders.placed', value: 1 });
relay.span(span);
```

## Setup — aggregator

```typescript
const relay = new TelemetryRelayService({
  role: 'aggregator',
  // …downstream sinks
});

await relay.start();
```

The aggregator drains incoming telemetry and persists / forwards it
to your chosen sink (OpenTelemetry collector, Loki, Prometheus,
ClickHouse, etc.). Sink configuration is implementation-specific.

## Setup — both (sidecar pattern)

```typescript
const relay = new TelemetryRelayService({ role: 'both', /* … */ });
```

The same process buffers and forwards. Useful for sidecar
deployments where the service that produces telemetry also ships it.

### `TelemetryRelayModuleOptions`

| Option   | Type                                              |
| -------- | ------------------------------------------------- |
| `role`   | `'producer' \| 'aggregator' \| 'both'`            |
| `nodeId` | `string`                                          |
| (buffer) | `TelemetryBufferConfig` — `maxSize`, `flushInterval`, etc. |

## Exposed classes

- `TelemetryRelayService` — the main service.
- `TelemetryBuffer` — bounded in-memory buffer with backpressure.
- `TelemetryWal` — write-ahead log; persists buffer contents to disk
  for crash safety.

## When to use this

- You operate a fleet of services that emit telemetry and need to
  ship it without losing data on network glitches.
- You want a uniform pipeline for logs, metrics, and traces
  (instead of three separate exporters).
- You need a sidecar that buffers locally and forwards in batches.

For single-node or low-volume services, the standard logger
(`titan/module/logger`) + a direct metrics exporter is simpler.
