---
title: titan-discovery
---

# titan-discovery

Redis-backed service discovery with health-based filtering and
automatic Netron integration.

```bash
pnpm add @omnitron-dev/titan-discovery
```

## Setup

```typescript
import { DiscoveryModule } from '@omnitron-dev/titan-discovery';

@Module({
  imports: [
    DiscoveryModule.forRoot({
      serviceName:             'users-api',
      nodeId:                  process.env.HOSTNAME,
      redisUrl:                env.REDIS_URL,
      enableNetronIntegration: true,
      heartbeatInterval:       15_000,
      healthCheckUrl:          '/healthz',
    }),
  ],
})
class AppModule {}
```

`serviceName` is **required**. Every other field is optional.

### `DiscoveryModuleOptions`

| Option                     | Type     | Default            |
| -------------------------- | -------- | ------------------ |
| `serviceName`              | `string` | (required)         |
| `nodeId`                   | `string` | generated UUID     |
| `redisUrl`                 | `string` | —                  |
| `redisOptions`             | `any`    | —                  |
| `enableNetronIntegration`  | `boolean`| `true`             |
| `heartbeatInterval`        | `number` (ms) | —             |
| `healthCheckUrl`           | `string` | —                  |

## What it does

- **Registration.** On startup, the service registers itself in Redis
  with `serviceName`, `nodeId`, and reachable URL.
- **Heartbeat.** A periodic heartbeat keeps the registration alive.
  Missed heartbeats expire the entry.
- **Discovery.** Clients query the registry for available instances
  of a service.
- **Netron integration.** When enabled, Netron's RPC machinery picks
  up registry data automatically for client-side resolution.

## Reading from the service

```typescript
import { DiscoveryService, DISCOVERY_SERVICE_TOKEN } from '@omnitron-dev/titan-discovery';

@Service({ name: 'admin' })
class AdminService {
  constructor(
    @Inject(DISCOVERY_SERVICE_TOKEN) private readonly discovery: DiscoveryService,
  ) {}

  @Public()
  async listInstances(name: string) {
    return this.discovery.list(name);
  }
}
```

`DiscoveryService` exposes lookups, health-aware filtering, and
event subscriptions for registry changes. Consult the source for the
canonical method signatures.

## Exported tokens

| Token                                  | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `DISCOVERY_SERVICE_TOKEN`              | Resolve `DiscoveryService`               |
| `REDIS_TOKEN`                          | Internal Redis client                    |
| `DISCOVERY_OPTIONS_TOKEN`              | Options bundle                           |
| `DiscoveryModuleToken`                 | Module identity token                    |
| `NETRON_DISCOVERY_INTEGRATION_TOKEN`   | Netron integration helper                |
