---
sidebar_position: 4
title: 3. Auth
description: JWT sign-in, sessions, role-gated methods.
---

# Step 3 — Auth

By the end: users can sign in, get a JWT, and the `UsersService.list`
method is admin-only.

## Add the auth module + Redis

```bash
cd apps/api
pnpm add @omnitron-dev/titan-auth
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

## Schema additions

`apps/api/migrations/002_auth.sql`:

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN roles TEXT[] NOT NULL DEFAULT ARRAY['user'];

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  is_revoked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
```

```bash
psql -U postgres -h localhost -d platform < apps/api/migrations/002_auth.sql
```

Update `apps/api/src/db/schema.ts`:

```typescript
import type { Generated } from 'kysely';

export interface UsersTable {
  id:            Generated<string>;
  email:         string;
  name:          string;
  passwordHash:  string;
  roles:         string[];
  createdAt:     Generated<Date>;
}

export interface SessionsTable {
  id:         string;
  userId:     string;
  expiresAt:  Date;
  isRevoked:  Generated<boolean>;
  createdAt:  Generated<Date>;
}

export interface Database {
  users:    UsersTable;
  sessions: SessionsTable;
}
```

## Auth service

`apps/api/src/auth/auth.service.ts`:

```typescript
import { Injectable, Inject, Service, Public, Errors } from '@omnitron-dev/titan';
import { Validate } from '@omnitron-dev/titan/validation';
import { JWT_SERVICE_TOKEN, type IJWTService } from '@omnitron-dev/titan-auth';
import { DATABASE_CONNECTION } from '@omnitron-dev/titan-database';
import type { Kysely } from 'kysely';
import { cuid } from '@omnitron-dev/cuid';
import * as argon2 from 'argon2';
import { z } from 'zod';
import type { Database } from '../db/schema.js';

const SignInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});
type SignIn = z.infer<typeof SignInSchema>;

@Service('auth@1.0.0')
export class AuthService {
  constructor(
    @Inject(JWT_SERVICE_TOKEN)    private jwt: IJWTService,
    @Inject(DATABASE_CONNECTION)  private db:  Kysely<Database>,
  ) {}

  @Public({ auth: { allowAnonymous: true } })
  @Validate(SignInSchema)
  async signIn({ email, password }: SignIn) {
    const user = await this.db.selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw Errors.unauthorized('invalid credentials');
    }

    const sessionId = cuid();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.db.insertInto('sessions')
      .values({ id: sessionId, userId: user.id, expiresAt })
      .execute();

    const token = await this.jwt.sign({
      sub:   user.id,
      sid:   sessionId,
      roles: user.roles,
    });

    return { token, user: { id: user.id, email: user.email, roles: user.roles } };
  }

  @Public()
  async signOut({ sessionId }: { sessionId: string }) {
    await this.db.updateTable('sessions')
      .set({ isRevoked: true })
      .where('id', '=', sessionId)
      .execute();
    return { success: true };
  }
}
```

## Wire the module

Update `apps/api/src/app.module.ts`:

```typescript
import { Module }                from '@omnitron-dev/titan';
import { ConfigModule }          from '@omnitron-dev/titan/module/config';
import { TitanDatabaseModule }   from '@omnitron-dev/titan-database';
import { TitanRedisModule }      from '@omnitron-dev/titan-redis';
import { TitanAuthModule }       from '@omnitron-dev/titan-auth';

import { UserRepo }     from './users/user.repo.js';
import { UsersService } from './users/users.service.js';
import { AuthService }  from './auth/auth.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ sources: [{ type: 'env', prefix: 'API_' }] }),
    TitanRedisModule.forRoot({ config: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } }),
    TitanDatabaseModule.forRoot({
      dialect:    'postgres',
      connection: process.env.DATABASE_URL ?? 'postgres://postgres:dev@localhost:5432/platform',
    }),
    TitanAuthModule.forRoot({
      algorithm:  'HS256',
      jwtSecret:  process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
      issuer:     'my-platform',
      audience:   'my-platform',
    }),
  ],
  providers: [UserRepo, UsersService, AuthService],
})
export class AppModule {}
```

## Gate UsersService.list to admins

Update `apps/api/src/users/users.service.ts`:

```typescript
import { Service, Public } from '@omnitron-dev/titan';
import { RequireAuth, RequireRole } from '@omnitron-dev/titan-auth';
// ...

@Service('users@1.0.0')
export class UsersService {
  // ...

  @Public()
  @RequireAuth()                                        // any logged-in user
  async findById(id: string): Promise<User> {
    // ...
  }

  @Public()
  @RequireRole(['admin'])                                // admin only
  async list(): Promise<User[]> {
    return this.repo.list();
  }
}
```

## Seed an admin user

```bash
node -e "
const argon2 = require('argon2');
const { Pool } = require('pg');
const { cuid } = require('@omnitron-dev/cuid');

(async () => {
  const pool = new Pool({ connectionString: 'postgres://postgres:dev@localhost:5432/platform' });
  const hash = await argon2.hash('correct-horse-battery-staple');
  await pool.query(
    'INSERT INTO users (id, email, name, password_hash, roles) VALUES (\$1, \$2, \$3, \$4, \$5)',
    [cuid(), 'admin@example.com', 'Admin', hash, ['admin']]
  );
  console.log('admin@example.com / correct-horse-battery-staple');
  await pool.end();
})();
"
```

## Verify

```bash
JWT_SECRET=dev-secret-do-not-use-in-prod pnpm dev
```

```bash
node -e "
const { createClient } = require('@omnitron-dev/netron-browser');
(async () => {
  const c = createClient({ url: 'http://localhost:3001' });
  await c.connect();

  // Sign in:
  const { token, user } = await c.invoke('auth', 'signIn',
    [{ email: 'admin@example.com', password: 'correct-horse-battery-staple' }]);
  console.log('signed in:', user);

  // List (admin-only) with the token:
  const all = await c.invoke('users', 'list', [],
    { headers: { authorization: 'Bearer ' + token } });
  console.log('users:', all);
})();
"
```

Try without the token:

```bash
node -e "
const { createClient } = require('@omnitron-dev/netron-browser');
(async () => {
  const c = createClient({ url: 'http://localhost:3001' });
  await c.connect();
  try {
    await c.invoke('users', 'list', []);
  } catch (e) {
    console.log('rejected:', e.code, e.message);  // → UNAUTHORIZED
  }
})();
"
```

## What's new

| Piece | What it does |
| ----- | ------------ |
| `TitanAuthModule.forRoot({...})` | Wires JWT signing + verification |
| `IJWTService` | Inject to sign / verify tokens manually |
| `@RequireAuth()` | Method-level: any logged-in user |
| `@RequireRole(['admin'])` | Method-level: specific roles |
| `@Public({ auth: { allowAnonymous: true } })` | Method-level: explicit anonymous |

For multi-app fan-out (one identity app + N specialists sharing
the same JWT + Redis session registry), see
[Best practices / Shared auth](../omnitron/best-practices.md#shared-authentication-across-apps).

## Commit

```bash
git add .
git commit -m "step 3: JWT auth + role-gated methods"
```

## Next

**[Step 4 — Frontend →](./04-frontend.md)** — build a React UI
that calls this service.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Cannot find module 'argon2'` | `pnpm add argon2` in apps/api |
| `JWT_SECRET is required` | Export it: `export JWT_SECRET=dev-secret-do-not-use-in-prod` |
| `UNAUTHORIZED` with valid token | Check JWT signing key matches verification key |
| `FORBIDDEN` (403) | Token is valid but role insufficient |
