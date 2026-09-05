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
import { createTestModule, type TestModule } from '@omnitron-dev/testing/titan';
import { AppModule } from '../src/app.module.js';

describe('user invite flow', () => {
  let mod: TestModule;

  beforeEach(() => {
    mod = createTestModule({
      modules: [AppModule],
      providers: [
        [MAILER_TOKEN, { useClass: FakeMailer }],
        [PAYMENT_PROVIDER, { useClass: FakeProvider }],
      ],
    });
  });

  afterEach(async () => {
    await mod.cleanup();
  });

  it('happy path', async () => {
    const container = mod.getContainer();
    const users = container.resolve(UsersService);
    const mailer = container.resolve(MAILER_TOKEN) as FakeMailer;

    await users.invite({ email: 'a@b.c' });

    expect(mailer.sent).toMatchObject([{ to: 'a@b.c', template: 'invite' }]);
  });
});
```

Pieces:

- **`createTestModule`** assembles a container from your modules,
  provider overrides and mocks. Call `createApplication()` on it when a
  test needs the full `Application` lifecycle rather than just the
  container.
- **`providers`** takes `[token, definition]` pairs and replaces
  external-boundary services with fakes. `mocks` takes
  `{ token, mock, spy? }` entries when you want a mock object rather
  than a class.
- **`getContainer().resolve(...)`** pulls anything out, including the
  fakes, so a test can inspect what was called.
- **`cleanup()`** disposes the container and anything it started.

Transaction isolation is not part of this API — arrange it in your own
`beforeEach`/`afterEach` around the connection your module resolves, or
give each worker its own database (see below).

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

### Real Postgres

Use a real Postgres when RLS, triggers, advisory locks or jsonb
queries matter, or when the schema is Postgres-specific. The shared
test stack is reachable through the env helpers:

```typescript
import { TEST_POSTGRES_URL } from '@omnitron-dev/testing/env';

mod = createTestModule({
  modules: [AppModule],
  providers: [[DATABASE_URL_TOKEN, { useValue: TEST_POSTGRES_URL }]],
});
```

### Docker-managed test DB

When a suite needs its own instance rather than the shared stack:

```typescript
import { DatabaseTestManager, type DockerContainer } from '@omnitron-dev/testing/docker';

let postgres: DockerContainer;

beforeAll(async () => {
  postgres = await DatabaseTestManager.createPostgresContainer({ port: 'auto' });
}, 60_000);

afterAll(async () => {
  await postgres.cleanup();
});

beforeEach(() => {
  const port = postgres.ports.get(5432);
  mod = createTestModule({
    modules: [AppModule],
    providers: [[DATABASE_URL_TOKEN, { useValue: `postgres://test:test@localhost:${port}/test` }]],
  });
});
```

`port: 'auto'` asks the OS for a free port and is what allows several
suites to run in parallel — a fixed port makes them collide, and the
failure names a port the test never chose.

## Netron integration tests

```typescript
import { createTestModule } from '@omnitron-dev/testing/titan';
import { NetronClient } from '@omnitron-dev/netron-browser';
import type { Application } from '@omnitron-dev/titan';

describe('end-to-end users service', () => {
  let mod: TestModule;
  let app: Application;
  let client: NetronClient;

  beforeEach(async () => {
    mod = createTestModule({ modules: [AppModule] });
    app = await mod.createApplication();
    await app.start();

    // Register the transport server with `port: 0` and read back the port
    // the OS assigned — the server reports the port it bound, not the one
    // it was asked for.
    const port = app.netron.transportServers.get('http')!.port!;
    client = new NetronClient({ url: `http://localhost:${port}` });
    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect();
    await mod.cleanup();
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
import { waitForEvents } from '@omnitron-dev/testing';

it('fires user.created after invite', async () => {
  const container = mod.getContainer();
  const bus = container.resolve(EVENT_BUS_TOKEN);
  const users = container.resolve(UsersService);

  const eventPromise = waitForEvents(bus, ['user.created'], 2_000);
  await users.invite({ email: 'a@b.c' });

  const [user] = await eventPromise;
  expect(user.email).toBe('a@b.c');
});
```

`waitForEvents` resolves with one payload per event name, in the order
requested. Set up the wait **before** triggering the action — race-free.
`createEventSpy(bus, 'user.created')` is the alternative when you want
to inspect everything that was emitted rather than wait for the first.

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
