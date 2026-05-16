---
sidebar_position: 2
title: Quickstart
---

# Quickstart

Build a Titan service, expose it over Netron, and call it from a TypeScript
client. End-to-end in under five minutes.

## 1. Define the service

A Titan service is a class with a `@Service` decorator. Methods marked
`@Public()` are exposed over the configured RPC transports.

```typescript title="src/users.service.ts"
import { Service, Public } from '@omnitron-dev/titan';

export interface User {
  id: string;
  email: string;
}

@Service('users@1.0.0')
export class UsersService {
  private readonly users = new Map<string, User>();

  @Public()
  async create(email: string): Promise<User> {
    const id = crypto.randomUUID();
    const user = { id, email };
    this.users.set(id, user);
    return user;
  }

  @Public()
  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}
```

## 2. Bind a module

A module is the unit of composition. Providers, imports, and exports are
declarative.

```typescript title="src/users.module.ts"
import { Module } from '@omnitron-dev/titan';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService],
  exports:   [UsersService],
})
export class UsersModule {}
```

## 3. Boot the application

`Application.create` wires the container, starts the lifecycle, and exposes
the requested transports.

```typescript title="src/main.ts"
import { Application } from '@omnitron-dev/titan';
import { UsersModule } from './users.module.js';

const app = await Application.create(UsersModule, {
  netron: {
    http:      { port: 3000 },
    websocket: { port: 3001 },
  },
});

await app.start();
console.log('Users service listening on :3000 (HTTP) and :3001 (WS)');
```

Run it:

```bash
node --loader ts-node/esm src/main.ts
```

## 4. Call from a client

The client resolves the service interface against the running app — no
codegen, no schema file. The TypeScript types travel with the import.

```typescript title="src/client.ts"
import { NetronClient } from '@omnitron-dev/netron-browser';
import type { UsersService } from './users.service.js';

const client = new NetronClient({ url: 'http://localhost:3000' });
const users  = await client.queryInterface<UsersService>('users@1.0.0');

const user = await users.create('ada@example.com');
console.log(user); // { id: '...', email: 'ada@example.com' }
```

## What just happened

- The service signature declared on the server became the client interface.
- Validation, serialisation, and dispatch ran without your having to write
  any of them.
- The same `UsersService` is reachable over WebSocket (`ws://localhost:3001`)
  with the same calling convention.
- Adding a third transport — TCP for service-to-service, Unix for sidecars —
  is one config key.

## Next steps

- [Project structure](./project-structure.md) — recommended layout for a
  multi-service Titan repo.
- [Titan overview](../titan/overview.md) — the framework in depth.
- [Netron RPC](../titan/netron.md) — transports, middleware, auth.
- [Frontend hooks](../frontend/netron/react.md) — call the same service
  from React with full type safety.
