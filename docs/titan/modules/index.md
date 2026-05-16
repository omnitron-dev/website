---
sidebar_position: 1
title: Titan Modules
---

# Titan Modules

Fourteen ecosystem packages that cover the workhorse layer of every
backend. Each module:

- Ships as a separate npm package under `@omnitron-dev/`.
- Depends on `@omnitron-dev/titan` core; some depend on
  `@omnitron-dev/titan-redis` for shared infrastructure.
- Exposes a `Module.forRoot({...})` static (and usually
  `.forRootAsync({...})`) for configuration.
- Is independently versionable — adopting one does not pin you to
  others.

## Catalogue

| Module class                  | Package                          | Purpose                                                          |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| [`TitanAuthModule`](./auth.md) | `@omnitron-dev/titan-auth`      | JWT auth (HS256 / RS256 / ES256), JWKS, token cache              |
| [`TitanCacheModule`](./cache.md) | `@omnitron-dev/titan-cache`    | Multi-tier (L1/L2) caching with LRU / LFU, Redis backing         |
| [`TitanDatabaseModule`](./database.md) | `@omnitron-dev/titan-database` | Kysely + migrations + RLS, multi-dialect                |
| [`DiscoveryModule`](./discovery.md) | `@omnitron-dev/titan-discovery` | Redis-backed service discovery + Netron integration         |
| [`EventsModule`](./events.md)  | `@omnitron-dev/titan-events`    | Typed event bus, wildcard, scheduling, history                   |
| [`TitanHealthModule`](./health.md) | `@omnitron-dev/titan-health` | Health indicators (memory, event-loop, disk, db, redis)          |
| [`TitanLockModule`](./lock.md) | `@omnitron-dev/titan-lock`      | Distributed Redis locks with UUID ownership + Lua scripts        |
| [`TitanMetricsModule`](./metrics.md) | `@omnitron-dev/titan-metrics` | Counters / gauges / histograms, pluggable storage           |
| [`NotificationsModule`](./notifications.md) | `@omnitron-dev/titan-notifications` | Multi-channel delivery + templates + DLQ            |
| [`ProcessManagerModule`](./pm.md) | `@omnitron-dev/titan-pm`     | Process supervision, worker pools, IPC                           |
| [`TitanRateLimitModule`](./ratelimit.md) | `@omnitron-dev/titan-ratelimit` | Token-bucket, sliding-window, fixed-window strategies   |
| [`TitanRedisModule`](./redis.md) | `@omnitron-dev/titan-redis`   | Redis client (clustering, sentinel, TLS, named instances)        |
| [`SchedulerModule`](./scheduler.md) | `@omnitron-dev/titan-scheduler` | Cron + interval + timeout with persistence                  |
| [`TelemetryRelayService`](./telemetry-relay.md) | `@omnitron-dev/titan-telemetry-relay` | Store-and-forward telemetry pipeline (no module)|

## Composition

Modules compose through the standard Titan `imports` chain:

```typescript
@Module({
  imports: [
    TitanRedisModule.forRoot({ url: env.REDIS_URL }),
    TitanAuthModule.forRoot({ jwtSecret: env.JWT_SECRET }),
    TitanCacheModule.forRoot({ multiTier: true, l2: { client: redisClient, ttl: 60 } }),
    TitanDatabaseModule.forRoot({ dialect: 'postgres', connection: env.DATABASE_URL }),
    SchedulerModule.forRoot({ persistence: { provider: 'redis' } }),
    TitanMetricsModule.forRoot({ storage: { type: 'memory' } }),
  ],
  providers: [/* your services */],
})
export class AppModule {}
```

Order in `imports` does not matter; the container resolves the
dependency graph.

## Redis dependency

Five modules depend on a Redis client provided by
`TitanRedisModule`:

- `titan-cache` (when L2 tier enabled)
- `titan-lock`
- `titan-discovery`
- `titan-ratelimit` (when `storageType: 'redis'`)
- `titan-notifications` (rate limiter, preference store, rotif)

Register `TitanRedisModule.forRoot(...)` first; the rest pick up
the shared client automatically.

## Choosing modules

Most backends start with a small set:

- **Web API service**: auth + database + cache + health + metrics
- **Worker service**: database + lock + scheduler + metrics + health
- **Notification gateway**: notifications + ratelimit + metrics
- **Multi-instance app**: add discovery to the above
