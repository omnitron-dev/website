---
title: titan-lock
---

# titan-lock

Distributed locks over Redis using UUID ownership, atomic Lua
scripts, TTL expiration, and configurable retries.

```bash
pnpm add @omnitron-dev/titan-lock
```

Requires `TitanRedisModule` (or a compatible Redis client).

## Setup

```typescript
import { TitanLockModule } from '@omnitron-dev/titan-lock';

@Module({
  imports: [
    TitanRedisModule.forRoot({ url: env.REDIS_URL }),
    TitanLockModule.forRoot({
      defaultTtl:        30_000,        // ms
      keyPrefix:         'lock',
      defaultRetries:    3,
      defaultRetryDelay: 100,           // ms (exponential backoff applied)
    }),
  ],
})
class AppModule {}
```

Also exported: `forRootAsync(options: ILockModuleAsyncOptions)`.

### `ILockModuleOptions`

| Option              | Type   | Default |
| ------------------- | ------ | ------- |
| `defaultTtl`        | `number` (ms) | `30_000` |
| `keyPrefix`         | `string` | `'lock'` |
| `defaultRetries`    | `number` | `3`     |
| `defaultRetryDelay` | `number` (ms) | `100` |
| `isGlobal`          | `boolean` | —     |

## `DistributedLockService`

```typescript
import { DistributedLockService, LOCK_SERVICE_TOKEN } from '@omnitron-dev/titan-lock';

@Service({ name: 'billing' })
class BillingService {
  constructor(
    @Inject(LOCK_SERVICE_TOKEN) private readonly locks: DistributedLockService,
  ) {}

  @Public()
  async charge(invoiceId: string) {
    return this.locks.withLock(`invoice:${invoiceId}`, async () => {
      // Exactly-once across the fleet.
      return this.processCharge(invoiceId);
    });
  }
}
```

Lower-level API: `acquire(key, ttl?)`, `release(key, token)`,
`extend(key, token, ttl)`. Consult the source for the canonical
surface.

## `@WithDistributedLock` decorator

```typescript
import { WithDistributedLock } from '@omnitron-dev/titan-lock';

@Public()
@WithDistributedLock({ key: (args) => `invoice:${args[0]}`, ttl: 60_000, retries: 5 })
async charge(invoiceId: string) { /* … */ }
```

## Safety

- Locks are owned by UUID — only the holder can release.
- Lua scripts guarantee atomic acquire/release semantics.
- TTL expires the lock if the holder dies.
- Retries use exponential backoff with the configured base delay.

## Exported tokens

| Token                    |
| ------------------------ |
| `LOCK_SERVICE_TOKEN`     |
| `LOCK_OPTIONS_TOKEN`     |
