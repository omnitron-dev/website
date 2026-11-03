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

Direct CLI migration writes require standalone lifecycle authority. On an enrolled controller, use the [backend schema plan](./cli.md#backend-replacement) for daemon schema changes. For a standalone ecosystem that provides package migration scripts, `omnitron infra migrate --dry-run` lists the resolved packages in dependency order.

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
    executedAtColumn: 'applied_at', checksumTable: 'schema_migration_checksums',
  }),
});
```

Text lock identities use PostgreSQL `hashtext`, compatible with applications
that previously used `pg_advisory_xact_lock(hashtext(...))`. Keep the identity
unchanged during a rolling deployment. New applications use an inline checksum
and a monotonic `execution_order`; existing journals must opt into their actual
layout. The adapter refuses a requested ordering column that does not exist.
PostgreSQL history lookup follows the connection’s `search_path`; an explicit
`schema` pins the journal to that schema. A configured checksum sidecar is created
only on writes; inspection never creates it. Custom `MigrationHistory` methods support existing storage constraints without
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

## Stack-owned migrations

A database dependency does not authorize schema changes. Declare one migration
owner by its application alias; the database name and package directory can differ:

```typescript
apps: [{ name: 'api-service', cwd: 'apps/api', bootstrap: 'src/bootstrap.ts' }],
infrastructure: {
  services: {
    postgres: {
      preset: 'postgres',
      config: {
        databases: {
          api: {
            migrate: [
              {
                app: 'api-service',
                config: 'src/database/portal.migrations.ts',
                releaseConfig: 'dist/database/portal.migrations.js',
              },
              {
                app: 'api-service',
                config: 'src/database/market.migrations.ts',
                releaseConfig: 'dist/database/market.migrations.js',
              },
            ],
          },
        },
      },
    },
  },
}
```

A single binding can be an object instead of an array. The `MigrationBinding` type
is exported from `@omnitron-dev/omnitron`. Each module exports the existing
`defineMigrationConfig` shown above. Its history adapter, checksum encoding and
lock remain independent; the array specifies execution order, not a merged journal.

`config` is relative to the application's declared `cwd`. The ordinary package
build must emit `releaseConfig` inside its compiled payload. Selected local releases
and remote deployments use that exact member of the verified artifact. Missing,
changed or escaping members refuse execution; an imported alias keeps its producer's
package. There is no fallback to a source checkout or another migrator.

The same normalized plan drives local startup, remote deployment and diagnosis.
Before provisioning, the local stack validates ownership, paths and resolved
connection destinations. Before the first migration connection, every config is
imported and its definitions are resolved in an isolated child. Definition factories
must only load definitions; `connect()` owns connection creation. Execution then uses
`executeMigrationOperation` from the application's own SDK. SQL and connection
callbacks can still fail at runtime; preflight is not proof that a migration will
succeed.

A config receives the complete resolved `DATABASE_URL`, including TLS and session
options. The database path must match the declared database. Query options cannot
replace the URL's host, port, database or credentials. Conflicting owners of the same
resolved destination refuse the plan. Managed vault resolution remains part of the
stack's existing environment contract; secrets never travel as command arguments.

All requested programs are prepared before executing any. A failed migration blocks
candidate application activation, and an interrupted migration is never retried
automatically. Previously committed registries remain committed: there is no global
transaction across registries or databases. Use compatible schema changes, backups,
and `status`/`verify` before deciding how to resume.

Explicit migration owners on remote stacks must occupy one unambiguous node, processed
before consumers. Several owners spread over different nodes are refused before
provisioning: the current deployment path has no global migration barrier. A replicated
application is not silently reduced to an arbitrary migration owner.

### Existing scripts

`migrate: true` preserves the conventional `src/database/migrate.ts` →
`dist/database/migrate.js` program, with the database name as its application alias.
For this compatibility spelling, an omitted/root `cwd` retains `apps/<database>`;
another declared `cwd` takes precedence. The script receives `DATABASE_URL` and the
original producer's app-prefixed connection fields. This legacy contract cannot
preserve URL query options and refuses them rather than dropping TLS or routing
settings. `migrationDir`, which never controlled execution, is refused with a remedy
to declare an explicit binding.

Absent or false opt-in means no migration. Remote nodes no longer infer permission
from `DATABASE_URL` or the presence of a conventional script. Legacy boolean bindings
describe each node's local database; use an explicit owner for a shared database.
Non-owning node allocations never provision or migrate their controller's services.

### Preview and diagnosis

```bash
omnitron infra migrate --stack dev --dry-run
omnitron infra migrate --stack dev
```

The standalone command uses the same declared targets and ordered configs. It reads
the application's and stack's explicit environment, or the invoking environment;
it does not invent connection defaults or retrieve a managed vault. An enrolled or
remote stack requires the elected controller. If no database migration policy exists,
the older explicitly invoked `infra migrate` path still runs workspace package
`migrate` scripts in dependency order. An explicit false policy never falls through
to those scripts.

Console and CLI stack diagnosis show owners and program availability without executing
configs or opening a database connection. Database access, schema compatibility and
migration completion remain separate evidence. Runtime workers should inspect their
required schema through the read-only runner API instead of applying DDL at startup.

## Programmatic use and responsibility boundaries

`executeMigrationOperation(config, options)` is the CLI's reusable operation
layer. It owns connection cleanup and returns integrity information. Direct
runners expose `up`, `upTo`, `down`, `reset`, `inspect`, `baseline` and
`adoptChecksums`. `createMigrationRunnerWithPlugins` adds lifecycle hooks without
changing the execution engine. Use `migrationSqlClient(db)` for parameterized SQL
on the runner's current connection. `loadMigrationFiles(directory)` shares the
Node file loader with the compatibility CLI and preserves explicit exported
checksums. `migrationLockKey(databaseName)` reproduces that CLI’s historical lock
identity for startup hooks; keep the same identity across all entry points.

Kysera remains independently installable and owns persistence mechanisms.
Titan adds DI, connection lifecycle and ambient transaction context. Omnitron
adds operational defaults, commands and diagnostics. Applications own schema
changes and domain-specific data transformations. The Console consumes RPC
results; it has no migration engine and never owns database credentials.

For recovery and notification delivery, see [Operational diagnostics](diagnostics.md).
