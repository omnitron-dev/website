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

The same test code path runs unchanged on Node + Bun (via
Vitest) and Deno (via Deno's native `Deno.test`).

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

## Async helpers — `async/`

### `eventually(predicate, opts?)`

Poll until a condition is true (or timeout):

```typescript
import { eventually } from '@omnitron-dev/testing';

await eventually(() => queue.size === 0, {
  timeout:  5_000,
  interval: 50,
  message:  'queue did not drain',
});
```

Default timeout 5 s, default poll interval 50 ms. Throws with
the `message` if the deadline passes.

### `waitForEvent(emitter, event, opts?)`

```typescript
import { waitForEvent } from '@omnitron-dev/testing';

const [user] = await waitForEvent(bus, 'user.created', { timeout: 2_000 });
expect(user.email).toBe('a@b.c');
```

Resolves with the event args when fired; rejects on timeout.

### `flushPromises()`

```typescript
import { flushPromises } from '@omnitron-dev/testing';

doSomethingThatScheduledMicrotasks();
await flushPromises();             // microtask queue drained
expect(someState).toBe(...);
```

Useful between synchronous-trigger and async-effect when you
need everything queued to run.

### `withTimeout(promise, ms)`

```typescript
const result = await withTimeout(longRunning(), 3_000);
// → throws TimeoutError if longRunning takes >3s
```

## Error helpers — `errors.ts`

```typescript
import { expectThrows, expectThrowsAsync } from '@omnitron-dev/testing';

expectThrows(() => parse(bad), ValidationError, /invalid email/);
await expectThrowsAsync(() => service.do(), {
  type:    TitanError,
  code:    'NOT_FOUND',
  message: /user not found/,
});
```

More expressive than `try/catch + expect.fail` boilerplate.

## Titan-specific glue — `titan/`

### `createTestApp(options)`

```typescript
import { createTestApp } from '@omnitron-dev/testing/titan';
import { AppModule } from '../src/app.module.js';

describe('users service', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({
      modules:   [AppModule],
      overrides: [{ provide: MAILER_TOKEN, useClass: FakeMailer }],
      database:  'memory',            // or 'rollback' or { url: '...' }
      logger:    'null',              // or 'console' or your own
    });
  });

  afterEach(async () => {
    await app.dispose();              // cleans DB, stops the Application
  });

  it('invites a user', async () => {
    const users = await app.resolve(UsersService);
    await users.invite({ email: 'a@b.c' });
    // ...
  });
});
```

`createTestApp` wraps `Application.create` with sensible test
defaults:

- `disableGracefulShutdown: true`
- in-memory DB by default
- null logger by default
- transaction-rollback wrapper if `database: 'rollback'`

### `transactionRollback`

```typescript
import { transactionRollback } from '@omnitron-dev/testing/titan';

it('writes a user',
  transactionRollback(async (db) => {
    await db.insertInto('users').values({...}).execute();
    const u = await db.selectFrom('users').selectAll().executeTakeFirst();
    expect(u.email).toBe('a@b.c');
    // Rolled back automatically; next test sees clean DB.
  }),
);
```

Wraps the test body in `BEGIN ... ROLLBACK`. Faster than
truncate + reseed.

## Docker helpers — `docker/`

For integration tests that need real Postgres / Redis without
manual setup:

```typescript
import { startPostgres, startRedis, stopAll } from '@omnitron-dev/testing/docker';

beforeAll(async () => {
  await startPostgres({ port: 5433, database: 'test' });
  await startRedis({   port: 6380 });
});

afterAll(async () => {
  await stopAll();
});
```

Uses Docker behind the scenes; reuses long-lived containers
across test runs in dev. Skips on CI environments that already
provide services.

## Performance helpers — `performance/`

```typescript
import { measure, expectFasterThan, bench } from '@omnitron-dev/testing/performance';

it('parser is fast', async () => {
  const result = await measure(() => parse(LARGE_INPUT));
  expect(result.durationMs).toBeLessThan(50);
});

it('beats baseline', async () => {
  await expectFasterThan(() => myImpl(),  () => referenceImpl(), { runs: 100 });
});

// Standalone bench:
bench('parser variants', {
  v1: () => parseV1(input),
  v2: () => parseV2(input),
  v3: () => parseV3(input),
}, { runs: 1_000 });
```

Inline microbenchmarks alongside tests — not a replacement for
a real benchmark suite, but useful for regression catches.

## Env helpers — `env.ts`

```typescript
import { withEnv, mockProcessEnv } from '@omnitron-dev/testing';

withEnv({ NODE_ENV: 'test', DATABASE_URL: 'postgres://test' }, async () => {
  // process.env temporarily mutated; restored on return
});

const restore = mockProcessEnv({ JWT_SECRET: 'test' });
// ... test ...
restore();
```

Avoids leaking env changes across tests.

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
- [React component testing](./react.md) — `MockProvider` patterns
- [common — promise helpers](../utilities/common.md#promise-helpers) — building blocks `testing` builds on
