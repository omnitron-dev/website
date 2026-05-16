---
sidebar_position: 2
title: API service stack
description: Public HTTP/WS API — auth, database, cache, rate limiting, health, metrics.
---

# API service stack

The canonical shape for a public API that handles user traffic:
authenticated requests, database reads/writes, cache in front,
rate limiting per user, health probes for Kubernetes, metrics for
dashboards.

## Shape

- **Authenticated.** JWT tokens (or service-key for trusted
  callers) verified on every request.
- **Database-backed.** Postgres + Kysely, soft-delete + timestamps
  plugins on, RLS for tenant isolation.
- **Cache in front.** L1 in-memory per pod, L2 in Redis shared
  across pods.
- **Rate-limited.** Per-user sliding window in Redis, tiered plans.
- **Health-probed.** `/healthz` for liveness, `/readyz` for
  readiness, both Kubernetes-friendly.
- **Metrics.** Counters / histograms for every RPC method,
  exported in Prometheus format.

## Architecture

```mermaid
flowchart LR
  Client[Browser / mobile]
  Client -->|HTTPS + JWT| Edge[Netron HTTP transport]
  Edge --> Auth[titan-auth<br/>JWTService]
  Auth --> Rate[titan-ratelimit<br/>per-user]
  Rate --> Service[Your @Service classes]
  Service --> Cache[titan-cache<br/>L1 → L2]
  Cache -.L2.-> Redis[(Redis)]
  Service --> DB[titan-database<br/>Kysely + RLS]
  DB --> PG[(PostgreSQL)]
  Service --> Metrics[titan-metrics]
  Health[titan-health] -.indicators.-> DB
  Health -.indicators.-> Redis
  Probe[Kubernetes probes] --> Health
  Metrics --> Prom[/metrics endpoint]
```

## `AppModule`

```typescript
import { Module } from '@omnitron-dev/titan';
import { z } from '@omnitron-dev/titan/validation';
import { ConfigModule } from '@omnitron-dev/titan/module/config';
import { LoggerModule, ConsoleTransport, RedactionProcessor }
  from '@omnitron-dev/titan/module/logger';

import { TitanRedisModule } from '@omnitron-dev/titan-redis';
import { TitanAuthModule } from '@omnitron-dev/titan-auth';
import { TitanDatabaseModule } from '@omnitron-dev/titan-database';
import { TitanCacheModule } from '@omnitron-dev/titan-cache';
import { TitanRateLimitModule } from '@omnitron-dev/titan-ratelimit';
import { TitanHealthModule } from '@omnitron-dev/titan-health';
import { TitanMetricsModule } from '@omnitron-dev/titan-metrics';

const AppConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']),
  redis: z.object({ url: z.string().url() }),
  database: z.object({ url: z.string().url() }),
  auth: z.object({
    jwtSecret: z.string(),
    issuer: z.string(),
    audience: z.string(),
  }),
  rateLimit: z.object({
    defaultLimit: z.number().int(),
    defaultWindowMs: z.number().int(),
  }),
});

@Module({
  imports: [
    // ── Configuration + logging (auto-loaded; shown for completeness) ──
    ConfigModule.forRoot({
      schema:  AppConfigSchema,
      sources: [
        { type: 'file', path: 'config/default.yaml' },
        { type: 'file', path: 'config/${NODE_ENV}.yaml', optional: true },
        { type: 'env',  prefix: 'APP_' },
      ],
      validateOnStartup: true,
      watchForChanges:   process.env.NODE_ENV !== 'production',
    }),

    LoggerModule.forRoot({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transports: [new ConsoleTransport({ pretty: process.env.NODE_ENV !== 'production' })],
      processors: [
        new RedactionProcessor({
          paths: ['password', 'token', 'headers.authorization', 'creditCard.*'],
        }),
      ],
    }),

    // ── Foundation ─────────────────────────────────────────────────────
    TitanRedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        clients: [
          { namespace: 'default', url: config.get('redis.url'), db: 0 },
          { namespace: 'cache',   url: config.get('redis.url'), db: 1 },
          { namespace: 'rl',      url: config.get('redis.url'), db: 4 },
        ],
      }),
      inject: [ConfigService],
    }),

    // ── Database ───────────────────────────────────────────────────────
    TitanDatabaseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          dialect:        'postgres',
          connection:     config.get('database.url'),
          pool:           { min: 2, max: 20 },
          migrationsPath: './migrations',
          coerceBigint:   true,
        },
        plugins: {
          softDelete: true,
          timestamps: true,
          audit:      true,
          rls:        true,
        },
      }),
      inject: [ConfigService],
    }),

    // ── Cache (L1 in-memory + L2 Redis) ────────────────────────────────
    TitanCacheModule.forRootAsync({
      useFactory: (redis: RedisService) => ({
        multiTier: true,
        l1: { maxSize: 5_000,  ttl: 60 },             // hot — 1 min
        l2: { client: redis.getClient('cache'), ttl: 3_600, prefix: 'cache:' },
        evictionPolicy: 'lru',
      }),
      inject: [RedisService],
    }),

    // ── Auth ───────────────────────────────────────────────────────────
    TitanAuthModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        algorithm:    'HS256',
        jwtSecret:    config.get('auth.jwtSecret'),
        issuer:       config.get('auth.issuer'),
        audience:     config.get('auth.audience'),
        cacheEnabled: true,
        cacheMaxSize: 5_000,
        cacheTTL:     300_000,                         // 5 min
      }),
      inject: [ConfigService],
    }),

    // ── Rate limiting ──────────────────────────────────────────────────
    TitanRateLimitModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        enabled:         true,
        strategy:        'sliding-window',
        storageType:     'redis',                      // shared across pods
        defaultLimit:    config.get('rateLimit.defaultLimit'),
        defaultWindowMs: config.get('rateLimit.defaultWindowMs'),
        keyPrefix:       'rl',
        tiers: {
          free:       { limit: 60,    windowMs: 60_000 },
          pro:        { limit: 1_000, windowMs: 60_000 },
          enterprise: { limit: 10_000, windowMs: 60_000 },
        },
      }),
      inject: [ConfigService],
    }),

    // ── Health probes ──────────────────────────────────────────────────
    TitanHealthModule.forRootAsync({
      useFactory: (db: DatabaseManager, redis: RedisService) => ({
        enableMemoryIndicator:    true,
        enableEventLoopIndicator: true,
        enableDatabaseIndicator:  true,
        databaseConnection:       db.getConnection(),
        enableRedisIndicator:     true,
        redisClient:              redis.getClient('default'),
        memoryThresholds:         { heapDegradedThreshold: 0.8, heapUnhealthyThreshold: 0.95 },
        eventLoopThresholds:      { degradedThreshold: 50, unhealthyThreshold: 200 },
        timeout:                  3_000,
        enableCaching:            true,
        cacheTtl:                 1_000,
        enableRpcService:         true,                 // expose via Netron
        version:                  process.env.APP_VERSION,
      }),
      inject: [DATABASE_MANAGER, RedisService],
    }),

    // ── Metrics ────────────────────────────────────────────────────────
    TitanMetricsModule.forRoot({
      appName:    'my-api',
      collection: {
        enabled:  true,
        interval: 10_000,
        process:  true,
        system:   true,
        rpc:      true,                                 // auto-collect Netron call metrics
      },
      storage: { type: 'memory', batchSize: 500, flushInterval: 10_000 },
      retention: { maxAge: '7d', cleanupInterval: 3_600_000 },
    }),

    // ── Your feature modules ───────────────────────────────────────────
    UsersModule,
    OrdersModule,
    BillingModule,
  ],
})
export class AppModule {}
```

## A typical `@Service`

```typescript
import { Service, Public } from '@omnitron-dev/titan';
import { Cacheable, CacheInvalidate } from '@omnitron-dev/titan-cache';
import { RequireAuth } from '@omnitron-dev/titan-auth';
import { RateLimit }   from '@omnitron-dev/titan-ratelimit';
import { Metrics }     from '@omnitron-dev/titan-metrics';

@Service('users@1.0.0')
class UsersService {
  constructor(
    @InjectRepository(UsersRepository) private readonly repo: UsersRepository,
  ) {}

  @Public()
  @RequireAuth({ allowAnonymous: false })
  @RateLimit('users:read', { limit: 100, windowMs: 60_000 })
  @Cacheable({ cacheName: 'users', keyPrefix: 'u', ttl: 60, tags: (id) => [`user:${id}`] })
  @Metrics({ counter: { name: 'users.findById.total' }, histogram: { name: 'users.findById.ms' } })
  async findById(id: string) {
    return this.repo.find(id);
  }

  @Public()
  @RequireAuth({ roles: ['admin'] })
  @CacheInvalidate({ cacheName: 'users', tags: (input) => [`user:${input.id}`] })
  async update(input: { id: string; patch: Partial<User> }) {
    return this.repo.update(input.id, input.patch);
  }
}
```

## Cross-module wiring notes

| Concern               | Wiring detail                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Redis namespaces      | `default` (general), `cache` (L2), `rl` (rate limits) — isolate per DB index to prevent collisions |
| Cache L2 client       | `TitanCacheModule.forRootAsync` injects `RedisService` and gets the `cache` namespace explicitly |
| Health → database     | Use `db.getConnection()` (a `Kysely` instance) directly — `DatabaseHealthIndicator` accepts it  |
| Health → redis        | Pass `redis.getClient('default')` — uses `.ping()` for liveness                                  |
| Auth cache vs JWT TTL | `cacheTTL: 300_000` < typical JWT expiry; revoked tokens stay valid until cache expires. Lower for high-churn revocation. |
| Rate limit key shape  | The decorator's first arg is a static prefix; combined automatically with the user identity from the auth context |
| Metrics + Netron      | `collection.rpc: true` auto-instruments every `@Public` method — no per-method `@Metrics` needed unless you want custom histograms |

## Production checklist

- [ ] `validateOnStartup: true` on ConfigModule — misconfig fails at boot
- [ ] `watchForChanges: false` in production — hot-reload is dev-only
- [ ] `LoggerModule.processors` includes `RedactionProcessor` with **every** sensitive path
- [ ] `auth.cacheTTL` ≤ acceptable revocation window
- [ ] Database `pool.max` ≤ Postgres `max_connections` ÷ pod count
- [ ] Rate limit `storageType: 'redis'` (not `'memory'`) for multi-pod
- [ ] Kubernetes probes wired:
      ```yaml
      livenessProbe:  { httpGet: { path: /healthz, port: 3000 } }
      readinessProbe: { httpGet: { path: /readyz,  port: 3000 } }
      ```
- [ ] `/metrics` endpoint exposed and scraped by Prometheus
- [ ] Logs shipping off-host (sidecar / fluentbit / stdout to log aggregator)
- [ ] Database migrations run as a separate step (not at app boot in production)

## See also

- [Worker fleet](./worker-fleet.md) — when the workload is async
  jobs, not request handlers
- [Observability stack](./observability-stack.md) — beyond metrics:
  traces + telemetry-relay for cross-pod shipping
- [Multi-tenant SaaS](./multi-tenant-saas.md) — extends this stack
  with RLS-driven tenant isolation
