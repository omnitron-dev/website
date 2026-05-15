---
title: titan-telemetry-relay
---

# titan-telemetry-relay

Store-and-forward telemetry pipeline. Buffers metrics, traces, and logs
locally; ships them to your collector when reachable; survives collector
outages without dropping data.

## Install

```bash
pnpm add @omnitron-dev/titan-telemetry-relay
```

## Setup

```typescript
import { TelemetryRelayModule } from '@omnitron-dev/titan-telemetry-relay';

@Module({
  imports: [
    TelemetryRelayModule.forRoot({
      buffer: {
        type:    'sqlite',                  // 'memory' | 'sqlite'
        path:    './var/telemetry.db',
        maxSize: 100 * 1024 * 1024,         // 100 MB cap
      },
      sinks: [
        { type: 'otlp', endpoint: 'https://collector.internal/v1/traces' },
        { type: 'prometheus-remote-write', url: 'https://prom.internal/api/v1/write' },
      ],
      retry: { baseDelayMs: 1_000, maxDelayMs: 60_000 },
    }),
  ],
})
export class AppModule {}
```

## Why a relay

A direct OTLP exporter loses spans during collector outages. The relay:

1. Writes telemetry to a local buffer first (SQLite by default for
   crash safety).
2. Ships to configured sinks in the background.
3. Backs off when sinks fail; never blocks the producer.
4. Surfaces buffer pressure as a metric you can alert on.

## Integration

The relay registers as the default exporter for `titan-metrics`,
`LoggerModule`, and the Netron tracing middleware automatically. You
can also write to it directly:

```typescript
@Service('audit@1.0.0')
export class AuditService {
  constructor(private readonly relay: TelemetryRelay) {}

  @Public()
  async record(event: AuditEvent) {
    this.relay.log({ kind: 'audit', event });
  }
}
```
