---
title: titan-ratelimit
---

# titan-ratelimit

Token-bucket, sliding-window, and fixed-window rate limiting with
Redis or in-memory storage. Supports per-user, per-IP, tier-based
policies and queueing for delayed throttling.

```bash
pnpm add @omnitron-dev/titan-ratelimit
```

## Setup

### In-memory

```typescript
import { TitanRateLimitModule } from '@omnitron-dev/titan-ratelimit';

@Module({
  imports: [
    TitanRateLimitModule.forRoot({
      enabled:         true,
      strategy:        'sliding-window',
      defaultLimit:    100,
      defaultWindowMs: 60_000,
      storageType:     'memory',
    }),
  ],
})
class AppModule {}
```

### Redis-backed (multi-pod)

```typescript
TitanRateLimitModule.forRoot({
  storageType:     'redis',
  strategy:        'sliding-window',
  defaultLimit:    100,
  defaultWindowMs: 60_000,
  burstLimit:      150,
  keyPrefix:       'rl',
  // For token bucket:
  tokenRefillRate: 100,
  // Optional queue
  queueEnabled:    true,
  maxQueueSize:    1_000,
  queueTimeoutMs:  5_000,
  // Tiered plans
  tiers: {
    free:    { limit: 10,  windowMs: 60_000 },
    premium: { limit: 1000, windowMs: 60_000 },
  },
})
```

Also exported: `forRootAsync(options: IRateLimitModuleAsyncOptions)`.

### `IRateLimitModuleOptions`

| Option              | Type                                                              | Default               |
| ------------------- | ----------------------------------------------------------------- | --------------------- |
| `enabled`           | `boolean`                                                         | `true`                |
| `strategy`          | `'token-bucket' \| 'sliding-window' \| 'fixed-window'`            | `'sliding-window'`    |
| `keyPrefix`         | `string`                                                          | —                     |
| `defaultLimit`      | `number`                                                          | `100`                 |
| `defaultWindowMs`   | `number` (ms)                                                     | `60_000`              |
| `burstLimit`        | `number`                                                          | `0`                   |
| `tokenRefillRate`   | `number`                                                          | `100`                 |
| `queueEnabled`      | `boolean`                                                         | —                     |
| `maxQueueSize`      | `number`                                                          | —                     |
| `queueTimeoutMs`    | `number`                                                          | —                     |
| `storageType`       | `'memory' \| 'redis'`                                             | `'memory'`            |
| `tiers`             | `Record<string, TierConfig>`                                      | —                     |
| `isGlobal`          | `boolean`                                                         | —                     |

## Decorators

### `@RateLimit({ limit, windowMs })`

Apply per-method:

```typescript
import { RateLimit } from '@omnitron-dev/titan-ratelimit';

@Public()
@RateLimit({ limit: 30, windowMs: 60_000 })
async sendInvite(email: string) { /* … */ }
```

### `@Throttle(requestsPerSecond)`

Convenience wrapper:

```typescript
import { Throttle } from '@omnitron-dev/titan-ratelimit';

@Public()
@Throttle(10)
async search(query: string) { /* … */ }
```

## Programmatic use

```typescript
import { RateLimitService, RATE_LIMIT_SERVICE_TOKEN } from '@omnitron-dev/titan-ratelimit';

@Service({ name: 'charges' })
class ChargesService {
  constructor(@Inject(RATE_LIMIT_SERVICE_TOKEN) private readonly rate: RateLimitService) {}

  @Public()
  async charge(userId: string, amount: number) {
    const allowed = await this.rate.tryConsume(`charge:${userId}`);
    if (!allowed) throw Errors.rateLimit('too many charge attempts');
    // …
  }
}
```

## Exported tokens

| Token                          |
| ------------------------------ |
| `RATE_LIMIT_SERVICE_TOKEN`     |
| `RATE_LIMIT_OPTIONS_TOKEN`     |
| `RATE_LIMIT_STORAGE_TOKEN`     |
