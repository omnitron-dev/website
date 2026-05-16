---
sidebar_position: 2
title: DI Overrides
description: Replacing providers for tests — fakes, stubs, in-memory implementations.
---

# DI Overrides

The container's central role makes testing easy: replace any
provider with a test double, and every consumer gets the double
without code changes.

## The override API

```typescript
const container = new Container();

container.register(DATABASE, {
  useClass: FakeDatabase,         // override the real provider
});

container.register(USERS_SERVICE, {
  useClass: UsersService,
  // Resolves with FakeDatabase as its `database` dep.
});
```

For a Titan-style override (replacing within an `Application`):

```typescript
import { Application } from '@omnitron-dev/titan';

const app = await Application.create(AppModule, {
  overrides: [
    { provide: Database, useClass: FakeDatabase },
    { provide: REDIS,    useValue: fakeRedis     },
  ],
});
```

The `overrides` option applies after module discovery but before
provider resolution — your override wins over what the modules
declare.

## Fake vs mock vs stub

Three styles, all valid:

- **Fake** — a working implementation that uses a simpler backing
  store (in-memory database, in-memory cache).
- **Mock** — a programmable double that records calls and returns
  configured responses (`vi.fn()`, `jest.fn()`).
- **Stub** — a hard-coded response, no programming.

For unit tests of business logic, mocks are fast and precise. For
integration tests of wiring, fakes are realistic.

## A canonical fake database

```typescript
import type { Database, User } from './types.js';

class FakeDatabase implements Database {
  private readonly users = new Map<string, User>();

  async findUser(id: string)         { return this.users.get(id) ?? null; }
  async createUser(input: NewUser)   {
    const u = { id: crypto.randomUUID(), ...input };
    this.users.set(u.id, u);
    return u;
  }
  async deleteUser(id: string)       { this.users.delete(id); }
}
```

Use it in any test:

```typescript
const db = new FakeDatabase();
await db.createUser({ email: 'ada@x.com' });
expect(await db.findUser('…')).toEqual(...);
```

The same fake works at every test level — unit, integration, e2e.

## Module-level overrides

Sometimes you want to override a whole *module*, not just one
provider. Define a test variant:

```typescript
@Module({
  providers: [{ provide: Database, useClass: FakeDatabase }],
  exports:   [Database],
})
class FakeDatabaseModule {}

// In the test:
@Module({
  imports: [
    FakeDatabaseModule,           // instead of DatabaseModule
    UsersModule,
    OrdersModule,
  ],
})
class TestAppModule {}

const app = await Application.create(TestAppModule);
```

Useful for swapping infrastructure (database, redis, file storage)
to test-friendly implementations across many tests.

## Spying without replacing

Sometimes you want to observe calls without changing behaviour:

```typescript
import { vi } from 'vitest';

const real = await container.resolve(LoggerService);
const spy  = vi.spyOn(real, 'info');

// run code that should log
expect(spy).toHaveBeenCalledWith('ready', expect.objectContaining({ port: 3000 }));
```

The spy doesn't replace the implementation; it wraps it.

## The "two real, one fake" pattern

A common integration test pattern:

```typescript
@Module({
  imports: [
    LoggerModule,                    // real
    ConfigModule.forRoot({...}),     // real
    { module: DatabaseModule, providers: [{ provide: Database, useClass: FakeDatabase }] },
    UsersModule,                     // real
  ],
})
class IntegrationTestModule {}
```

Real logger, real config, fake database, real services. Catches
wiring bugs without paying for a real database.

## Anti-patterns

- **Overriding too much.** A test where every provider is mocked
  is testing the test, not the code. Override only what you need
  to control.
- **Mutable shared fakes across tests.** Two tests that share a
  `FakeDatabase` see each other's data. Use a fresh fake per test
  (or `beforeEach` to reset).
- **Testing the framework.** "Does the container resolve providers?"
  is the framework's responsibility, not yours. Test your code,
  trust the framework.

→ Next: [Integration](./integration.md).
