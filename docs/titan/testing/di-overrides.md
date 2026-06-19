---
sidebar_position: 2
title: DI Overrides
description: Replacing providers for tests — fakes, stubs, in-memory implementations.
---

# DI Overrides

The container's central role makes testing easy: replace any
provider with a test double, and every consumer resolves the double
without code changes. This page is the reference for *how* to swap a
provider in a Titan test — at the container level, at the
`Application.create` level, and with the `@omnitron-dev/testing/titan`
helpers.

## How overriding works

A Nexus container keys registrations by token, and **the last
registration for a token wins**. Overriding is therefore just
re-registering a token with a different provider definition after the
original is in place.

A provider definition is the standard Nexus shape (one of `useClass`,
`useValue`, `useFactory`, `useToken`, or a bare constructor — see
`Provider` in `packages/titan/src/nexus/types.ts:300`):

```typescript
import { Container } from '@omnitron-dev/titan/nexus';

const container = new Container();

container.register(DATABASE, { useClass: FakeDatabase });
container.register(USERS_SERVICE, { useClass: UsersService });
// UsersService resolves with FakeDatabase as its `database` dep.
```

To force a re-registration over an existing one, pass
`{ override: true }`:

```typescript
container.register(DATABASE, { useClass: RealDatabase });
container.register(DATABASE, { useClass: FakeDatabase }, { override: true });
// resolve(DATABASE) → FakeDatabase
```

`Application` exposes the same surface as `app.register(token,
provider, { override: true })`.

## Overriding through `Application.create`

When you boot a full app for an integration test, pass the
`providers` option — an array of `[token, providerDefinition]`
**tuples**:

```typescript
import { Application } from '@omnitron-dev/titan';

const app = await Application.create({
  modules:   [AppModule],
  providers: [
    [Database, { useClass: FakeDatabase }],
    [REDIS,    { useValue: fakeRedis     }],
  ],
  disableGracefulShutdown: true,
});
```

The shape of `providers` is defined by `CreateOptions` in
`packages/titan/src/application/application.ts:117`:

```typescript
providers?: Array<[InjectionToken<unknown>, Provider<unknown>]>;
```

`create()` registers these into the container **after** the modules
are wired (`application.ts:276`–288 — modules at lines 269–274,
`providers` immediately after), so each tuple's definition wins over
whatever the module declared for the same token. There is no
`overrides` option — `providers` is the override mechanism.

Each tuple's provider definition uses the standard Nexus shape:

```typescript
providers: [
  [Database, { useClass: FakeDatabase }],          // construct a fake
  [Clock,    { useValue: { now: () => 0 } }],       // pin a value
  [Cache,    { useFactory: () => new MapCache() }], // build per resolution
]
```

After all modules and providers are registered, `create()` calls
`container.eagerlyInitialize()` (`application.ts:293`), so singleton
providers — including your fakes — are constructed before `create()`
resolves.

## Fake vs mock vs stub

Three styles, all valid:

- **Fake** — a working implementation backed by a simpler store
  (in-memory database, in-memory cache). Best for integration tests
  of wiring.
- **Mock** — a programmable double that records calls and returns
  configured responses (`vi.fn()`). Best for unit tests of business
  logic.
- **Stub** — a hard-coded response, no programming.

## A canonical fake

```typescript
import type { Database, User, NewUser } from './types.js';

export class FakeDatabase implements Database {
  private readonly users = new Map<string, User>();

  async findUser(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: NewUser): Promise<User> {
    const user = { id: crypto.randomUUID(), ...input };
    this.users.set(user.id, user);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  /** Test affordance: wipe between tests. */
  reset(): void {
    this.users.clear();
  }
}
```

Wire it through `providers`, then reset it in `beforeEach`:

```typescript
const app = await Application.create({
  modules:   [AppModule],
  providers: [[Database, { useClass: FakeDatabase }]],
  disableGracefulShutdown: true,
});
await app.start();

beforeEach(() => {
  (app.resolve(Database) as FakeDatabase).reset();
});
```

The same fake works at every test level — unit, integration, e2e.

## The `@omnitron-dev/testing/titan` helpers

The testing package ships container-level test helpers under the
**`@omnitron-dev/testing/titan`** subpath (declared in
`packages/testing/package.json:47`). They are **not** exported from
the package root — always import from the subpath:

```typescript
import {
  createTestModule,
  MockProvider,
  createMockProvider,
} from '@omnitron-dev/testing/titan';
```

These wrap a `TestContainer` (a `Container` subclass), not a booted
`Application`. Use them when you want fine-grained mocking, spying,
and interaction recording without standing up the full lifecycle.

### `createTestModule` / `TestModule`

`createTestModule(options)` returns a `TestModule`
(`packages/testing/src/titan/test-module.ts:165`). Its options
(`TestModuleOptions`, same file lines 11–21):

```typescript
interface TestModuleOptions {
  modules?:   IModule[];
  providers?: Array<[InjectionToken<any>, ProviderDefinition<any>]>;
  mocks?:     Array<{ token: InjectionToken<any>; mock: any; spy?: boolean }>;
  config?:    Partial<IApplicationConfig>;
  autoMock?:  boolean;
}
```

`mocks` is the override channel here — each entry registers
`{ useValue: mock }` for its token (with optional spy wrapping).
`TestModule` also exposes a fluent API:

```typescript
import { createTestModule } from '@omnitron-dev/testing/titan';

const harness = createTestModule({
  providers: [[USERS_SERVICE, { useClass: UsersService }]],
  mocks:     [{ token: DATABASE, mock: new FakeDatabase() }],
});

// Fluent overrides (each returns `this`):
harness
  .override(CLOCK).useValue({ now: () => 0 })
  .mock(MAILER, { send: vi.fn() }, /* spy */ true)
  .stub(FEATURE_FLAGS, { isEnabled: true });

const users = harness.get(USERS_SERVICE);  // resolves from the test container
```

Method reference (`test-module.ts:78`–159):

| Method | Effect |
| ------ | ------ |
| `mock(token, mock, spy?)` | Register `mock` as the token's value; optionally wrap its methods in spies. |
| `stub(token, partial)` | Register a partial implementation. |
| `override(token)` | Returns `{ useValue, useClass, useFactory }` — pick one. |
| `spy(token, method)` | Spy on a method of the already-registered instance. |
| `get(token)` | Resolve from the test container. |
| `resetMocks()` / `clearMocks()` / `restore()` | Mock lifecycle control. |
| `cleanup()` | Stop the app (if `createApplication()` was called) and restore the container. |

> `TestModule.createApplication()` constructs an `Application` and
> attaches the test container, but **does not call `start()`** — it
> is for container-resolution tests, not lifecycle tests. To exercise
> the real lifecycle (`onStart`, module ordering, hooks), boot with
> `Application.create({ ..., providers: [...] })` and call
> `app.start()` yourself (see [Integration](./integration.md)).

### `MockProvider` and `createMockProvider`

Two distinct helpers (`packages/testing/src/titan/nexus/mock-provider.ts`):

**`MockProvider`** (lines 112–126) — wrap a plain object so every
function becomes a `vi.fn()`. Hand the instance straight to a
`useValue` provider:

```typescript
import { MockProvider } from '@omnitron-dev/testing/titan';

const mailer = new MockProvider({
  send:  async () => ({ id: 'msg_1' }),
  flush: () => {},
});

const app = await Application.create({
  modules:   [AppModule],
  providers: [[MAILER, { useValue: mailer }]],
  disableGracefulShutdown: true,
});

// `mailer.send` is a vi.fn — assert on it directly:
expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@x.com' }));
```

**`createMockProvider(config)`** (lines 95–97) — builds a
`MockProviderDI` from a config object
(`MockProviderConfig`, lines 9–15: `{ token, value?, factory?,
spy?, autoMock? }`). Call `.getProvider()` to get the Nexus provider
definition:

```typescript
import { createMockProvider } from '@omnitron-dev/testing/titan';

const dbMock = createMockProvider({
  token: DATABASE,
  value: new FakeDatabase(),
});

const app = await Application.create({
  modules:   [AppModule],
  providers: [[DATABASE, dbMock.getProvider()]],  // → { useValue: ... }
  disableGracefulShutdown: true,
});
```

With `autoMock: true` (and no `value`/`factory`), the provider is a
proxy that lazily returns a `vi.fn()` for every accessed property —
handy for a dependency you must satisfy but never call.

## Module-level overrides

Sometimes you want to override a whole *module*, not a single
provider. Define a test variant and import it instead of the real one:

```typescript
@Module({
  providers: [{ provide: Database, useClass: FakeDatabase }],
  exports:   [Database],
})
class FakeDatabaseModule {}

@Module({
  imports: [
    FakeDatabaseModule,   // instead of DatabaseModule
    UsersModule,
    OrdersModule,
  ],
})
class TestAppModule {}

const app = await Application.create(TestAppModule, {
  disableGracefulShutdown: true,
});
```

Useful for swapping infrastructure (database, redis, file storage) to
test-friendly implementations across many tests. Note this uses the
module-decorator `{ provide, useClass }` shape, distinct from the
`create({ providers: [[token, def]] })` tuple shape.

## Spying without replacing

Sometimes you want to observe calls without changing behaviour:

```typescript
import { vi } from 'vitest';

const real = app.resolve(LoggerService);
const spy  = vi.spyOn(real, 'info');

// run code that should log
expect(spy).toHaveBeenCalledWith('ready', expect.objectContaining({ port: 3000 }));
```

The spy wraps the implementation; it doesn't replace it. The
`TestModule.spy(token, method)` helper does the same against the test
container.

## The "two real, one fake" pattern

A common integration setup — real logger, real config, fake database,
real services:

```typescript
const app = await Application.create({
  modules:   [LoggerModule, ConfigModule.forRoot({ /* ... */ }), UsersModule],
  providers: [[Database, { useClass: FakeDatabase }]],
  disableGracefulShutdown: true,
});
```

Catches wiring bugs without paying for a real database.

## Anti-patterns

- **Overriding too much.** A test where every provider is mocked is
  testing the test, not the code. Override only what you need to
  control.
- **Mutable shared fakes across tests.** Two tests that share one
  `FakeDatabase` see each other's data. Use a fresh fake per test, or
  `reset()` in `beforeEach`.
- **Testing the framework.** "Does the container resolve providers?"
  is the framework's job. Test your code; trust the framework.

→ Next: [Integration](./integration.md).
