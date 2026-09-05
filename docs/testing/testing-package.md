---
sidebar_position: 2
title: '@omnitron-dev/testing'
description: Cross-runtime testing utilities — async helpers, runtime adapters, mock types.
---

# @omnitron-dev/testing

```bash
pnpm add -D @omnitron-dev/testing
```

Cross-runtime testing helpers. Same test source runs on
**Vitest** (Node + Bun) and **Deno test**. Provides typed mock
primitives, async helpers, runtime detection, and Titan-specific
test glue.

Verified against `packages/testing/src/`.

## What's inside

```text
packages/testing/src/
├── async/         # Promise + timer + event helpers for tests
├── docker/        # Helpers to spin up Postgres / Redis in tests
├── helpers/       # Generic test helpers
├── performance/   # Benchmarks & latency utilities
├── runtime/       # Runtime adapters (vitest / jest / bun / deno)
├── titan/         # Titan-specific test utilities (Application, DI overrides)
├── env.ts         # Test environment helpers
├── errors.ts      # Error-matching helpers
└── globals.d.ts   # Vitest / Jest globals (no import)
```

## Runtime detection

```typescript
import { RUNTIME, loadRuntimeAdapter } from '@omnitron-dev/testing';

RUNTIME;                        // 'node' | 'bun' | 'deno'

const adapter = await loadRuntimeAdapter();
adapter.test('my test', () => { /* ... */ });
adapter.expect(actual).toBe(expected);
```

The same test code path runs unchanged on Node + Bun (via Vitest) and
Deno (via Deno's native `Deno.test`) for `describe`, `it`, `test`,
`expect`, the four hooks and `fakeTimers` — a surface test in the
package fails if the three adapters drift apart.

**Mocking is the exception**: it is `vi` on Node and Bun, `mockFn` on
Deno. If your test mocks, that part is not portable as written.

## Typed mock function

```typescript
import type { MockFunction } from '@omnitron-dev/testing';

const fetchMock: MockFunction<typeof fetch> = vi.fn();

fetchMock.mockResolvedValue(new Response('hello'));
await someCode(fetchMock);

expect(fetchMock).toHaveBeenCalledWith('/api/foo');
expect(fetchMock.mock.calls).toHaveLength(1);
expect(fetchMock.mock.lastCall()).toEqual(['/api/foo']);
```

`MockFunction<T>` preserves `T`'s type so `mock.calls[0]` is the
inferred parameter tuple, not `any[]`.

## Async helpers — `@omnitron-dev/testing/async`

Also re-exported from the package root.

### `waitFor(condition, options?)` / `waitForCondition(condition, timeout?, interval?)`

Poll until a predicate is true, or throw at the deadline:

```typescript
import { waitFor } from '@omnitron-dev/testing';

await waitFor(() => queue.size === 0, {
  timeout: 5_000,
  interval: 50,
  message: 'queue did not drain',
});
```

Defaults: 5 s timeout, 50 ms interval, message `'Condition not met'`.
`waitForCondition(fn, timeout, interval)` is the same check with
positional arguments.

### `waitForEvents(target, events, timeout?)`

Wait for several events on an emitter at once, resolving with their
payloads in the order requested:

```typescript
import { waitForEvents } from '@omnitron-dev/testing';

const [created, indexed] = await waitForEvents(bus, ['user.created', 'user.indexed'], 2_000);
expect(created.email).toBe('a@b.c');
```

### `createEventSpy(target, event)` and `EventCollector`

`createEventSpy` records every payload for one event and hands back
`{ events, clear }`. `EventCollector` does the same for several events
and adds assertions:

```typescript
import { EventCollector, createEventSpy } from '@omnitron-dev/testing';

const spy = createEventSpy(bus, 'user.created');
await service.invite({ email: 'a@b.c' });
expect(spy.events).toHaveLength(1);

const collector = new EventCollector(bus);
collector.collect('user.created').collect('user.deleted');
// …
collector.assertEmitted('user.created', 1);
collector.assertNotEmitted('user.deleted');
collector.stop();
```

### `EventListenerTracker`

Registers listeners and removes all of them in one call — the usual
cause of a leaking test suite is a listener nobody detached:

```typescript
const tracker = new EventListenerTracker();
tracker.on(emitter, 'data', handler);
afterEach(() => tracker.cleanup());
```

### `flushPromises()`

```typescript
import { flushPromises } from '@omnitron-dev/testing';

doSomethingThatScheduledMicrotasks();
await flushPromises();             // microtask queue drained
expect(someState).toBe(/* … */);
```

### `withTimeout(promise, ms)` / `retry(fn, options?)` / `delay(ms)` / `nextTick()`

```typescript
const result = await withTimeout(longRunning(), 3_000);  // throws TimeoutError
const value = await retry(() => flakyCall(), { attempts: 3 });
```

### `createMockTimer()` / `MockTimerController`

Drive time forward deterministically instead of sleeping.

## Errors — `errors.ts`

The package exports its own error types, thrown by the helpers above:

```typescript
import { TestingError, TimeoutError, NotFoundError, RetryError } from '@omnitron-dev/testing';

await expect(withTimeout(hangs(), 100)).rejects.toBeInstanceOf(TimeoutError);
```

For asserting that a call rejects, use `assertRejects` from
`@omnitron-dev/testing/helpers`:

```typescript
import { assertRejects } from '@omnitron-dev/testing/helpers';

await assertRejects(service.load('missing'), /not found/);
await assertRejects(service.load('missing'), NotFoundError);
```

It accepts a string, a RegExp, or an error constructor.

## Generic helpers — `@omnitron-dev/testing/helpers`

```typescript
import { createTempDir, cleanupTempDir, suppressConsole, withFixture } from '@omnitron-dev/testing/helpers';

const dir = await createTempDir();
afterEach(() => cleanupTempDir(dir));

const restore = suppressConsole();   // silence console.* for one test
restore();

await withFixture(myFixture, async (instance) => { /* … */ });
```

## Titan-specific glue — `@omnitron-dev/testing/titan`

### `createTestModule(options)` / `testModule()`

Builds a container with your modules, providers and mocks, and can
create an `Application` from it:

```typescript
import { createTestModule } from '@omnitron-dev/testing/titan';
import { AppModule } from '../src/app.module.js';

describe('users service', () => {
  let mod: TestModule;

  beforeEach(() => {
    mod = createTestModule({
      modules: [AppModule],
      providers: [[MAILER_TOKEN, { useClass: FakeMailer }]],
      mocks: [{ token: CLOCK_TOKEN, mock: fixedClock, spy: true }],
      config: { name: 'test-app' },
    });
  });

  afterEach(async () => {
    await mod.cleanup();
  });

  it('invites a user', async () => {
    const users = mod.getContainer().resolve(UsersService);
    await users.invite({ email: 'a@b.c' });
  });
});
```

`resetMocks()`, `clearMocks()` and `restore()` manage mock state between
tests; `createApplication()` returns a started `Application` when the
test needs the full lifecycle.

`testModule()` is the same thing with a fluent builder:

```typescript
const mod = testModule()
  .withModule(AppModule)
  .withConfig({ name: 'test-app' })
  .withAutoMock()
  .build();
```

### `TestApplication`

A thinner wrapper when you want the Application itself:

```typescript
import { TestApplication } from '@omnitron-dev/testing/titan';

const app = new TestApplication({ name: 'test-app' });
await app.bootstrap(AppModule);

const users = app.get(UsersService);
await app.close();
```

### Fixtures

`TestSchemas`, `TestConfigs`, `TestRedisConfigs`, `TestModules`,
`TestData` and `TestTiming` are ready-made fixtures for the common
shapes — see `packages/testing/src/titan/test-fixtures.ts`.

## Docker helpers — `@omnitron-dev/testing/docker`

For integration tests that need a real Postgres or Redis. The API is
three manager classes with static factory methods, each returning a
`DockerContainer` you clean up yourself:

```typescript
import { RedisTestManager, DatabaseTestManager } from '@omnitron-dev/testing/docker';

let redis: DockerContainer;
let postgres: DockerContainer;

beforeAll(async () => {
  redis = await RedisTestManager.createRedisContainer({ port: 'auto' });
  postgres = await DatabaseTestManager.createPostgresContainer({ port: 'auto' });
}, 60_000);

afterAll(async () => {
  await redis.cleanup();
  await postgres.cleanup();
});
```

`port: 'auto'` asks the OS for a free port, which is what lets several
suites run in parallel; read the assigned port from
`container.ports.get(6379)`.

`RedisTestManager` also builds multi-node topologies —
`createRedisCluster()` and `createRedisSentinel()` — and
`DockerTestManager` is the lower-level driver the other two use.

## Performance helpers — `@omnitron-dev/testing/performance`

```typescript
import { PerfTimer, MemoryLeakDetector } from '@omnitron-dev/testing/performance';

const timer = new PerfTimer();
timer.mark('start');
await parse(LARGE_INPUT);
timer.mark('end');

expect(timer.measure('parse', 'start', 'end')).toBeLessThan(50);
// Repeated runs: timer.getAverage('parse'), timer.getPercentile('parse', 95)
```

A percentile over repeated runs is the useful shape here: a single
wall-clock measurement compared against a flat millisecond bound
measures the machine as much as the code.

## Env helpers — `@omnitron-dev/testing/env`

The shared endpoints for the test stack. Ports deliberately differ from
the defaults so a test run cannot reach a developer's own Redis or
Postgres:

```typescript
import {
  TEST_REDIS_URL,      // redis://localhost:16379
  TEST_POSTGRES_URL,   // postgresql://test:test@localhost:15432/test
  testRedisUrl,
  testPostgresUrl,
} from '@omnitron-dev/testing/env';

const url = testRedisUrl(5);            // …:16379/5
const dbUrl = testPostgresUrl('other'); // …:15432/other
```

Every value is overridable through the matching environment variable
(`TEST_REDIS_HOST`, `TEST_REDIS_PORT`, `TEST_POSTGRES_*`).

## Vitest configuration baseline

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment:   'node',
    setupFiles:    ['./test/setup.ts'],
    include:       ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage:      { reporter: ['text', 'html', 'lcov'] },
    pool:          'forks',          // crash isolation
    poolOptions: {
      forks: { singleFork: false },  // parallel
    },
    testTimeout:   10_000,
    hookTimeout:   30_000,
    globals:       false,             // explicit imports
  },
});
```

## Cross-runtime tests — Node + Bun + Deno

```typescript
// test/cross.test.ts (same file)
import { loadRuntimeAdapter } from '@omnitron-dev/testing';

const t = await loadRuntimeAdapter();

t.test('runs everywhere', () => {
  t.expect(1 + 1).toBe(2);
});
```

Run with:

```bash
vitest run test/cross.test.ts            # Node
bun test test/cross.test.ts              # Bun
deno test test/cross.test.ts             # Deno
```

Same source, three runtimes, identical assertions.

## Best practices

- **Use `createTestApp`** for any test that touches multiple
  modules — it does the lifecycle right.
- **Override at boundaries**, not in the middle. Override the
  mailer (external boundary), don't override an internal
  service.
- **`database: 'memory'`** for unit-y module tests;
  `'rollback'` when behaviour depends on real Postgres
  semantics (RLS, advisory locks, jsonb queries).
- **`waitForEvent`** for async assertions; avoid `setTimeout`.
- **Use `expectThrowsAsync`** instead of `try/catch + expect.fail` —
  more readable, captures more info.

## Anti-patterns

- **Sleeping for promises to resolve.** Use `flushPromises` or
  `eventually`.
- **Shared `Application` across tests** without proper reset.
  Mutated DI state leaks.
- **Real network in unit tests.** Use mocks; reserve real for
  integration / E2E.
- **Tests that depend on order.** Vitest parallelises; an
  order-dependent test is a future flake.

## See also

- [Testing overview](./index.md) — the pyramid + when to use what
- [Integration patterns](./integration.md) — `Application.create` recipes
- [Cross-runtime testing](./cross-runtime.md) — Node + Bun + Deno
- [React component testing](./react.md) — `TestNetronProvider` patterns
- [common — promise helpers](../utilities/common.md#promise-helpers) — building blocks `testing` builds on
