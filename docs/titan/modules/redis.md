---
title: titan-redis
---

# titan-redis

Redis client module: connection pooling, cluster support, health
indicator integration. Used by `titan-cache` (Redis tier),
`titan-discovery`, `titan-lock`, `titan-ratelimit`, and
`titan-notifications`.

## Install

```bash
pnpm add @omnitron-dev/titan-redis
```

## Setup

```typescript
import { RedisModule } from '@omnitron-dev/titan-redis';

@Module({
  imports: [
    RedisModule.forRoot({
      url:    env.REDIS_URL,
      pool:   { min: 1, max: 10 },
      cluster: false,
    }),
  ],
})
export class AppModule {}
```

For Redis Cluster:

```typescript
RedisModule.forRoot({
  cluster: true,
  nodes: [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
  ],
})
```

## Use

Inject the typed client directly:

```typescript
@Injectable()
export class MyService {
  constructor(@InjectRedis() private readonly redis: RedisClient) {}

  async cachedSettings() {
    return this.redis.get('settings');
  }
}
```

## Health

Register `RedisHealth` with `titan-health` to expose the connection
status on `/healthz`:

```typescript
HealthModule.forRoot({ indicators: [RedisHealth] })
```
