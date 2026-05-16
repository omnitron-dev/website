---
sidebar_position: 1
title: Testing
description: Unit, integration, end-to-end — patterns that scale.
---

# Testing

Titan is designed to be tested at three layers, each with a distinct
purpose:

| Layer       | What it tests                                          | Speed         |
| ----------- | ------------------------------------------------------ | ------------- |
| Unit        | One class with mocked dependencies                     | <1 ms / test  |
| Integration | Several classes through the container, real fakes      | 10 ms / test  |
| End-to-end  | The whole app over a real transport, real backend      | 100 ms / test |

The pyramid: many unit tests, fewer integration, fewer still e2e.

This page is the entry point. Detail in:

- [DI Overrides](./di-overrides.md) — patterns for mocking through
  the container.
- [Integration](./integration.md) — partial app boots, real
  ConfigModule and LoggerModule, fake everything else.

## The unit test pattern

A `@Service` is just a class. Test it like one:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('UsersService', () => {
  it('returns the user when found', async () => {
    const repo   = { findById: vi.fn().mockResolvedValue({ id: 'u_1', email: 'x' }) };
    const logger = { info: vi.fn() };

    const svc = new UsersService(repo as any, logger as any);

    const user = await svc.findById('u_1');
    expect(user).toEqual({ id: 'u_1', email: 'x' });
    expect(repo.findById).toHaveBeenCalledWith('u_1');
  });

  it('throws NotFoundError when missing', async () => {
    const repo   = { findById: vi.fn().mockResolvedValue(null) };
    const svc    = new UsersService(repo as any, { info: vi.fn() } as any);

    await expect(svc.findById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

No container, no application, no Netron. Just the class and its
dependencies.

This is the right level for **business logic** tests. They run in
microseconds. You can have thousands.

## When to use the container

Use the container (and a real `Application`) when:

- You're testing **wiring** — does this module actually export the
  right providers?
- You're testing **lifecycle** — does my `onInit` run after the
  database connects?
- You're testing **decorators** — does `@Cache` actually short-
  circuit on a hit?

For all of these, see [DI Overrides](./di-overrides.md) and
[Integration](./integration.md).

## When to go end-to-end

End-to-end tests boot a real `Application`, bind a real transport,
and drive it with a real `NetronClient`. Use them sparingly — they
catch wire-format and transport bugs that unit tests miss, but
they're slow.

Pattern:

```typescript
import { Application } from '@omnitron-dev/titan';
import { NetronClient } from '@omnitron-dev/netron-browser';

let app: Application;
let client: NetronClient;

beforeAll(async () => {
  app = await Application.create(AppModule, {
    netron: { http: { port: 0 } },           // 0 = pick free port
    disableGracefulShutdown: true,
  });
  await app.start();
  client = new NetronClient({ url: app.netron.http!.url });
});

afterAll(async () => {
  await app.stop();
});

it('end-to-end: create + find', async () => {
  const users  = await client.queryInterface<UsersService>('users@1.0.0');
  const user   = await users.create({ email: 'ada@x.com', name: 'Ada' });
  const found  = await users.findById(user.id);
  expect(found).toEqual(user);
});
```

## The right ratio

A typical Titan service ends up with:

- **80% unit tests** — fast, focused, business-logic-only.
- **15% integration tests** — wiring, lifecycle, module
  composition.
- **5% e2e tests** — happy paths over the wire.

If you find yourself writing many integration tests for one service,
the service is doing too much. Split it.

→ Read on: [DI Overrides](./di-overrides.md), [Integration](./integration.md).
