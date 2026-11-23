---
id: "tutorial/auth"
slug: "/docs/tutorial/auth"
sidebar_position: 4
title: 3. Auth
description: Issue a short-lived access token, bind it to a database session and enforce roles on Netron calls.
---

# Step 3 — Sign in and authorize requests

A user signs in once and presents a bearer token on subsequent requests. PostgreSQL owns the session and the current roles. Signing out revokes that session, including requests made with a previously issued token.

## Add authentication {#add-the-auth-module--redis}

From the workspace root, install the verifier, the password hasher and the token issuer in the API application.

```bash
pnpm --dir apps/api add @omnitron-dev/titan-auth argon2 jose
export JWT_SECRET="$(openssl rand -hex 32)"
```

Keep this value in the environment of the API process. The issuer and verifier in this tutorial use the same secret. Generating a new secret invalidates previously signed tokens.

## Schema additions {#schema-additions}

Apply `apps/api/migrations/002_auth.sql` to the tutorial database.

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN roles TEXT[] NOT NULL DEFAULT ARRAY['user'];

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
```

```bash
PGPASSWORD=dev psql -v ON_ERROR_STOP=1 -U postgres -h localhost -d platform -f apps/api/migrations/002_auth.sql
```

Extend `apps/api/src/db/schema.ts`. Existing users can sign in after a password has been set. The repository from step 2 continues to return only its four public columns.

```typescript
import type { Generated } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  passwordHash: string | null;
  roles: Generated<string[]>;
  createdAt: Generated<Date>;
}

export interface SessionsTable {
  id: string;
  userId: string;
  expiresAt: Date;
  isRevoked: Generated<boolean>;
  createdAt: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
}
```

## Auth service {#auth-service}

In `apps/api/src/auth/settings.ts`, read the signing configuration once at startup.

```typescript
const secret = process.env.JWT_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET requires at least 32 bytes');
export const authSettings = { algorithm: 'HS256', jwtSecret: secret, issuer: 'my-platform', audience: 'my-platform' } as const;
```

In `apps/api/src/auth/auth.service.ts`, issue a 15-minute token and record its session before returning it. A password hash stays in the API process. The server obtains the session to revoke from the verified invocation.

```typescript
import { Inject, Service } from '@omnitron-dev/titan';
import { Public, Validate } from '@omnitron-dev/titan/decorators';
import { Errors } from '@omnitron-dev/titan/errors';
import { getCurrentInvocationContext } from '@omnitron-dev/titan/netron';
import { DATABASE_CONNECTION } from '@omnitron-dev/titan-database';
import { cuid } from '@omnitron-dev/cuid';
import { SignJWT } from 'jose';
import { verify } from 'argon2';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/schema.js';
import { authSettings } from './settings.js';

const SignIn = z.object({ email: z.string().email(), password: z.string().min(8) });

@Service('auth@1.0.0')
export class AuthService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Kysely<Database>) {}

  @Public({ auth: { allowAnonymous: true } })
  @Validate({ input: SignIn })
  async signIn({ email, password }: z.infer<typeof SignIn>) {
    const user = await this.db.selectFrom('users').select(['id', 'email', 'passwordHash', 'roles'])
      .where('email', '=', email).executeTakeFirst();
    if (!user?.passwordHash || !await verify(user.passwordHash, password)) {
      throw Errors.unauthorized('Invalid credentials');
    }

    const id = cuid();
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const token = await new SignJWT({ sid: id, roles: user.roles })
      .setProtectedHeader({ alg: authSettings.algorithm }).setSubject(user.id)
      .setIssuer(authSettings.issuer).setAudience(authSettings.audience)
      .setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(authSettings.jwtSecret));
    await this.db.insertInto('sessions').values({ id, userId: user.id, expiresAt: new Date(exp * 1000) }).execute();
    return { token, user: { id: user.id, email: user.email, roles: user.roles } };
  }

  @Public({ auth: true })
  async signOut() {
    const auth = getCurrentInvocationContext()?.auth;
    const sid = auth?.claims?.sid;
    if (!auth || typeof sid !== 'string') throw Errors.unauthorized('Missing session');
    await this.db.updateTable('sessions').set({ isRevoked: true })
      .where('id', '=', sid).where('userId', '=', auth.userId).execute();
    return { success: true };
  }
}
```

## Wire the module {#wire-the-module}

Keep the `TitanDatabaseModule` configuration from step 2, including `camelCase: true`. In `AppModule`, add `TitanAuthModule.forRoot(authSettings)` to `imports` and `AuthService` to `providers`.

```typescript
import { TitanAuthModule } from '@omnitron-dev/titan-auth';
import { AuthService } from './auth/auth.service.js';
import { authSettings } from './auth/settings.js';
```

Add `apps/api/src/auth/configure.ts`. The shared-session preset verifies the JWT and calls `sessionAuthority` for each protected request. One query reads the session and the user's current roles together.

```typescript
import type { Application } from '@omnitron-dev/titan';
import { AuthorizationManager } from '@omnitron-dev/titan/netron/auth';
import { JWT_SERVICE_TOKEN, type IJWTService } from '@omnitron-dev/titan-auth';
import { createSharedSessionAuthManager } from '@omnitron-dev/titan-auth/preset/shared-session';
import { DATABASE_CONNECTION } from '@omnitron-dev/titan-database';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { authSettings } from './settings.js';

export async function configureAuth(app: Application) {
  const { netron, logger } = app;
  if (!netron || !logger) throw new Error('Netron and the application logger are required');
  const jwtService = await app.container.resolveAsync<IJWTService>(JWT_SERVICE_TOKEN);
  const db = await app.container.resolveAsync<Kysely<Database>>(DATABASE_CONNECTION);
  const verifier = createSharedSessionAuthManager({
    logger, jwtService, expectedIssuer: authSettings.issuer,
    async sessionAuthority(id, userId) {
      const row = await db.selectFrom('sessions').innerJoin('users', 'users.id', 'sessions.userId')
        .select(['sessions.userId', 'sessions.expiresAt', 'sessions.isRevoked', 'users.roles'])
        .where('sessions.id', '=', id).where('sessions.userId', '=', userId).executeTakeFirst();
      return row && { ...row, permissions: [] };
    },
  });
  netron.configureAuth(verifier, new AuthorizationManager(logger));
}
```

In `main.ts`, import `configureAuth` and call `await configureAuth(app)` before `await app.start()`. Keep the HTTP transport registration from step 2.

## Gate UsersService.list to admins {#gate-usersservicelist-to-admins}

In `UsersService`, require a signed-in user for `findById` and the admin role for `list` and `create`. Keep the method bodies and validation from step 2.

| Method | Exposure |
| --- | --- |
| `findById` | `@Public({ auth: true })` |
| `list` and `create` | `@Public({ auth: { roles: ['admin'] } })` |

## Seed an admin user {#seed-an-admin-user}

Set `TUTORIAL_PASSWORD` privately for the local example. These commands run from `apps/api`. Seeding an existing email fails, so the example cannot overwrite an existing account's credentials or roles.

```bash
cd apps/api
node --input-type=module <<'JS'
import { hash } from 'argon2';
import pg from 'pg';
import { cuid } from '@omnitron-dev/cuid';
const password = process.env.TUTORIAL_PASSWORD;
if (!password || password.length < 12) throw new Error('Set TUTORIAL_PASSWORD to at least 12 characters');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:dev@localhost:5432/platform' });
try {
  await pool.query('INSERT INTO users (id,email,name,password_hash,roles) VALUES ($1,$2,$3,$4,$5)',
    [cuid(), 'admin@example.com', 'Admin', await hash(password), ['admin']]);
} finally {
  await pool.end();
}
JS
```

## Verify {#verify}

Start the API with `pnpm dev` in the shell with `JWT_SECRET` set. From a second shell in `apps/api` with the same tutorial password, exercise sign-in, the protected method and revocation.

```bash
node --input-type=module <<'JS'
import { AuthenticationClient, HttpClient } from '@omnitron-dev/netron-browser';
const auth = new AuthenticationClient();
const client = new HttpClient({ url: 'http://127.0.0.1:3001', auth });
try {
  await client.connect();
  const { token } = await client.invoke('auth@1.0.0', 'signIn',
    [{ email: 'admin@example.com', password: process.env.TUTORIAL_PASSWORD }]);
  auth.setToken(token);
  const users = await client.invoke('users@1.0.0', 'list', []);
  console.log('Visible users:', users.length);
  await client.invoke('auth@1.0.0', 'signOut', []);
  try {
    await client.invoke('users@1.0.0', 'list', []);
    throw new Error('A revoked session was accepted');
  } catch (error) {
    if (error.code !== 'UNAUTHORIZED' && error.statusCode !== 401 && error.status !== 401) throw error;
    console.log('Revoked session refused');
  }
} finally {
  await client.disconnect();
  auth.destroy();
}
JS
```

## What changed {#whats-new}

The API owns token issuance. Titan verifies each credential, resolves the current database session and supplies Netron with the caller's roles. The same policy applies to the web client in step 4. For several cooperating backends, see [Shared authentication](../omnitron/best-practices.md#shared-authentication-across-apps).

## Commit {#commit}

```bash
git add .
git commit -m "Add session authentication to the tutorial API"
```

## Troubleshooting {#troubleshooting}

| Result | Check |
| --- | --- |
| Startup rejects `JWT_SECRET` | Set the secret in the API process environment. |
| A request returns 401 | Check the bearer token's issuer, audience, expiration and live session. |
| A valid session receives 403 | Check the method policy and the current roles in PostgreSQL. |
| The authority returns 503 | Check the database connection and logs. Retry the request after recovery. |
