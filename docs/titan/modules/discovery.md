---
title: titan-discovery
---

# titan-discovery

Service discovery backed by Redis. Running services register themselves;
clients resolve URLs by service name.

## Install

```bash
pnpm add @omnitron-dev/titan-discovery
```

## Setup

```typescript
import { DiscoveryModule } from '@omnitron-dev/titan-discovery';

@Module({
  imports: [
    DiscoveryModule.forRoot({
      redis:    { url: env.REDIS_URL },
      ttlMs:    15_000,        // Heartbeat window
      announce: { tags: ['v1', 'eu-west'] },
    }),
  ],
})
export class AppModule {}
```

The module heartbeats every running Netron transport into Redis with the
service name, version, and reachable URL. Stale entries expire after the
configured TTL.

## Resolving from a client

```typescript
const client = new NetronClient({
  discovery: { redis: { url: env.REDIS_URL } },
});

// Resolves the URL via discovery; falls back to round-robin across
// healthy instances.
const users = await client.queryInterface<UsersService>('users@1.0.0');
```

## Filtering by tags

```typescript
const users = await client.queryInterface<UsersService>('users@1.0.0', {
  tags: { region: 'eu-west' },
});
```

## Read also

- [titan-health](./health.md) — drives the heartbeat liveness signal.
- [titan-redis](./redis.md) — the underlying client.
