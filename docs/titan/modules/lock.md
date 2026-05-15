---
title: titan-lock
---

# titan-lock

Distributed locks over Redis. Coordinate access to shared resources
across processes and machines.

## Install

```bash
pnpm add @omnitron-dev/titan-lock
```

## Setup

```typescript
import { LockModule } from '@omnitron-dev/titan-lock';

@Module({
  imports: [
    LockModule.forRoot({
      redis:    { url: env.REDIS_URL },
      ttlMs:    30_000,        // Lease — auto-released if process dies
      retryMs:  100,
      maxRetry: 50,
    }),
  ],
})
export class AppModule {}
```

## Use

```typescript
@Service('billing@1.0.0')
export class BillingService {
  constructor(private readonly locks: LockService) {}

  @Public()
  async charge(invoiceId: string) {
    return this.locks.withLock(`invoice:${invoiceId}`, async () => {
      // Exactly-once charge logic — guaranteed serialised across pods.
      return this.processCharge(invoiceId);
    });
  }
}
```

## Manual acquire

```typescript
const lease = await this.locks.acquire('invoice:42', { ttlMs: 60_000 });
try {
  await this.doWork();
} finally {
  await lease.release();
}
```

A lease auto-extends while the holder runs — if the process dies, the
lease expires after `ttlMs` and another process can acquire it.

## Read also

- The module uses a `FailureTracker` primitive to suppress log spam
  during repeated lock failures (see `titan/FailureTracker`).
