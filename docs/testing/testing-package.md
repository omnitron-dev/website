---
id: "testing/testing-package"
slug: "/docs/testing/testing-package"
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

## What's inside {#whats-inside}

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

## Runtime detection {#runtime-detection}

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

## Typed mock function {#typed-mock-function}

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

## Async helpers — `@omnitron-dev/testing/async` {#async-helpers--omnitron-devtestingasync}

Also re-exported from the package root.

### `waitFor(condition, options?)` / `waitForCondition(condition, timeout?, interval?)` {#waitforcondition-options--waitforconditioncondition-timeout-interval}

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

### `waitForEvents(target, events, timeout?)` {#waitforeventstarget-events-timeout}

Wait for several events on an emitter at once, resolving with their
payloads in the order requested:

```typescript
import { waitForEvents } from '@omnitron-dev/testing';

const [created, indexed] = await waitForEvents(bus, ['user.created', 'user.indexed'], 2_000);
expect(created.email).toBe('a@b.c');
```

### `createEventSpy(target, event)` and `EventCollector` {#createeventspytarget-event-and-eventcollector}

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

### `EventListenerTracker` {#eventlistenertracker}

Registers listeners and removes all of them in one call — the usual
cause of a leaking test suite is a listener nobody detached:

```typescript
const tracker = new EventListenerTracker();
tracker.on(emitter, 'data', handler);
afterEach(() => tracker.cleanup());
```

### `flushPromises()` {#flushpromises}

```typescript
import { flushPromises } from '@omnitron-dev/testing';

doSomethingThatScheduledMicrotasks();
await flushPromises();             // microtask queue drained
expect(someState).toBe(/* … */);
```

### `withTimeout(promise, ms)` / `retry(fn, options?)` / `delay(ms)` / `nextTick()` {#withtimeoutpromise-ms--retryfn-options--delayms--nexttick}

```typescript
const result = await withTimeout(longRunning(), 3_000);  // throws TimeoutError
const value = await retry(() => flakyCall(), { retries: 3, delay: 100, backoff: 2 });
```

`RetryOptions` is `{ retries?, delay?, backoff?, onRetry? }`. `retries`
defaults to 3, so a call that passes an unrecognised key still runs three
times and looks like it worked — this page previously documented
`{ attempts: 3 }`, which is not read at all.

`onRetry(error, attempt)` fires between attempts, which is the hook to use when
a flaky test needs to say WHY it retried rather than only that it passed.

### `createDeferred()` / `defer()` — a promise resolved from outside {#createdeferred--defer--a-promise-resolved-from-outside}

Two shapes of the same idea, and the difference is what you get back:

```typescript
const d = defer<string>();          // { promise, resolve, reject } — a plain object
emitter.once('ready', () => d.resolve('ok'));
await d.promise;

const p = createDeferred<string>(); // a DeferredPromise<T> instance
```

`defer()` returns a bare `Deferred<T>` — `{ promise, resolve, reject }`, no
class. `createDeferred()` returns a `DeferredPromise<T>`, which adds one thing:
the `isSettled` getter.

That is the whole difference, and it is worth stating plainly because the
obvious guess is wrong. A second `resolve` is ignored by BOTH — that is
ordinary Promise semantics, not something the class adds. What the class adds
is the ability to ASK whether the promise has settled without awaiting it,
which a test needs when it has to assert that something has NOT happened yet.

Use `defer()` unless you need that question answered.

Either is the right answer when a test must wait for something a callback
signals, and the wrong answer when a condition can simply be polled —
`waitFor` exists for that and does not leave a promise dangling if the event
never arrives.

### `collectEvents(target, event, condition, timeout?)` {#collecteventstarget-event-condition-timeout}

Gathers emissions of one event until `condition(events)` returns true, then
resolves with them. `waitForEvents` above waits for one of EACH named event;
this waits for as many of ONE as the condition asks for.

### `createMockTimer()` / `MockTimerController` {#createmocktimer--mocktimercontroller}

Drive time forward deterministically instead of sleeping.

## Errors — `errors.ts` {#errors--errorsts}

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

## Generic helpers — `@omnitron-dev/testing/helpers` {#generic-helpers--omnitron-devtestinghelpers}

```typescript
import { createTempDir, cleanupTempDir, suppressConsole, withFixture } from '@omnitron-dev/testing/helpers';

const dir = await createTempDir();
afterEach(() => cleanupTempDir(dir));

const restore = suppressConsole();   // silence console.* for one test
restore();

await withFixture(myFixture, async (instance) => { /* … */ });
```

## Titan-specific glue — `@omnitron-dev/testing/titan` {#titan-specific-glue--omnitron-devtestingtitan}

### `createTestModule(options)` / `testModule()` {#createtestmoduleoptions--testmodule}

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

### `TestApplication` {#testapplication}

A thinner wrapper when you want the Application itself:

```typescript
import { TestApplication } from '@omnitron-dev/testing/titan';

const app = new TestApplication({ name: 'test-app' });
await app.bootstrap(AppModule);

const users = app.get(UsersService);
await app.close();
```

### Fixtures {#fixtures}

`TestSchemas`, `TestConfigs`, `TestRedisConfigs`, `TestModules`,
`TestData` and `TestTiming` are ready-made fixtures for the common
shapes — see `packages/testing/src/titan/test-fixtures.ts`.

## Docker helpers — `@omnitron-dev/testing/docker` {#docker-helpers--omnitron-devtestingdocker}

Use the database and Redis helpers when an integration test needs a real service. Each factory returns a `DockerContainer` with its assigned ports and a `cleanup()` method.

```typescript
import { RedisTestManager, DatabaseTestManager, type DockerContainer } from '@omnitron-dev/testing/docker';

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

With `port: 'auto'`, read the assigned loopback port from `container.ports.get(6379)`. PostgreSQL and MySQL readiness probes use TCP so a temporary initialization socket cannot mark the database ready. A custom `waitFor` that specifies both `port` and `healthcheck` waits for both conditions.

Choose distinct names for parallel tests. A name collision fails before the helper can touch the existing container. Cleanup addresses the Docker ID that the manager created. You can attach tests to an existing network by name. The network stays with its owner.

In the Omnitron repository, `pnpm test:ci` starts a dedicated Compose project, runs the workspace suite, and removes that project's test resources. A failed startup, suite or teardown returns a nonzero exit status. When running two suites on the same host, assign different test ports as described in the root Compose file.

`RedisTestManager` also builds multi-node topologies —
`createRedisCluster()` and `createRedisSentinel()` — and
`DockerTestManager` is the lower-level driver the other two use.

For container commands, pass an array to preserve literal arguments, including
empty strings: `command: ['redis-server', '--save', '']`. A string deliberately
runs through `sh -c`; never interpolate untrusted values into that form. Docker
starts run asynchronously so one node cannot block another node's readiness
checks. If cluster creation fails, the helper waits for every attempted creation,
cleans all returned nodes, and removes its own network. Startup and cleanup
failures remain visible together.

## Performance helpers — `@omnitron-dev/testing/performance` {#performance-helpers--omnitron-devtestingperformance}

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

## Env helpers — `@omnitron-dev/testing/env` {#env-helpers--omnitron-devtestingenv}

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

Use the shared `TEST_POSTGRES_URL` in database tests instead of repeating a
fixed port. An explicit `TEST_POSTGRES_URL` takes precedence; the existing
`TEST_DATABASE_URL` CI variable remains accepted by the shared resolver.
`testPostgresUrl(name)` changes only the database name and preserves the selected
server, credentials, and query options. Omnitron's PostgreSQL integration probes
fail CI when that test service is unavailable. Local runs report the affected
suites as skipped and explain how to start the test infrastructure.

Workspace tests use Turbo's strict environment mode. The declared `TEST_*`,
`OMNITRON_TEST_*`, `OMNITRON_HOME` and `USE_MOCK_REDIS` settings reach test
processes and affect their cache keys. Docker connection settings and temporary
directories pass through explicitly. A custom test port therefore selects the
same endpoint in a direct package test and in the full workspace command.

## Vitest configuration baseline {#vitest-configuration-baseline}

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
    maxWorkers:    2,               // bounded concurrency
    testTimeout:   10_000,
    hookTimeout:   30_000,
    globals:       false,             // explicit imports
  },
});
```

When tests enable globals, declare `"types": ["node", "vitest/globals"]` in
their TypeScript configuration. Package resolution supports both hoisted and
isolated dependency layouts; an explicit `node_modules/vitest/globals.d.ts`
include assumes one layout. Omnitron shares these options through
`tsconfig.vitest.json`. Keep the test `tsBuildInfoFile` separate from the build
cache so incremental checks cannot reuse diagnostics from a different file set.

## Cross-runtime tests — Node + Bun + Deno {#cross-runtime-tests--node--bun--deno}

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

## Best practices {#best-practices}

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

## Anti-patterns {#anti-patterns}

- **Sleeping for promises to resolve.** Use `flushPromises` or
  `eventually`.
- **Shared `Application` across tests** without proper reset.
  Mutated DI state leaks.
- **Real network in unit tests.** Use mocks; reserve real for
  integration / E2E.
- **Tests that depend on order.** Vitest parallelises; an
  order-dependent test is a future flake.

## See also {#see-also}

- [Testing overview](./index.md) — the pyramid + when to use what
- [Integration patterns](./integration.md) — `Application.create` recipes
- [Cross-runtime testing](./cross-runtime.md) — Node + Bun + Deno
- [React component testing](./react.md) — `TestNetronProvider` patterns
- [common — promise helpers](../utilities/common.md#promise-helpers) — building blocks `testing` builds on
