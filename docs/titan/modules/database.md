---
title: titan-database
---

# titan-database

SQL access through Kysely with migrations, multi-dialect support, and
optional row-level security helpers.

## Install

```bash
pnpm add @omnitron-dev/titan-database
```

## Setup

```typescript
import { DatabaseModule } from '@omnitron-dev/titan-database';

@Module({
  imports: [
    DatabaseModule.forRoot({
      dialect:        'postgres',     // 'postgres' | 'mysql' | 'sqlite'
      url:            env.DATABASE_URL,
      migrationsDir:  './migrations',
      pool:           { min: 2, max: 20 },
    }),
  ],
})
export class AppModule {}
```

## Use

Inject the typed Kysely instance:

```typescript
import type { Database } from './schema.js';   // your generated types

@Injectable()
export class UsersRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: string) {
    return this.db
      .selectFrom('users')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
  }
}
```

## Migrations

```bash
# In your project — backed by Kysely's migrator.
pnpm titan db:migrate up
pnpm titan db:migrate down
pnpm titan db:migrate status
```

Migrations live in `./migrations/` as `.ts` files implementing `up` and
`down`.

## Row-level security

For Postgres, the module exposes a `withRLS()` helper that scopes a
transaction to a session-level role:

```typescript
await db.withRLS({ userId, role: 'app_user' }, async (tx) => {
  return tx.selectFrom('orders').selectAll().execute();
});
```

The session sets `app.current_user_id` and `SET ROLE`, your RLS policies
read from those.
