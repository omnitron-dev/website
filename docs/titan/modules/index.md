---
sidebar_position: 1
title: Titan Modules
---

# Titan Modules

Fourteen optional packages that cover the workhorse layer of every backend.
Each module:

- Ships as `@omnitron-dev/titan-<name>` on npm.
- Depends on `@omnitron-dev/titan` core; nothing else.
- Exposes a `Module.forRoot({...})` static for configuration.
- Is independently versioned — adopting one does not pin you to others.

## Catalogue

| Module                  | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| [auth](./auth.md)              | JWT authentication, claims-based authorisation                  |
| [cache](./cache.md)            | Multi-tier caching (LRU, LFU, TTL, Redis-backed)                |
| [database](./database.md)      | Kysely-based SQL with migrations, RLS, multi-dialect            |
| [discovery](./discovery.md)    | Redis-backed service discovery                                   |
| [events](./events.md)          | In-process event bus with decorators, validation, scheduling     |
| [health](./health.md)          | Health and readiness checks with extensible indicators           |
| [lock](./lock.md)              | Distributed locks over Redis                                     |
| [metrics](./metrics.md)        | Counters, gauges, histograms, time-series buffer                 |
| [notifications](./notifications.md) | Multi-channel delivery, Rotif messaging, dead-letter queue   |
| [pm](./pm.md)                  | Process manager with supervisors, pools, worker handles          |
| [ratelimit](./ratelimit.md)    | Rate limiting with Redis token buckets                           |
| [redis](./redis.md)            | Connection management, clustering, health checks                 |
| [scheduler](./scheduler.md)    | Cron, intervals, timeouts with persistence and metrics           |
| [telemetry-relay](./telemetry-relay.md) | Store-and-forward telemetry pipeline                    |

## Composition

Modules compose through the standard Titan `imports` chain:

```typescript
@Module({
  imports: [
    AuthModule.forRoot({ jwt: { secret: env.JWT_SECRET } }),
    CacheModule.forRoot({ tier: 'redis-lru', max: 10_000 }),
    DatabaseModule.forRoot({
      dialect: 'postgres',
      url:     env.DATABASE_URL,
    }),
    SchedulerModule,
    MetricsModule,
  ],
  providers: [/* your services */],
})
export class AppModule {}
```

Order does not matter; the container resolves the dependency graph.

## Choosing modules

Most backends start with a small set:

- **Web service**: `auth`, `database`, `cache`, `metrics`, `health`
- **Worker service**: `database`, `lock`, `scheduler`, `metrics`, `health`
- **Notification gateway**: `notifications`, `ratelimit`, `metrics`
- **Multi-instance app**: add `discovery` to the above
