---
sidebar_position: 3
title: 2. Service with a database
description: Replace the hello service with a real one backed by Postgres.
---

# Step 2 — A real service

By the end: a `UsersService` with `findById` / `create` /
`list`, persisting to Postgres via `titan-database`.

## Add the database module

```bash
cd apps/api
pnpm add @omnitron-dev/titan-database @omnitron-dev/titan-redis @omnitron-dev/cuid kysely pg zod
cd ../..
```

`ConfigModule` and `LoggerModule` need no install — they ship
inside `@omnitron-dev/titan`, which you already have, and are
imported from its `./module/config` and `./module/logger`
subpaths. A subpath is not a package: `pnpm add
@omnitron-dev/titan/module/config` asks the registry for a
package by that name and fails.

Spin up Postgres locally:

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=platform -p 127.0.0.1:5432:5432 postgres:16-alpine
```

## Schema

`apps/api/src/db/schema.ts`:

```typescript
import type { Generated } from 'kysely';

export interface UsersTable {
  id:        Generated<string>;
  email:     string;
  name:      string;
  createdAt: Generated<Date>;
}

export interface Database {
  users: UsersTable;
}
```

## Migration

`apps/api/migrations/001_users.sql`:

```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Run it:

```bash
PGPASSWORD=dev psql -U postgres -h localhost -d platform < apps/api/migrations/001_users.sql
```

## Repository

`apps/api/src/users/user.repo.ts`:

```typescript
import { Injectable, Inject } from '@omnitron-dev/titan';
import type { Kysely } from 'kysely';
import { DATABASE_CONNECTION } from '@omnitron-dev/titan-database';
import { cuid } from '@omnitron-dev/cuid';
import type { Database } from '../db/schema.js';

export interface User {
  id:        string;
  email:     string;
  name:      string;
  createdAt: Date;
}

@Injectable()
export class UserRepo {
  constructor(@Inject(DATABASE_CONNECTION) private db: Kysely<Database>) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ?? null;
  }

  async create(input: { email: string; name: string }): Promise<User> {
    return await this.db.insertInto('users')
      .values({ id: cuid(), ...input })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async list(): Promise<User[]> {
    return await this.db.selectFrom('users')
      .selectAll()
      .orderBy('createdAt', 'desc')
      .limit(100)
      .execute();
  }
}
```

## Service

`apps/api/src/users/users.service.ts`:

```typescript
import { Service } from '@omnitron-dev/titan';
import { Public, Validate } from '@omnitron-dev/titan/decorators';
import { Errors } from '@omnitron-dev/titan/errors';
import { z } from 'zod';
import { UserRepo, type User } from './user.repo.js';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(120),
});
type CreateUser = z.infer<typeof CreateUserSchema>;

@Service('users@1.0.0')
export class UsersService {
  constructor(private readonly repo: UserRepo) {}

  @Public()
  async findById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw Errors.notFound('user', id);
    return user;
  }

  @Public()
  @Validate(CreateUserSchema)
  async create(input: CreateUser): Promise<User> {
    return this.repo.create(input);
  }

  @Public()
  async list(): Promise<User[]> {
    return this.repo.list();
  }
}
```

## Wire the module

`apps/api/src/app.module.ts`:

```typescript
import { Module } from '@omnitron-dev/titan';
import { ConfigModule } from '@omnitron-dev/titan/module/config';
import { TitanDatabaseModule } from '@omnitron-dev/titan-database';
import { UserRepo }     from './users/user.repo.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      sources: [{ type: 'env', prefix: 'API_' }],
    }),
    TitanDatabaseModule.forRoot({
      camelCase: true, // created_at in SQL ↔ createdAt in TypeScript
      // `connection` is the whole connection, not just its URL — dialect and
      // DSN travel together, which is what lets `connections: { … }` name
      // several of them.
      connection: {
        dialect: 'postgres',
        connection: process.env['DATABASE_URL'] ?? 'postgres://postgres:dev@localhost:5432/platform',
      },
    }),
  ],
  providers: [UserRepo, UsersService],
})
export class AppModule {}
```

Update `apps/api/src/main.ts`:

```typescript
import { Application } from '@omnitron-dev/titan';
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';
import { AppModule }   from './app.module.js';

const app = await Application.create(AppModule);
if (!app.netron) throw new Error('Netron is unavailable');
app.netron.registerTransport('http', () => new HttpTransport());
app.netron.registerTransportServer('http', {
  name: 'api',
  options: { host: '127.0.0.1', port: 3001 },
});
await app.start();
console.log('api ready');

// Application owns signal handling and shutdown.
```

Run + test:

```bash
pnpm dev
```

```bash
node --input-type=module <<'JS'
import { createClient } from '@omnitron-dev/netron-browser';
const c = createClient({ url: 'http://127.0.0.1:3001' });
try {
  await c.connect();

  // Create:
  const u = await c.invoke('users@1.0.0', 'create', [{ email: 'alice@example.com', name: 'Alice' }]);
  console.log('created:', u);

  // Fetch:
  const fetched = await c.invoke('users@1.0.0', 'findById', [u.id]);
  console.log('found:', fetched);

  // List:
  const all = await c.invoke('users@1.0.0', 'list', []);
  console.log('all:', all);
} finally {
  await c.disconnect();
}
JS
```

The round trip exercises the database through the HTTP transport. Use a typed service proxy, as in the [quickstart](../getting-started/quickstart.md), when calling from TypeScript.

## What changed

| Piece | What it does |
| ----- | ------------ |
| `TitanDatabaseModule.forRoot({...})` | Bootstraps a Kysely instance against your DB |
| `@Inject(DATABASE_CONNECTION) db: Kysely<Database>` | DI the typed query builder |
| `UserRepo` | Database access layer — repos handle SQL |
| `UsersService` | Business layer — services compose repos + cross-cutting concerns |
| `@Validate(schema)` | Zod schema runs as input validation; bad input throws `Errors.validation` |
| `Errors.notFound(...)` | Returns a typed `NOT_FOUND` over the wire — the client sees a `TitanError` with `code: 'NOT_FOUND'` |

Repo + service split is the canonical pattern — easier to test,
clearer responsibilities.

## Commit

```bash
git add .
git commit -m "step 2: real users service with Postgres"
```

## Next

**[Step 3 — Auth →](./03-auth.md)** — JWT sign-in, sessions,
role-gated methods.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `ECONNREFUSED 5432` | Postgres not running; `docker start pg` |
| `password authentication failed` | Wrong `DATABASE_URL`; check env |
| `relation "users" does not exist` | Migration didn't run; re-run the psql command |
| `Errors.notFound is not a function` | Import path: `import { Errors } from '@omnitron-dev/titan/errors';` |
