---
title: Database migrations
---

Use `@omnitron-dev/omnitron/migration` for migration definitions, execution and
inspection. `omnitron migrate` uses that same API. Applications do not need a
separate Kysera dependency or a second migration CLI.

## Start with one configuration

Install Omnitron and the driver your application uses. This PostgreSQL example
borrows a pool through a narrow adapter; it does not initialize Titan DI or start
the daemon.

```typescript title="omnitron.migrations.ts"
import { Pool } from 'pg';
import {
  defineMigrationConfig, defineSqlMigration, createPostgresMigrationDatabase,
} from '@omnitron-dev/omnitron/migration';
import { describeError } from '@omnitron-dev/omnitron/diagnostics';

export default defineMigrationConfig({
  name: 'application',
  migrations: [
    defineSqlMigration('001_widgets',
      'CREATE TABLE widgets (id integer PRIMARY KEY, label text NOT NULL)',
      'DROP TABLE widgets'),
  ],
  async connect() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
      connectionTimeoutMillis: 5_000 });
    pool.on('error', error => console.error(describeError(error)));
    const db = createPostgresMigrationDatabase(pool);
    return { db, close: async () => { try { await db.destroy(); } finally { await pool.end(); } } };
  },
});
```

```bash
omnitron migrate status
omnitron migrate up --dry-run
omnitron migrate up
omnitron --json migrate verify
omnitron migrate down --steps 1
```

`--config path/to/config.ts` selects another configuration. The default command
is `status`; inspection never applies migrations. `--daemon` explicitly selects
the daemon's registry and database. It cannot be combined with `--config`.
`--to NAME` applies an inclusive prefix; `--steps N` is valid only for `down`.
Invalid or conflicting arguments fail before opening a database.

`verify` exits with 2 for changed definitions, missing files **or unknown
checksums**. A successful operation exits with 0; other failures use a nonzero
exit code and include the cause and recovery guidance. JSON output uses the
normal Omnitron `{ ok, data }` / `{ ok: false, error, diagnostic }` contract.

## Guarantees and limits

| Mechanism | Behavior |
| --- | --- |
| Execution | Kysera owns the single engine, including CLI and Titan compatibility APIs |
| PostgreSQL locking | One pinned connection holds the advisory lock and executes migrations; a one-connection pool works |
| Default atomicity | Each migration body, history row and checksum commit together |
| Batch atomicity | `transactionMode: 'batch'` commits the whole operation together; requires transactions and stopping on errors |
| Inspection | `status`, `inspect` and dry runs do not create tables or adopt history |
| Integrity | SQL definitions have content digests; arbitrary callbacks must provide a stable `checksum` |
| Rollback | Missing definitions or missing `down` handlers reject the entire plan before any rollback |
| Retry | No blind retry after an ambiguous connection failure; inspect durable history first |
| Cleanup | Commands close their owned connections and preserve both operation and cleanup failures |

PostgreSQL and SQLite support transactional schema changes. MySQL DDL can commit
implicitly, so batch mode refuses MySQL. SQLite has no cross-process advisory
lock: concurrent writers can fail with a busy error. Serialize deployments and
handle that failure explicitly. A process that owns a driver pool must observe
its asynchronous error events as well as rejected query promises.

Batch mode takes a root database handle, not a caller-owned transaction. Plugin
completion hooks run after the batch commits. `MigrationHookError.applied` means
the database change committed even though its observer failed: do not rerun the
migration body to repair an observer.

## Adopt an existing application

Preserve the deployed journal, version names, checksum encoding and lock
identity. Do not create a second journal or infer execution from tables existing.

```typescript
import { createMigrationRunner, createMigrationHistory } from '@omnitron-dev/omnitron/migration';

const runner = createMigrationRunner(db, migrations, {
  advisoryLockKey: 'application.schema',
  history: createMigrationHistory({
    tableName: 'schema_migrations', keyColumn: 'version', keyType: 'integer',
    executedAtColumn: 'applied_at',
  }),
});
```

Text lock identities use PostgreSQL `hashtext`, compatible with applications
that previously used `pg_advisory_xact_lock(hashtext(...))`. Keep the identity
unchanged during a rolling deployment. New applications use an inline checksum
and a monotonic `execution_order`; existing journals must opt into their actual
layout. The adapter refuses a requested ordering column that does not exist.
Custom `MigrationHistory` methods support existing storage constraints without
reimplementing execution, transactions or locking.

A checksum-less historical row is **unverified**, not proof of unchanged source.
After reviewing the applied artifacts, use the runner's explicit
`adoptChecksums()` or `baseline(names)` APIs. Both take the migration lock;
neither overwrites an existing digest. A baseline records execution without
running the migration body, so it requires evidence that the schema already
matches.

`createHardenedRunner` and `runMigrationCli` preserve the previous Titan journal,
lock and function-source checksum format for existing deployments. Its
trust-on-first-use and rollback-drift behavior remain compatibility policies;
new applications should use `createMigrationRunner`. Legacy error constructors
are exported as `LegacyMigrationLockError` and `LegacyMigrationChecksumError`.

## Programmatic use and responsibility boundaries

`executeMigrationOperation(config, options)` is the CLI's reusable operation
layer. It owns connection cleanup and returns integrity information. Direct
runners expose `up`, `upTo`, `down`, `reset`, `inspect`, `baseline` and
`adoptChecksums`. `createMigrationRunnerWithPlugins` adds lifecycle hooks without
changing the execution engine. Use `migrationSqlClient(db)` for parameterized SQL
on the runner's current connection.

Kysera remains independently installable and owns persistence mechanisms.
Titan adds DI, connection lifecycle and ambient transaction context. Omnitron
adds operational defaults, commands and diagnostics. Applications own schema
changes and domain-specific data transformations. The Console consumes RPC
results; it has no migration engine and never owns database credentials.

For recovery and notification delivery, see [Operational diagnostics](diagnostics.md).
