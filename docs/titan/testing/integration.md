---
sidebar_position: 3
title: Integration Tests
description: Boot a real Application with fake infrastructure.
---

# Integration Tests

An integration test boots a real Titan `Application` with selectively
faked infrastructure. It catches wiring, lifecycle, and module-
composition bugs that pure unit tests cannot.

## The pattern

```typescript
import { Application } from '@omnitron-dev/titan';

describe('UsersModule (integration)', () => {
  let app: Application;
  let users: UsersService;

  beforeAll(async () => {
    app = await Application.create(AppModule, {
      overrides: [
        { provide: Database, useClass: FakeDatabase },
        { provide: REDIS,    useValue: fakeRedis     },
      ],
      disableGracefulShutdown: true,
    });
    await app.start();
    users = await app.resolve(UsersService);
  });

  afterAll(async () => {
    await app.stop();
  });

  beforeEach(async () => {
    await (await app.resolve(Database)).reset();   // FakeDatabase impl
  });

  it('creates a user and finds it', async () => {
    const created = await users.create({ email: 'ada@x.com' });
    const found   = await users.findById(created.id);
    expect(found).toEqual(created);
  });
});
```

## What you get from a real Application

- **Lifecycle** runs. `onInit` and `onStart` for every provider.
  Catches "I forgot to await `connect()`" bugs.
- **Wiring** is real. The container resolves providers from your
  modules, not your test setup. Catches missing or mis-typed
  exports.
- **Decorators** apply. `@Cache`, `@RateLimit`, `@Auth`, `@Validate`
  all run. Catches order-of-decorators bugs.
- **Events** fire. Subscribers receive `module:initialized`,
  lifecycle events. Catches handlers that crash on subscription.

What you skip:

- The transport. Calls go directly through the container, not over
  the wire.
- Real backends (database, redis, third-party APIs). Fake those
  with `overrides`.

## Fixture lifetime

Three patterns:

### Per-suite — fastest

```typescript
beforeAll(...);          // boot once
afterAll(...);           // shut down once
beforeEach(...);         // reset state per test
```

Good when most tests share the same setup. Risk: state leaks
between tests if you forget a `beforeEach` reset.

### Per-test — safest

```typescript
beforeEach(async () => {
  app = await Application.create(...);
  await app.start();
});

afterEach(async () => {
  await app.stop();
});
```

Slower (boot per test), but no state leakage. Use when tests need
distinct configurations.

### Hybrid

```typescript
beforeAll(...);          // boot the heavy stuff (modules) once
beforeEach(...);         // reset light stuff (database, cache) per test
```

The right balance for most suites.

## Helpers

Common test setup deserves a helper:

```typescript
// test/setup.ts
export async function bootTestApp(overrides: any[] = []) {
  const app = await Application.create(AppModule, {
    overrides: [
      { provide: Database, useClass: FakeDatabase },
      ...overrides,
    ],
    disableGracefulShutdown: true,
  });
  await app.start();
  return app;
}
```

Reduces boilerplate per test file.

## Testing lifecycle hooks

```typescript
it('calls onInit in dependency order', async () => {
  const order: string[] = [];

  @Injectable()
  class A implements OnInit {
    async onInit() { order.push('A'); }
  }
  @Injectable()
  class B implements OnInit {
    constructor(private a: A) {}
    async onInit() { order.push('B'); }
  }

  @Module({ providers: [A, B] })
  class TestModule {}

  const app = await Application.create(TestModule, { disableGracefulShutdown: true });
  await app.start();

  expect(order).toEqual(['A', 'B']);

  await app.stop();
});
```

## Testing async startup failures

```typescript
it('aborts start when onInit throws', async () => {
  @Injectable()
  class Broken implements OnInit {
    async onInit() { throw new Error('boom'); }
  }

  @Module({ providers: [Broken] })
  class TestModule {}

  const app = await Application.create(TestModule, { disableGracefulShutdown: true });
  await expect(app.start()).rejects.toThrow('boom');
  // Application is in 'error' state; can be inspected.
});
```

## Anti-patterns

- **Sharing one app across all suites.** Test isolation breaks.
  Each suite gets its own; or use one and reset rigorously.
- **Forgetting `disableGracefulShutdown`.** Without it, every
  test app installs SIGTERM handlers; multiple test apps stomp
  on each other.
- **Using real backends.** Tests become slow and flaky. Use fakes;
  reserve real-backend tests for a separate, less frequent suite.
- **Testing one method's wiring.** That's a unit test's job.
  Integration tests should cover module-level interactions.

→ Back to [Testing Overview](./overview.md).
