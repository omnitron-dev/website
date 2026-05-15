---
title: titan-cache
---

# titan-cache

Multi-tier caching with LRU, LFU, and TTL strategies. Backed by an
in-memory tier or Redis.

## Install

```bash
pnpm add @omnitron-dev/titan-cache
```

## Setup

```typescript
import { CacheModule } from '@omnitron-dev/titan-cache';

@Module({
  imports: [
    CacheModule.forRoot({
      tier:   'lru',          // 'lru' | 'lfu' | 'ttl' | 'redis-lru'
      max:    10_000,
      ttlMs:  60_000,
    }),
  ],
})
export class AppModule {}
```

## Use

Inject `CacheService` and call `getOrSet` to read-through:

```typescript
@Service('users@1.0.0')
export class UsersService {
  constructor(
    private readonly cache: CacheService,
    private readonly repo:  UsersRepository,
  ) {}

  @Public()
  async findById(id: string): Promise<User> {
    return this.cache.getOrSet(`user:${id}`, () => this.repo.findById(id), {
      ttlMs: 30_000,
    });
  }
}
```

## Decorator form

```typescript
@Public()
@Cached({ key: (id) => `user:${id}`, ttlMs: 30_000 })
async findById(id: string): Promise<User> {
  return this.repo.findById(id);
}
```

## Invalidation

```typescript
await this.cache.delete(`user:${id}`);
await this.cache.deleteByPattern('user:*');
```

For multi-instance deployments, use the `redis-lru` tier so invalidations
propagate across pods.
