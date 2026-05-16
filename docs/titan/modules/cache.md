---
title: titan-cache
---

# titan-cache

Multi-tier caching with LRU/LFU eviction, TTL, optional compression,
and a Redis-backed L2 tier.

```bash
pnpm add @omnitron-dev/titan-cache
```

## Setup

### Single-tier (in-memory)

```typescript
import { TitanCacheModule } from '@omnitron-dev/titan-cache';

@Module({
  imports: [
    TitanCacheModule.forRoot({
      maxSize:        1_000,
      defaultTtl:     300,                // seconds
      evictionPolicy: 'lru',
      enableStats:    true,
    }),
  ],
})
class AppModule {}
```

### Multi-tier (L1 in-memory + L2 Redis)

```typescript
TitanCacheModule.forRoot({
  multiTier: true,
  l1: { maxSize: 1_000, ttl: 60 },          // L1: hot data, short TTL
  l2: { client: redisClient, ttl: 3600, prefix: 'app:cache' },
})
```

A read first checks L1; a miss queries L2 and back-fills L1. A write
populates both tiers.

### `ICacheModuleOptions`

| Option                  | Type                       | Default       |
| ----------------------- | -------------------------- | ------------- |
| `maxSize`               | `number`                   | `1_000`       |
| `defaultTtl`            | `number` (seconds)         | `300`         |
| `evictionPolicy`        | `'lru' \| 'lfu'`           | `'lru'`       |
| `enableStats`           | `boolean`                  | `true`        |
| `compressionThreshold`  | `number` (bytes)           | `1_024`       |
| `compressionAlgorithm`  | `'none' \| 'gzip'`         | `'none'`      |
| `multiTier`             | `boolean`                  | —             |
| `l1`                    | `{ maxSize, ttl }`         | —             |
| `l2`                    | `{ client, ttl, prefix }`  | —             |
| `isGlobal`              | `boolean`                  | —             |

## `CacheService`

```typescript
import { CacheService, CACHE_DEFAULT_TOKEN } from '@omnitron-dev/titan-cache';

@Service({ name: 'users' })
class UsersService {
  constructor(@Inject(CACHE_DEFAULT_TOKEN) private readonly cache: CacheService) {}

  @Public()
  async findById(id: string) {
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.repo.findById(id);
    await this.cache.set(`user:${id}`, user, 60);  // TTL in seconds
    return user;
  }
}
```

Common methods (consult the source for the canonical surface):
`get`, `set`, `delete`, `has`, `clear`, `stats`.

## `@Cacheable` decorator

```typescript
import { Cacheable } from '@omnitron-dev/titan-cache';

@Cacheable({ ttl: 30, key: (args) => `user:${args[0]}` })
async findById(id: string) { /* … */ }
```

## Exported tokens

| Symbol                       | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `CACHE_SERVICE_TOKEN`        | Default cache service                            |
| `CACHE_DEFAULT_TOKEN`        | Default cache instance                           |
| `CACHE_OPTIONS_TOKEN`        | Resolved options bundle                          |
| `getCacheToken(name)`        | Per-name cache token (multi-cache deployments)   |

## Exposed classes

`CacheService`, `LruCache`, `LfuCache`, `MultiTierCache` — choose
the right base class if you want to build a custom cache layer.
