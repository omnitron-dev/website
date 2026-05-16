---
sidebar_position: 4
title: Testing modules
description: How to mock each ecosystem module in unit and integration tests.
---

# Testing modules

The framework-level pages cover the test pyramid ([Overview](./overview.md))
and DI-driven mocking ([DI Overrides](./di-overrides.md)). This page
goes per-module: the smallest mock that lets your code under test
run without the real backend.

The rule of thumb stays the same: unit tests instantiate the class
with mock dependencies; integration tests boot a real `Application`
with the heavy infrastructure overridden via `overrides:`.

## Built-in modules

### ConfigModule

Most tests just want config values. Skip the real loader; provide
the values directly:

```typescript
import { ConfigService } from '@omnitron-dev/titan/module/config';

const mockConfig = {
  get: <T>(path: string, defaultValue?: T): T => {
    const map: Record<string, unknown> = {
      'database.url':  'postgres://test',
      'cache.ttlMs':   60_000,
    };
    return (map[path] ?? defaultValue) as T;
  },
  has:     () => true,
  watch:   () => () => {},
} as unknown as ConfigService;
```

For integration tests with a real `ConfigModule`, use the
`'object'` source:

```typescript
ConfigModule.forRoot({
  sources: [{ type: 'object', data: { database: { url: 'postgres://test' } } }],
})
```

### LoggerModule

The framework ships `createNullLogger()` for this exact case:

```typescript
import { createNullLogger } from '@omnitron-dev/titan/module/logger';

const logger = createNullLogger();   // discards everything
```

For tests that assert on log calls, use a spying logger:

```typescript
import { vi } from 'vitest';

const logger = {
  debug: vi.fn(),
  info:  vi.fn(),
  warn:  vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => logger),
} as any;

// Later:
expect(logger.info).toHaveBeenCalledWith('findById', expect.objectContaining({ id: 'u_42' }));
```

## Official modules

### titan-auth

Mock `JWTService` to bypass real signing:

```typescript
import type { IJWTService, IAuthContext } from '@omnitron-dev/titan-auth';

const fakeJwt: IJWTService = {
  verify:         vi.fn(async () => ({ sub: 'u_42', roles: ['user'] })),
  createContext:  vi.fn(async () => ({ userId: 'u_42', roles: ['user'] } as IAuthContext)),
  clearCache:     vi.fn(),
  getCacheStats:  () => ({ size: 0, maxSize: 1000, hits: 0, misses: 0, hitRate: 0 }),
} as any;
```

For `@RequireAuth` decorator tests, supply a mock middleware:

```typescript
const fakeAuthMiddleware = {
  authenticate:         vi.fn(async () => fakeAuthContext),
  authenticateRequired: vi.fn(async () => fakeAuthContext),
  extractToken:         vi.fn(() => 'fake-token'),
  validateApiKey:       vi.fn(() => ({ valid: true, type: 'service' })),
};

const service = new MyService();
(service as any).__authMiddleware__ = fakeAuthMiddleware;
```

### titan-cache

For services that depend on a cache, a `Map`-backed fake covers
most cases:

```typescript
class FakeCache<T> {
  private readonly store = new Map<string, T>();

  async get(key: string) { return this.store.get(key); }
  async set(key: string, value: T) { this.store.set(key, value); }
  async delete(key: string) { return this.store.delete(key); }
  async clear() { this.store.clear(); }
  async has(key: string) { return this.store.has(key); }
  async getOrSet(key: string, factory: () => Promise<T>) {
    if (!this.store.has(key)) this.store.set(key, await factory());
    return this.store.get(key)!;
  }
  async invalidateByTags() { /* ignore */ return 0; }
  // …minimal surface for your tests
}
```

For testing decorator-driven caching (`@Cacheable`), an integration
test with an in-memory cache is cleaner than mocking:

```typescript
const app = await Application.create({
  modules: [TitanCacheModule.forRoot({ maxSize: 100, defaultTtl: 60 })],
  providers: [/* your service */],
});
```

### titan-redis

For unit tests, stub the small surface your code uses:

```typescript
const fakeRedis = {
  get:     vi.fn(async () => null),
  set:     vi.fn(async () => 'OK'),
  del:     vi.fn(async () => 1),
  exists:  vi.fn(async () => 0),
  expire:  vi.fn(async () => 1),
  ttl:     vi.fn(async () => -2),
  ping:    vi.fn(async () => 'PONG'),
  // hash / set / list / sorted-set methods as your code needs
};
```

For integration tests that exercise Redis semantics (Lua,
clustering), use `ioredis-mock` or spin up Redis in Docker via
`pnpm test:up`.

### titan-lock

The most common pattern: stub `withLock` to either run the callback
or skip it.

```typescript
import type { IDistributedLockService } from '@omnitron-dev/titan-lock';

// "Lock always available" — runs the callback unconditionally
const fakeLockUnlocked: Partial<IDistributedLockService> = {
  withLock: async (key, fn) => fn(),
  acquireLock: async () => 'fake-lock-id',
  releaseLock: async () => true,
  isLocked:    async () => false,
};

// "Lock always held" — skips the callback
const fakeLockHeld: Partial<IDistributedLockService> = {
  withLock: async (_key, _fn, opts) => {
    if (opts?.skipOnLockFailure) return undefined;
    throw new Error('LockUnavailable');
  },
  acquireLock: async () => null,
  isLocked:    async () => true,
};
```

For `@WithDistributedLock` decorator tests, inject the mock under
`__lockService__`:

```typescript
const service = new MyScheduledTasks();
(service as any).__lockService__ = fakeLockUnlocked;
(service as any).loggerModule   = { getLogger: () => fakeLogger };
await service.myJob();   // runs the body
```

### titan-database

Tests should hit a **real** database — even a transient SQLite —
because most bugs live in the SQL, not the surrounding code.

```typescript
TitanDatabaseModule.forRoot({
  connection: {
    dialect:    'sqlite',
    connection: ':memory:',
    migrationsPath: './migrations',
  },
})
```

Run migrations in `beforeAll`; reset between tests via a fresh DB
file or `TRUNCATE`-style cleanup.

For unit-testing a service that depends on a repository, mock the
repository directly:

```typescript
const fakeRepo = {
  find:    vi.fn(async () => ({ id: 'u_42', email: 'ada@example.com' })),
  create:  vi.fn(async (data) => ({ id: 'new-id', ...data })),
  update:  vi.fn(async (id, patch) => ({ id, ...patch })),
  delete:  vi.fn(async () => true),
} as unknown as UsersRepository;

const service = new UsersService(fakeRepo);
```

### titan-events

`EventsService` works fine in tests with a fresh in-process
instance — no mock needed:

```typescript
import { EventsModule } from '@omnitron-dev/titan-events';

const app = await Application.create({
  modules: [EventsModule.forRoot({ wildcard: true, history: { enabled: false } })],
  providers: [MyEmitter, MyHandler],
});

await app.start();

// Trigger emission
await app.resolve(MyEmitter).doSomething();

// Assert handler ran
await new Promise(r => setImmediate(r));   // let async handlers flush
expect(spy).toHaveBeenCalled();
```

Use `events.waitFor(name, timeout)` for deterministic assertions:

```typescript
const promise = events.waitFor('user.created', 1000);
await service.create({ /* … */ });
const payload = await promise;
expect(payload.id).toBeDefined();
```

### titan-health

Register a mock indicator that returns a controllable status:

```typescript
class FakeHealthIndicator implements IHealthIndicator {
  name = 'fake';
  constructor(public status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy') {}
  async check() { return { status: this.status }; }
}

const fake = new FakeHealthIndicator();
TitanHealthModule.forRoot({
  enableMemoryIndicator: false,
  indicators: [class extends FakeHealthIndicator {}],   // or register at runtime
});

// In test:
fake.status = 'unhealthy';
expect(await healthService.isReady()).toBe(false);
```

### titan-metrics

For tests, a no-op metrics service is usually sufficient:

```typescript
const fakeMetrics = {
  record:      vi.fn(),
  recordBatch: vi.fn(),
  recordTyped: vi.fn(),
  getSnapshot: async () => ({ metrics: [] }),
  start:       vi.fn(),
  stop:        vi.fn(),
};
```

For tests that assert metric calls:

```typescript
expect(fakeMetrics.recordTyped).toHaveBeenCalledWith(
  'counter', 'users.created.total', { source: 'web' }, 1,
);
```

### titan-notifications

Use the mock channels the module already exports:

```typescript
import { MockEmailChannel, MockSMSChannel, MockPushChannel }
  from '@omnitron-dev/titan-notifications';

NotificationsModule.forRoot({
  channels: [new MockEmailChannel(), new MockSMSChannel(), new MockPushChannel()],
  enableInApp: false,
})
```

Mock channels record every delivery so you can assert in tests:

```typescript
const emailMock = new MockEmailChannel();
await notify.send({ userId, email }, { template: 'welcome', data: { name } });
expect(emailMock.deliveries).toHaveLength(1);
expect(emailMock.deliveries[0].to).toBe('ada@example.com');
```

### titan-pm

Set `testing.useMockSpawner: true` to swap the real spawner for a
mock that runs worker classes in the same process:

```typescript
ProcessManagerModule.forRoot({
  isolation: 'worker',
  testing:   { useMockSpawner: true },
})
```

The mock spawner runs `@Process`-decorated classes in-process so
tests don't pay the worker-thread cost.

### titan-ratelimit

Stub `consume` / `enforce` for unit tests:

```typescript
const fakeRate = {
  consume: vi.fn(async () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
  enforce: vi.fn(),
  getStatus: vi.fn(async () => ({ allowed: true, remaining: 99, resetAt: 0 })),
  reset:   vi.fn(),
};
```

For integration tests with real limiting, use `storageType: 'memory'`
and the small-window option to avoid waiting:

```typescript
TitanRateLimitModule.forRoot({
  storageType:     'memory',
  defaultLimit:    2,
  defaultWindowMs: 100,
})

// Test:
await rate.consume('key');
await rate.consume('key');
const r = await rate.consume('key');
expect(r.allowed).toBe(false);
```

### titan-discovery

Stub the service for unit tests:

```typescript
const fakeDiscovery = {
  registerNode:        vi.fn(async () => {}),
  deregisterNode:      vi.fn(async () => {}),
  getActiveNodes:      vi.fn(async () => [{ nodeId: 'test-node', address: 'http://localhost' }]),
  findNodesByService:  vi.fn(async () => []),
  isNodeActive:        vi.fn(async () => true),
};
```

For integration tests, point at a transient Redis (Docker compose
or `ioredis-mock`).

### titan-scheduler

The scheduler accepts a `disabled: true` per-job option to register
without auto-starting:

```typescript
@Cron(CronExpression.EVERY_HOUR, { disabled: true })
async myJob() { /* … */ }
```

In tests, manually invoke the registered job:

```typescript
const job = scheduler.getJob('TaskService.myJob');
await job!.handler();   // invoke without waiting for cron
```

Or invoke the underlying method directly — the decorator doesn't
prevent direct calls.

### titan-telemetry-relay

Use the `'aggregator'` mode with an in-memory `TelemetryAggregator`
for assertions:

```typescript
class InMemoryAggregator implements TelemetryAggregator {
  entries: TelemetryEntry[] = [];
  async write(entries: TelemetryEntry[]) { this.entries.push(...entries); }
  async query() { return this.entries; }
}

const agg = new InMemoryAggregator();
const relay = new TelemetryRelayService({ role: 'aggregator' });
relay.setAggregator(agg);
await relay.start();

// Producer side:
await relay.receive('test-node', [
  { id: '1', timestamp: Date.now(), type: 'log', app: 'test', data: { msg: 'hello' } },
]);

expect(agg.entries).toHaveLength(1);
```

## Generic patterns

### One mock per test, not shared

A `FakeCache` shared across tests will see each other's data. Use
`beforeEach` to give each test a fresh fake.

### `disableGracefulShutdown: true`

Integration tests boot many `Application` instances. Without this
flag, every test installs SIGTERM handlers — they stomp on each
other.

```typescript
const app = await Application.create({
  modules: [/* … */],
  disableGracefulShutdown: true,
});
```

### Cross-runtime testing

`@omnitron-dev/testing` covers cross-runtime concerns (Node / Bun /
Deno). If your module needs to ship to all three, run the same test
file against each runtime via the package's harness.

## Anti-patterns

- **Mocking everything.** A test where every dep is mocked tests
  the test, not the code. Mock the slow / external / unreliable;
  use real instances for the rest.
- **Shared fake state across tests.** Use `beforeEach` to reset.
- **Real Redis / Postgres per unit test.** Spin once per test
  suite (`beforeAll`); reset between tests.
- **Testing the framework.** "Does `@Inject` work?" is the
  framework's job. Test your code's behaviour through it.

## See also

- [Testing / Overview](./overview.md) — the test pyramid
- [Testing / DI Overrides](./di-overrides.md) — replacing providers
- [Testing / Integration](./integration.md) — real `Application`
  with selective fakes
