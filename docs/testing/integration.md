---
sidebar_position: 3
title: Integration patterns
description: Real Application, fake boundaries — the recipes that scale.
---

# Integration patterns

The integration layer is where ~70% of bugs hide. Modules wire
together with real DI, but external services (DB, mailer,
payment provider, S3) are faked. This is the layer with the
highest signal-to-noise.

## The base pattern

```typescript
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { createTestApp, type TestApp } from '@omnitron-dev/testing/titan';
import { AppModule } from '../src/app.module.js';

describe('user invite flow', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({
      modules:   [AppModule],
      database:  'rollback',                          // real Postgres, isolated
      logger:    'null',
      overrides: [
        { provide: MAILER_TOKEN,         useClass: FakeMailer },
        { provide: PAYMENT_PROVIDER,     useClass: FakeProvider },
      ],
    });
  });

  afterEach(async () => {
    await app.dispose();
  });

  it('happy path', async () => {
    const users  = await app.resolve(UsersService);
    const mailer = await app.resolve(MAILER_TOKEN) as FakeMailer;

    await users.invite({ email: 'a@b.c' });

    expect(mailer.sent).toMatchObject([{ to: 'a@b.c', template: 'invite' }]);
  });
});
```

Pieces:

- **`createTestApp`** boots a real `Application` with test-friendly
  defaults (no graceful shutdown, no signal handlers).
- **`database: 'rollback'`** wraps every test in `BEGIN ... ROLLBACK`
  — fast + isolated.
- **`overrides`** swaps external-boundary services for fakes.
- **`app.resolve(...)`** pulls anything from the DI container,
  including the fakes (to inspect what was called).

## Fake patterns

### Fake mailer

```typescript
class FakeMailer implements IMailer {
  public sent: SentMessage[] = [];

  async send(msg: SentMessage) {
    this.sent.push(msg);
  }
}
```

Just records calls. Assert on `sent` after the action.

### Fake clock

```typescript
import { vi } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(()  => vi.useRealTimers());

it('respects backoff', async () => {
  const promise = withRetry(() => failOnce());
  await vi.advanceTimersByTimeAsync(500);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await promise).toBe('success');
});
```

Use fake timers for **anything time-dependent** — backoff,
TTL, cron, debounce. Real clocks make tests slow and flaky.

### Stubbed external HTTP

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('https://api.partner.example/v1/users/:id', () =>
    HttpResponse.json({ id: 'remote-1', email: 'partner@x.com' })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(()  => server.close());
```

[`msw`](https://mswjs.io/) intercepts at the network layer
without changing app code.

## Transaction-rollback in detail

```typescript
app = await createTestApp({
  database: 'rollback',                  // implies wrapping
  modules:  [AppModule],
});
```

Behind the scenes:

```typescript
// Pseudo:
beforeEach: await db.exec('BEGIN');
afterEach:  await db.exec('ROLLBACK');
```

- Every test starts with a clean DB state.
- No `TRUNCATE` between tests — orders of magnitude faster.
- Test isolation is real (the transaction sees only the seed
  data, then its own writes).

**Caveat**: tests that span multiple connections won't see each
other's writes (different transactions). Move those to E2E.

## Lifecycle test

```typescript
it('runs onStart hooks in dependency order', async () => {
  const calls: string[] = [];

  class AModule implements OnStart {
    async onStart() { calls.push('A'); }
  }
  class BModule implements OnStart {
    async onStart() { calls.push('B'); }
  }

  const app = await createTestApp({
    modules: [
      { provide: 'A', useClass: AModule },
      { provide: 'B', useClass: BModule, dependencies: ['A'] },
    ],
  });
  await app.start();

  expect(calls).toEqual(['A', 'B']);
  await app.dispose();
});
```

Asserts lifecycle ordering, hook firing, error propagation.

## Database integration

### In-memory SQLite

```typescript
app = await createTestApp({
  database: 'memory',                    // sqlite :memory:
  modules:  [AppModule],
});
```

Use when:
- Tests are read-heavy and Postgres-specific features aren't
  exercised.
- Speed > realism.

### Real Postgres with rollback

```typescript
app = await createTestApp({
  database: 'rollback',
  modules:  [AppModule],
});
```

Use when:
- RLS / triggers / advisory locks / jsonb queries matter.
- The schema is Postgres-specific.

### Docker-managed test DB

```typescript
import { startPostgres, stopAll } from '@omnitron-dev/testing/docker';

beforeAll(async () => {
  await startPostgres({ port: 5433, database: 'integration_test' });
});
afterAll(async () => {
  await stopAll();
});

beforeEach(async () => {
  app = await createTestApp({
    database: { url: 'postgres://localhost:5433/integration_test', rollback: true },
    modules:  [AppModule],
  });
});
```

For tests that need a fresh Postgres instance — `startPostgres`
boots a Docker container if one isn't running.

## Netron integration tests

```typescript
import { createTestApp } from '@omnitron-dev/testing/titan';
import { NetronClient }  from '@omnitron-dev/netron-browser';

describe('end-to-end users service', () => {
  let app:    TestApp;
  let client: NetronClient;

  beforeEach(async () => {
    app = await createTestApp({
      modules:  [AppModule],
      netron:   { http: { port: 0 } },           // 0 = pick free port
      database: 'rollback',
    });
    await app.start();

    const port = app.netron.getPort('http');
    client = new NetronClient({ url: `http://localhost:${port}` });
    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect();
    await app.dispose();
  });

  it('returns a user over the wire', async () => {
    const users = await client.service<UsersService>('users');
    const u     = await users.findById('u_42');
    expect(u.email).toBe('a@b.c');
  });
});
```

This is the highest-value integration test — actual wire format,
actual serialisation, actual auth, actual middleware. Catches a
huge class of bugs that mocked-RPC tests miss.

## Event-driven assertions

```typescript
import { waitForEvent } from '@omnitron-dev/testing';

it('fires user.created after invite', async () => {
  const bus    = await app.resolve(EVENT_BUS_TOKEN);
  const users  = await app.resolve(UsersService);

  const eventPromise = waitForEvent(bus, 'user.created', { timeout: 2_000 });
  await users.invite({ email: 'a@b.c' });

  const [user] = await eventPromise;
  expect(user.email).toBe('a@b.c');
});
```

`waitForEvent` returns a promise that resolves with the event
args. Set up the wait **before** triggering the action — race-free.

## Custom routes

Custom routes alongside RPC need their own tests:

```typescript
it('serves images via /render/image/*', async () => {
  await app.start();
  const port = app.netron.getPort('http');

  const r = await fetch(`http://localhost:${port}/render/image/bucket-1/photo.jpg?width=200`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toBe('image/webp');
});
```

Hit the route with a plain `fetch`; assert on status, headers,
body.

## Speed budget

For an integration suite to stay fast:

| Tier | Budget per test |
| ---- | --------------- |
| Bare module | <50 ms |
| With in-memory DB | <100 ms |
| With Postgres rollback | <200 ms |
| With real HTTP roundtrip | <500 ms |
| With Docker bootstrap | excluded from common suite |

If you blow past those, you're probably testing too much in
one — split the test or push to E2E.

## CI considerations

- **Parallelism**: Vitest forks per-file. Tests within a file
  share a process; tests across files don't. Keep file-level
  state minimal.
- **DB connections**: limit pool size in test config; many
  parallel workers + large pool = connection exhaustion.
- **Container reuse**: in CI, prefer reusing Docker containers
  across runs (mark with a known name + don't auto-stop).
- **Snapshot updates**: gate behind explicit `pnpm test --update`
  — never auto-update in CI.

## Best practices

- **One test, one behaviour.** A failing test should point at a
  single change.
- **Real DI in integration**, not stubs. Stubs of DI mask wiring
  bugs.
- **Real Application** lifecycle, not mocked hooks.
- **Override at boundaries**: mailer, payment provider, third-
  party APIs. Don't override internal services.
- **Fake the clock**, never sleep.

## Anti-patterns

- **Asserting on log output.** Logs change; assert on observable
  state.
- **Asserting on private state.** Use public APIs to introspect.
- **Coupling test order.** Each test must work standalone.
- **Sharing app across tests** without proper reset. State leaks
  across tests are insidious.
- **Snapshot tests for non-deterministic output.** Timestamps,
  IDs, hashes — exclude or sanitise.

## See also

- [Testing overview](./index.md)
- [Testing package](./testing-package.md) — `createTestApp` API
- [React component testing](./react.md)
- [Cross-runtime testing](./cross-runtime.md)
- [Titan / Testing / DI overrides](../titan/testing/di-overrides.md)
