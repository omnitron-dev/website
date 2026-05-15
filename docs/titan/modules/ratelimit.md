---
title: titan-ratelimit
---

# titan-ratelimit

Rate limiting with Redis-backed token buckets. Apply per-user, per-IP,
or per-arbitrary-key.

## Install

```bash
pnpm add @omnitron-dev/titan-ratelimit
```

## Setup

```typescript
import { RateLimitModule } from '@omnitron-dev/titan-ratelimit';

@Module({
  imports: [
    RateLimitModule.forRoot({
      redis: { url: env.REDIS_URL },
      defaults: {
        capacity: 100,
        refillPerSec: 10,
      },
    }),
  ],
})
export class AppModule {}
```

## Apply

### As Netron middleware

```typescript
@Module({
  imports: [
    NetronModule.forRoot({ middleware: [RateLimitMiddleware] }),
  ],
})
```

The middleware uses the auth context (if present) for the bucket key,
falling back to client IP.

### Per-method

```typescript
@Public()
@RateLimited({ key: (ctx) => ctx.auth.userId, capacity: 30, refillPerSec: 1 })
async sendInvite(email: string) { /* … */ }
```

### Manual

```typescript
const allowed = await this.rate.tryConsume(`charge:${userId}`, 1);
if (!allowed) {
  throw new RateLimitedError('too many charge attempts');
}
```

## Headers

When applied as middleware over HTTP, the module emits the standard
`X-RateLimit-*` headers and returns `429 Too Many Requests` on exhaustion.
