---
sidebar_position: 9
title: Cluster + Fleet
description: Multi-node Omnitron — leader election, state replication, fleet operations.
---

# Cluster + fleet

When you run Omnitron on more than one node, two subsystems
coordinate them: **cluster** (leader election, control-plane
consistency) and **fleet** (node inventory, cross-node queries).

This page covers both. Single-node operators can skip — none of
this runs without `cluster.enabled: true` or fleet nodes
registered.

Verified against `apps/omnitron/src/cluster/` and
`apps/omnitron/src/services/{fleet,sync,node-manager}.rpc-service.ts`.

## Two roles, two layers

| Layer | Concept | Service id |
| ----- | ------- | ---------- |
| Cluster | Leader / follower among a small set of daemons | `OmnitronCluster` |
| Fleet | Node inventory, cross-node fleet ops | `OmnitronFleet`, `OmnitronNodes` |
| State sync | Daemon-to-daemon batch replication | `OmnitronSync` |

A daemon in `role: master` is the control plane. A daemon in
`role: slave` runs autonomously and syncs back to master via
`OmnitronSync`. Optional cluster coordination observes the current database lease holder via
`OmnitronCluster`; it does not automatically transfer application ownership.

## When to use what

| Setup | Use |
| ----- | --- |
| Single machine, no HA needed | Neither — default `role: master`, no cluster |
| Multiple machines, no leader concept (each daemon independent) | Fleet — register nodes, query across them |
| Multiple controllers requiring a shared authority observation | Optional PostgreSQL lease coordination; external effects still require recipient fencing |
| Multi-region with autonomous edges syncing to a central master | Fleet + master-slave role pattern (no cluster needed) |

## PostgreSQL-authoritative coordination

`LeaderElection` now uses the optional
`@omnitron-dev/titan-database/coordination` provider. A row in
`titan_database_leases` records the controller identity, a fresh incarnation for
each process lifetime, a durable decimal epoch and the expiry measured by PostgreSQL.
Migration `016_cluster_lease` creates this table through Omnitron's migration facade.
The provider does not create tables during startup.

This replaces the former peer-election implementation. `requestVote` and
`leaderHeartbeat` are no longer RPC methods. A remote caller cannot announce itself
as leader, change a term or suppress elections. All remaining cluster RPC methods
require authenticated authority.

Acquisition and renewal commit synchronously. Contenders serialize through the
same database row; releasing a lease preserves the epoch rather than deleting it.
A new owner receives a higher epoch. An expired grant cannot be renewed, and an old
owner cannot release its successor's lease. Decimal strings preserve epochs above
JavaScript's safe integer range.

PostgreSQL supplies [conflict-aware insertion](https://www.postgresql.org/docs/current/sql-insert.html),
[row locking](https://www.postgresql.org/docs/current/explicit-locking.html) and
[the database clock](https://www.postgresql.org/docs/current/functions-datetime.html).
All contenders must use the same writable database. Its recovery/failover policy
must preserve committed epochs. This is database-backed coordination, not an
independent Raft quorum or a replicated Omnitron command log.

### Authority and effect fencing

A worker admits a managed stack stop only after verifying the controller's Ed25519
signature and reading the current lease on the writable PostgreSQL primary. The
signed plan binds the enrolled cluster and node, source project and stack, owner
revision, application generations, immutable container IDs and expiry. The worker
remembers the highest accepted epoch in its durable state. It checks authority
again between application shutdown, infrastructure retirement and container removal.
A lost lease can leave a partial stop. Inspect the per-node outcome and obtain a fresh
plan from the current leader before continuing. Work admitted before a transfer can
finish. An unreachable node stays unconfirmed.

Use `PostgresLeaseStore.withLease` for effects inside the same PostgreSQL transaction.
The recipient protocol supports `stack.stop` and `stack.resume-installed`.
Recovery binds the last node stop, application generations, retained release, launch
configuration and placement to a new signed operation. Each node checks the live
lease before opening its owner and before dispatching each launch. A launch already
admitted may finish across a leadership transfer. Later launches require current
authority. A recovery plan has a five-minute admission window. New deployments and infrastructure provisioning need separate recipient
adapters. See [Resume installed applications](./projects.md#resume-installed-applications). Stateful failover additionally
needs a fence enforced by the data service. See the [delivery gates](./release-readiness.md).

The controller bounds local freshness from **before** its database request, using
monotonic time and a wall-clock expiry guard for host suspension. A delayed reply
cannot start a new full lifetime. Database failure, lost renewal or expired
confirmation makes the controller a follower. Pending requests cannot revive it
after shutdown or an operator-requested step-down.

### Enroll a controller or worker

Apply Omnitron migration `016_cluster_lease` to the shared authority database.
Configure the daemon service environment with `OMNITRON_CLUSTER_DATABASE_URL`.
Give controllers `SELECT`, `INSERT` and `UPDATE` on `titan_database_leases`.
Workers require only `SELECT`. Remote connections require `sslmode=verify-full`.
Use a database failover policy that preserves acknowledged lease writes.

Set the following fields in the instance's private `$OMNITRON_HOME/config.json`.
Use the same cluster ID across participants and a unique, stable recipient ID per
installation. Pin each target's matching `nodeId` in its stack topology. A node's
address can change independently of the identity that accepted an allocation.

```json
{
  "cluster": {
    "enabled": true,
    "clusterId": "west",
    "recipientId": "edge-01",
    "discovery": "postgres",
    "leaseTtlMs": 15000,
    "heartbeatInterval": 2000
  }
}
```

The two timing fields are optional. Each lease must cover at least three heartbeat
intervals. Controllers also need a local fleet identity for election. A worker's
durable enrollment rejects a missing configuration or a different identity on restart.
Ordinary single-controller fleets can use the default disabled mode.

## `OmnitronCluster` RPC service

| Method | Auth | Effect |
| --- | --- | --- |
| `getClusterState()` | viewer/operator/admin or control-plane service | Coordination, authority reason, epoch, observed leader and lease freshness |
| `stepDown()` | administrator | Demote locally, release this epoch, and wait one lease interval before competing again |
| `isLeader()` | viewer/operator/admin or control-plane service | Whether this controller currently has a confirmed fresh grant |

```bash
omnitron cluster status
omnitron cluster step-down
```

The status includes `coordination: 'postgres-lease'`, `authority`, `reason`,
`leaseExpiresAt`, `leaseRemainingMs`, `effectFencing: 'recipient-required'` and
the recipient operations supported by this backend in `fencedOperations`.
Use `omnitron --json cluster status` in automation. `participant` distinguishes a
controller, enrolled worker and standalone daemon. Workers report their enrolled
identity. A legacy peer without the diagnostics service yields unknown participation
and a nonzero CLI exit status. The recovery preflight checks the process owner's
capabilities and retained evidence separately.
`term` is a decimal epoch string, or `null` when no authority has been observed.
An expired observation has no `leaderId`. The former `votedFor` field is removed.
CLI reports the same authority and reasons returned to Console's node diagnostics.

If a lease release cannot be confirmed, step-down reports failure; the local
controller remains demoted and the database lease expires normally. It never
claims that another controller has already taken over. Process shutdown also
invalidates pending acquisition/renewal results before releasing authority.

### Upgrade boundary

Prepare the additive schema expansion and retain a verified rollback artifact
before replacing a backend. Existing master/slave processes do not need cluster
coordination enabled. Do not mix legacy peer-election controllers and lease
controllers in an enabled control plane: disable the legacy election on all of
its participants before admitting the new coordination mode. This change alone
neither transfers running workloads nor proves a stateful failover safe.

## Config sync — `ConfigSyncService`

The daemon creates a configuration hash tracker when cluster startup succeeds on a controller.
The tracker exposes comparison and synchronization helpers. Automatic distribution
of ecosystem files between controllers is not wired into daemon startup. Provision
reviewed declarations on every controller independently.

## `OmnitronFleet` RPC service — node inventory

Distinct from clusters. A fleet is any set of registered nodes;
they don't need leader election.

| Method | Auth | Effect |
| ------ | ---- | ------ |
| `listNodes()` | viewer | All registered fleet nodes |
| `getNode({nodeId})` | viewer | One node by id |
| `getSummary()` | viewer | Aggregate health, counts |
| `registerNode(registration)` | operator | Add a node to the fleet |
| `removeNode({nodeId})` | operator | Remove |
| `setRole({nodeId, role})` | operator | Promote / demote |
| `drainNode({nodeId})` | operator | Drain workloads off this node |

### `FleetNode`

```typescript
interface FleetNode {
  id:       string;
  hostname: string;
  address:  string;
  role:     'master' | 'slave';
  status:   'online' | 'offline' | 'draining';
  lastSeen: number;
  // ... metadata (CPU/RAM snapshots, app counts)
}
```

### Fleet liveness

The master scheduler updates its own registered row at the configured health-check interval. Remote health and connectivity come from checks against registered nodes and authenticated mesh observations. A caller cannot update an arbitrary node’s liveness by supplying its ID.

The fleet's offline-detection threshold is driven by
`DEFAULT_DAEMON_CONFIG.healthMonitor.offlineTimeoutMs`
(`90_000 ms` default).

## `OmnitronNodes` — extended node management

The fleet service holds the live registry; `OmnitronNodes` holds
the **registered inventory** (declared nodes, SSH credentials,
health history). They overlap but serve different purposes.

Key method categories:

- **Inventory**: `listNodes`, `getNode`, `addNode`,
  `updateNode`, `removeNode`.
- **Connectivity**: `checkNodeStatus`, `checkAllNodes`,
  `triggerNodeCheck`.
- **History**: `getCheckHistory`, `getUptimeBar`,
  `getNodeHealthSummaries`.
- **SSH**: `listSshKeys`.
- **Check config**: `getCheckConfig`, `setCheckConfig`
  (ping/SSH/omnitron timeouts).

### Uptime bars

`getUptimeBar({nodeId, bucketCount?, intervalMs?})` returns
historical health bucketed into time segments. The webapp uses
this for the green/yellow/red availability bars.

| Param | Default (RPC method) |
| ----- | -------------------- |
| `bucketCount` | `60` |
| `intervalMs` | `300_000` (5 min per bucket) |

Each bucket reports ping / omnitron uptime as a `0.0–1.0`
percentage. (The daemon's health-monitor worker keeps a longer
retention window — `retentionDays: 90`, `uptimeIntervalMs:
86_400_000` — but those govern check storage, not this method's
default windowing.)

## State sync — `OmnitronSync` service

The master-slave replication mechanism. Slaves locally collect
metrics, logs, traces and alert events. The master pulls batches over the
authenticated Netron connection every 15 seconds, ingests them, then acknowledges
the accepted, duplicate or explicitly discarded IDs. Failed entries remain pending.

| Method | Effect |
| ------ | ------ |
| `drainBuffer({limit?})` | Slave-side: pull pending data without waiting for periodic sync |
| `ackDrained({ids, receipt?})` | Atomically release IDs and record their committed, discarded or unverified outcome |
| `getSyncStatus()` | Measured queue bytes/age, durable receipt history, contiguous progress and recorded losses |

### Connection credentials

For registered nodes, the controller always opens an Xec SSH tunnel to the daemon and presents its bearer token only to the numeric loopback listener. A reachable public TCP port alone permits a liveness probe. The built-in mesh dialer mints a five-minute `service_role` credential for each node. It renews that credential on the same Netron peer 30 seconds before expiry, coalescing concurrent calls and heartbeat reads. The SSH tunnel and running operations remain in place. The node independently checks the signed identity and its expiry on every invocation.

Credential renewal has a ten-second deadline. Failure prevents dispatch of the waiting operation and reconnects with a fresh credential; it does not replay an application mutation. A rejected signature clears the cached node signing secret, while a transport timeout does not claim the secret is wrong. Mesh status exposes `credentialExpiresAt`, `credentialRefreshedAt` and `lastCredentialError`, without credential material. CLI and Console distinguish an expired identity from a healthy authenticated connection.

Update the master before nodes when introducing per-call token expiry: older masters cannot renew an admitted peer's identity. A custom dialer can provide `refreshCredential` and `expiresAt`; non-renewable credentials require a new connection after expiry. A plain unauthenticated connection can probe liveness but cannot replicate.

Mesh authentication requires the remote daemon to confirm a `service_role` principal with a finite expiry. A ping proves reachability. Reading a release version for admission, polling an outbox and issuing commands all require the authenticated peer. Multiple registered node IDs pointing to the same daemon address leave that address unavailable for control until the registration is unambiguous.

Stack deployments use the same registered daemon host, port and optional node ID as the mesh. A registry or trust-store failure stops deployment before SSH dispatch.

For SSH bootstrap, compare the observed host fingerprint with an independently trusted copy before approving it. Automation uses the registered pin for the exact host, SSH port and user. Without a pin, Xec requires an existing matching entry in the controller account's `known_hosts`. A new machine needs an explicit trust decision before it can receive credentials. [Inspect and approve a host key.](./terminal.md#verify-the-host-before-connecting)

### Sync config — `ISyncConfig`

```typescript
interface ISyncConfig {
  interval?:  number;     // 30_000 ms between worker outbox maintenance runs
  batchSize?: number;     // 1_000 entries when a drain request omits its limit
}
```

Designed for **eventually consistent** replication:
- Slaves buffer enabled data categories in local SQLite WAL with `synchronous=FULL`. The configured byte budget can evict the oldest undelivered entries; these losses are recorded.
- Master pull resumes after authenticated reconnect; failed entries remain buffered.
- Connection retry uses exponential backoff; application processes continue independently.
- Idempotent batches — safe to retry.
- Conflict resolution: master timestamp wins for config; slave
  data is append-only.

### Sync flow

```mermaid
sequenceDiagram
  participant Slave
  participant Buffer as Slave buffer
  participant Master

  loop continuously
    Slave->>Buffer: append metric/log/trace/alert
  end
  loop master heartbeat (15s default)
    Master->>Slave: drainBuffer({limit: 1000})
    Slave->>Buffer: read pending entries
    Slave-->>Master: batch (entries remain pending)
    Master->>Master: ingest with deduplication
    alt confirmed outcome
      Master->>Slave: ackDrained({ids, receipt})
      Slave->>Buffer: acknowledge confirmed IDs
    else failure
      Master->>Master: retain diagnostic cause; retry later
    end
  end
```

If the master is offline, slave applications continue independently. Replication
retains data up to the configured buffer budget. When the master returns, pending
data drains on subsequent sweeps; the status also preserves evidence of any loss.

### Reading connection, backlog and delivery separately

`omnitron node check <id>` and the Console node details use the same interpretation.
A connected RPC channel proves reachability, not replication. A fresh status is
required before the master reports progress. An empty queue is drained; a recent
acknowledgement with a young queue is keeping up. Old pending data is catching up,
and a queue without a recent acknowledgement is behind. Durations are measured
on the source node so host clock skew does not invent lag.

New nodes report exact UTF-8 payload bytes. `bufferSize` covers pending payloads;
`retainedBufferSize` also includes released entries awaiting retention. Neither
is the filesystem size of SQLite, its indexes or WAL. A singleton maintained by
transactional triggers plus indexed seeks supplies status without scanning the
whole queue on each poll. Legacy schemas use a measured fallback.

The optional `evidence` object survives daemon replacement and normal retention:

| Field | Meaning |
| ----- | ------- |
| `epoch`, `since`, `firstTrackedId` | Scope of the recorded history; no guarantee is inferred for earlier data |
| `producedThrough` | Highest local sequence generated in this buffer |
| `releasedThrough` | Contiguous sequence no longer pending; may include discards or evictions |
| `committedThrough` | Contiguous durable payload receipts from `firstTrackedId`; stops at a pending, unverified or lost entry |
| `committedRows` | Entries confirmed by an initial database commit or later payload-bound reconciliation |
| `discardedRows` | Permanently rejected entries released after recording the refusal |
| `unverifiedRows` | Released entries without durable payload proof |
| `evictedRows` | Undelivered entries removed by local buffer limits |
| `lastCommittedAt`, `lastLossAt` | Persisted timestamps for confirmed commits and known loss |
| `reconciliation` | Later `verifiedRows`, `restoredRows`, `lastReconciledAt` and proof scope (`master` or `source`) |

A zero `unverifiedRows` count covers this recorded epoch from `firstTrackedId`.
Older buffered rows can have `syncOutcome = NULL` because their receiver predates
receipt accounting. That absence does not establish either persistence or loss;
they are outside this reconciliation frontier and are not silently certified.

These sequence fields are strings, preserving integer precision. The frontier
before the first tracked entry means no contiguous receipt has been proven yet.
Counters apply to the stated tracking epoch. Losses remain visible even when the
queue becomes empty; a restart or retention pass must not erase them.

The master persists each receipt's outcome in the same transaction as its data.
A lost reply and a repeated batch retain that outcome: a previous discard never
becomes a committed duplicate. If recording a discard fails, the source keeps
that entry pending. Starting with migration `015_persistent_metrics`, metrics are
written through Titan's PostgreSQL adapter in that same transaction. Successful
receipts therefore prove both the payload and its ledger entry committed. The
original measurement timestamp and authenticated source node are preserved.

On updated slave daemons, Titan's SQLite adapter writes chart history and the
replication outbox in one transaction. A failed outbox write rolls both back;
retries with the same sample IDs do not enqueue duplicates. This replaces the
polling watermark that could skip delayed samples. Chart retention never removes
undelivered outbox entries.

Historical `unverifiedRows` are not automatically promoted by an upgrade. An older
in-memory destination may have received values without persisting their original
samples. Older nodes can receive new durable receipts immediately, but need their
own backend update to gain the atomic local outbox. Buffer limits and known loss
counters continue to apply; see [metrics persistence diagnostics](./observability.md#metric-persistence-and-confirmation).

### Reconcile historical metric receipts

Use `omnitron --json node reconcile <node>` to inspect retained, released metric
entries. Add `--restore` when repairing the identified history is intended.
Pages are bounded by entries and bytes, fix the source epoch/frontier, and return
a keyset cursor. Normal collection and replication continue independently.

A sample matches only when its metric name, application, source node, labels,
original timestamp and value match. Resampled charts are not exact source samples.
Reusing an identity with different content fails the transaction. Missing history
is restored using the same stable sample identity and Titan PostgreSQL adapter as
normal ingestion. Restoring an old point does not replace the latest gauge value.

The master's `sync_reconciliations` journal records a new `present` or `restored`
proof, payload hash, sample identity, source epoch, original ledger outcome,
receipt ID and verification time. Restored samples, proofs and summary counters
commit together. The original `sync_ingested` claim is preserved: a repair today
does not prove that the legacy receiver committed data at its original delivery.

On the source, proof must match the still-retained immutable payload and epoch.
Its journal, the decrement of `unverifiedRows` and increase of `committedRows`
commit in one SQLite WAL/FULL transaction. The acknowledgement reserves the
SQLite writer before reading the source snapshot, so concurrent live ingestion
cannot invalidate a deferred read-to-write upgrade. Original `syncOutcome` and `syncedAt`
are unchanged. Repeated pages and lost responses cannot count or restore an entry
twice. Retry the same cursor after failure; no queue reset or database restore is
needed. Other categories, pruned payloads, rejected entries, conflicting content
and another epoch cannot be certified by this metric recovery path.

The optional journal has its own checksummed `sync_reconciliation_migrations`
history, using the public Omnitron migration runner through Titan/Kysera. It adds
two tables and leaves the core registry unchanged. A reviewed worker built with
the same code can reconcile an older node alongside its running daemon, without
changing application ownership or service units. Pin and verify the worker, use
the node's existing native dependencies, and test reopening its database with the
older runtime first. The normal CLI uses RPC and never installs a worker implicitly.

Restore respects `monitoring.metrics.historyMaxAge`; already committed data missing
after retention is not silently resurrected. A proof records a past commit, not
indefinite payload retention or replica/backup availability. Proof journals retain
hashes and identities independently of chart and queue retention, without full
payloads. While any unresolved historical gap or recorded loss remains, the
contiguous frontier is conservative and can stay at its former boundary. It
advances beyond that uncertainty only when all gaps are settled and no known loss
remains. CLI and Console distinguish verified/restored counts from unresolved
history; an unreadable proof journal remains an explicit diagnostic error.

### History before delivery receipts

Data before `firstTrackedId` has no original durable delivery proof. The ordinary
`node reconcile` command deliberately stays inside the tracked frontier. A
separate retained-history audit can establish what exists now without rewriting
the original claims or moving that frontier backwards.

Use this order when recovering legacy history:

1. Preserve consistent SQLite snapshots on their originating nodes before queue
   retention removes more evidence. Inventory older snapshots and PostgreSQL
   backups; exclude validation databases and synthetic smoke-test records.
2. Verify overlapping source identities against their complete content. Union
   repeated snapshots by the original buffer sequence or log UUID. Record source
   file hashes, exact time bounds, row counts and any missing sequence ranges.
3. Inspect bounded pages against the destination. A metric must match its original
   name, value, timestamp and normalized labels. A resampled gauge is not an
   original measurement. Old SQLite logs retained milliseconds rather than their
   transmitted microsecond sequence: compare at the retained precision, including
   all structured fields and the number of equal records.
4. Restore only missing eligible records. `reconcileHistoryPage` uses Titan's
   PostgreSQL transaction adapter; payloads, page proofs and progress counters
   commit together with durable PostgreSQL settings. Keep the authenticated
   transport, native runtime and memory/page budgets explicit in the reviewed
   maintenance worker. The daemon never installs or executes one implicitly.
5. Repeat a read-only content comparison after recovery. Preserve snapshots and
   the audit report, including any unresolved range or precision limitation.

Raw files can supply additional events absent from database snapshots. Preserve
the original files on their host, including a fixed byte range for active files.
Import only records with a trustworthy absolute timestamp and unambiguous event
identity. Check both full structured content and the existing event's time and
message before inserting: a metadata mismatch is an explicit unresolved case,
not permission to add a duplicate or overwrite the old row. Keep undated lines
and incomplete multi-line records archived; a physical-line count is not a count
of lost events.

A time/message collision can be resolved only with additional identity evidence.
For example, two adjacent lifecycle records may name different `workerId` values
at the same millisecond. Compare the original lines, their hashes and all stored
fields before treating them as two events. A different metadata value alone does
not establish whether the event is missing or the same event was transformed.

Record a reviewed recovery as a new `HistoryManifest` with `resolvesGap`:
`sourceId`, `gapIndex`, `gapDigest` (from `historyGapDigest`), `evidenceDigest` and
a concise `explanation`. The reference must match an already verified source on
the same node and category, with a known positive gap count equal to the new
source's expected count. The original manifest and page proofs remain unchanged.
Unknown counts, changed fingerprints, competing recoveries and expired records
cannot close a gap. Only the final transaction with every expected row and the
correct hash chain exposes the separate recovery proof. These are reviewed
maintenance operations, not a new RPC that accepts arbitrary resolution flags.

`sync_history_sources` stores immutable manifests and progress;
`sync_history_pages` stores ordered page hashes and commit results. Their separate
checksummed migration history uses the Omnitron/Titan/Kysera runner. Pages form a
hash chain whose final digest and total row count must match the source manifest.
A lost response can replay the same page; changed data, a broken chain or a
conflicting identity fails the transaction. A partial import remains explicitly
partial. Normal ingestion, live gauges, source counters and application ownership
are unaffected.

Inspect coverage with `omnitron node check <node>` or expand **History before
receipts · coverage and gaps** in the Console node diagnostics. Both read the same
`history` DTO: source time bounds, checked/expected rows, present/restored counts,
verification time, retained timestamp precision and explicit gaps. A recovered
gap displays its explanation, verification time and separate source ID under
`resolved`; unresolved gaps remain visible. A verified
source range does not certify earlier history. An unknown number of missing rows
stays unknown; an empty queue cannot turn it into zero.

Respect the configured retention policy during repair. Metric recovery refuses
points beyond its history horizon. Missing logs outside the selected log horizon
are counted as `expiredRows` and remain in the preserved source archives; they
are not reinserted just to be pruned again. Commit proofs describe an audit at a
particular time, not permanent retention of every payload. Database backups can
independently prove existing log UUIDs and their full content without creating a
second copy in the live table.

### Reproducible native node bundles

Prepare native daemon updates beside the running version. A bundle that includes `package-lock.json` is installed with `npm ci --omit=dev`; the installer refuses any change to that lock before publishing the candidate directory. Older bundles without a lock retain their installation path, but their transitive dependency versions are not frozen. Include and validate a lock when preparing a repeatable fleet rollout.

Installation and activation are separate. Installation verifies the archive hash, installs into a fresh sibling, executes its CLI, and records the resulting dependency tree. Reusing that version verifies its complete installation receipt. It does not repair a running release in place. Native dependencies must be built and tested against the target's OS, architecture and Node runtime; a macOS frozen runtime is not a Linux bundle.

A daemon that still owns application processes needs a controlled restart for a full node update. Capture the exact running and stopped application inventory, project boot policy, current framework version, service unit, private state and replication queue first. Each application must declare whether its dependencies are independent or provide a reversible framework-binding contract. Verify both the candidate binding and restoration of the previous binding on isolated copies before maintenance. Preserve application releases, credentials and data during rollback; never restore an old replication database over entries collected after the backup.

Before activation, Omnitron reads the on-disk bootstrap declarations of previously online applications with the candidate’s isolated reader, the serving Node executable, preload arguments, working directory and private environment. A failed read refuses the transition before any process is stopped or dependency is rebound; CLI and Console receive the same upgrade failure. The environment stays on the node and is not written into inventory or recovery receipts. Identical bootstrap paths are checked once, offline applications are not imported, and classic applications remain covered by their binding and health contracts. The read has a two-minute total deadline. This validates the loader against the current application bindings; it does not replace testing the candidate bindings on isolated copies.

A declaration read does not import every worker module. Before switching an isolated or pinned application runtime, verify its complete physical npm dependency graph as well as package hashes and native addons. A dependency declared as `process`, `buffer` or `events` is an npm package even though Node has a builtin with the same name; a manifest that substitutes the builtin can pass a hash check while failing on an import such as `process/`. Keep each registration’s verifier and dependency snapshot with its artifacts, and reject incomplete snapshots before stopping applications.

Update one node at a time. Verify every previously running application's health, RPC authentication and replication progress before moving to the next node. A running daemon alone does not satisfy this check. The [backend handoff workflow](./backend-handoff.md) becomes available only after a separately prepared resident-owner transition; a normal bundle upgrade does not silently change process ownership or the system account.

### Rolling upgrades and database replacement

Upgrade the master and nodes independently. New masters attach a versioned receipt
with `committedIds` and `discardedIds`; old nodes ignore the extra field. New nodes
still accept old acknowledgements, recording them as unverified. A worker that only pushes to a custom receiver needs to support authenticated pull before upgrading its controller. Check for a fresh mesh status and a new receipt before advancing the rollout.

Existing pending IDs stay unchanged during the SQLite migration. Newly appended
entries use a persistent random buffer epoch and sequence on the wire. A new local
database therefore cannot collide with the previous database's IDs in the master
ledger. A receipt from another epoch is refused. Restoring a database snapshot is
not equivalent to creating a new database: restore its entire state together and
coordinate replay with the master. Do not copy tables or reset sequences manually.

SQLite evidence uses the public Omnitron migration runner, backed by Titan and
Kysera. Schema changes and migration history commit together. The migration is
additive and has no destructive automatic rollback. Older masters can acknowledge
new node batches, but their receipts remain unverified. After a node starts emitting
epoch-qualified IDs, downgrading its binary requires an explicit compatibility
plan: an older producer would revert to numeric IDs and could resend a pending
entry under a different ledger key. Backend compatibility checks cover both
master and local-node migration registries. Master migration `014_replication_receipts`
marks historical outcomes unverified because previous discards cannot be inferred
reliably. The deduplication ledger has a retention window; it is not an unlimited
exactly-once archive.

## Multi-region patterns

Use a distinct cluster ID and authority database per independent region. A
single cross-region control plane requires every participant to reach the same
writable primary within its lease budget. Independently administered nodes can
use fleet inventory and replication without enrolling in a cluster.

## Connectivity loss and database failover

A partitioned controller loses its usable authority when renewal fails or the
local deadline passes. A worker that cannot read the authoritative primary
refuses a new stop effect. A readable standby cannot authorize a stop.
After a database recovery, compare the restored lease history with the epochs
accepted by recipients. An older epoch or a conflicting incarnation at the same
epoch requires reconciliation. Keep the existing application owners and inspect
the node receipts before retrying a partial operation.

## Operations

| Goal | Command |
| ---- | ------- |
| Check cluster state | `omnitron cluster status` |
| Release current leadership (administrator) | `omnitron cluster step-down` |
| Register a node | `omnitron node add --name N --host H ...` |
| Check all nodes | `omnitron node check` |
| Drain a node | `omnitron --json` then `OmnitronFleet.drainNode` (no CLI shortcut yet) |
| Per-node connectivity | `omnitron node check <id>` |
| Fleet status | `omnitron fleet status` |
| Fleet health | `omnitron fleet health` |
| Fleet metrics | `omnitron fleet metrics` |

## Anti-patterns

- **Treating an observed leader as authorization for a later effect.** Require
  a current epoch at the database transaction or remote recipient.
- **Independent databases for controllers in one coordination namespace.** All
  contenders must use one writable authority whose recovery preserves epochs.
- **Mixing legacy peer voting with PostgreSQL leases.** Transition all enabled
  participants through a reviewed plan before admitting coordinated work.
- **Deleting expired lease rows.** This resets fencing epochs; release ownership
  without deleting its history.
- **Unbounded pool/lock waits.** Configure finite pool acquisition deadlines;
  lease operations already bound SQL statements and lock waits.
- **Treating `OmnitronSync` as low-latency RPC.** It's batch
  replication with a nominal 15 s master pull cadence. For real-time
  cross-daemon coordination, use direct RPC to the relevant
  service.
- **Editing a slave's `state.json` and expecting it to propagate.**
  Slaves are downstream of master config. Edits get overwritten on
  next sync.

## See also

- [Architecture](./architecture.md#cluster-subsystem) — where
  cluster fits
- [CLI](./cli.md#cluster-leader-election) — `omnitron cluster ...`
- [Services reference](./services-reference.md) — `OmnitronFleet`,
  `OmnitronSync`, `OmnitronNodes`, `OmnitronCluster`
- [Daemon](./daemon.md#daemon-configuration) — cluster config fields
