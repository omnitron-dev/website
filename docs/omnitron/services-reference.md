---
sidebar_position: 6
title: Services reference
description: Every RPC service exposed by the daemon — names, methods, roles.
---

# Services reference

The Omnitron daemon registers **19 built-in Netron RPC services** plus
the `OmnitronDaemon` service itself. All share the same auth model
(see [Daemon / Auth flow](./daemon.md#auth-flow)) and address the
same socket / TCP / HTTP planes.

This page is the canonical inventory: service name, registered
Netron service id, purpose, and key methods.

Re-check this page against the source with
`node scripts/check-services-reference.mjs <path-to-omni>` — it
reads `@Service`/`@Public` out of `src/**/*.rpc-service.ts` and
diffs them against the index table below.

That script exists because this paragraph used to read "verified
against `src/services/*.rpc-service.ts`" while six counts
undercounted — every one of them a method added after the page was
written — and `OmnitronCluster` was missing altogether. A claim of
verification is the one sentence on a page that nothing can check,
so it is the one that drifts furthest; the remedy is a command a
reader can run, not a stronger assurance.

## Quick index

| File | Service id (Netron) | Methods | Role gate (typical) |
| ---- | ------------------- | ------- | ------------------- |
| `alert.rpc-service.ts` | `OmnitronAlerts` | 8 | viewer (read) + operator (mutate) |
| `auth.rpc-service.ts` | `OmnitronAuth` | 7 | mixed (5 allowAnonymous; 2 authenticated) |
| `backup.rpc-service.ts` | `OmnitronBackups` | 10 | viewer (read) + admin (mutate) |
| `deploy.rpc-service.ts` | `OmnitronDeploy` | 4 | viewer (history) + operator (deploy/rollback) |
| `discovery.rpc-service.ts` | `OmnitronDiscovery` | 3 | viewer |
| `event-broadcaster.rpc-service.ts` | `OmnitronEvents` | 4 | viewer (sub/stats) + admin (pushEvent) |
| `fleet.rpc-service.ts` | `OmnitronFleet` | 8 | viewer (read) + operator (mutate); heartbeat anonymous |
| `health-check.rpc-service.ts` | `OmnitronHealth` | 4 | viewer |
| `infrastructure.rpc-service.ts` | `OmnitronInfra` | 7 | viewer (read) + operator (start/stop/remove) |
| `kubernetes.rpc-service.ts` | `OmnitronKubernetes` | 9 | admin |
| `log-collector.rpc-service.ts` | `OmnitronLogs` | 4 | viewer |
| `node-manager.rpc-service.ts` | `OmnitronNodes` | 14 | viewer (read) + operator (mutate) |
| `pipeline.rpc-service.ts` | `OmnitronPipelines` | 8 | viewer (read) + operator (mutate) |
| `project.rpc-service.ts` | `OmnitronProject` | 14 | viewer (read) + operator (start/stop) + admin (CRUD) |
| `secrets.rpc-service.ts` | `OmnitronSecrets` | 4 | admin |
| `sync.rpc-service.ts` | `OmnitronSync` | 4 | service-to-service (getSyncStatus is viewer) |
| `system-info.rpc-service.ts` | `OmnitronSystemInfo` | 1 | viewer |
| `telemetry.rpc-service.ts` | `OmnitronTelemetry` | 2 | pushBatch anonymous; getRelayStats viewer |
| `trace-collector.rpc-service.ts` | `OmnitronTraces` | 5 | viewer |

And, only when `daemon.cluster.enabled` is set on a master:

| File | Service id (Netron) | Methods | Role gate |
| ---- | ------------------- | ------- | --------- |
| `cluster/cluster.rpc-service.ts` | `OmnitronCluster` | 5 | viewer (state) + **unauthenticated** (`requestVote`, `leaderHeartbeat`) |

Plus the core supervisor:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `daemon/daemon.rpc-service.ts` | `OmnitronDaemon` | 25 | mixed — see [Daemon](./daemon.md#rpc-surface--omnitrondaemon-service) |

And two the daemon does not declare at all — they come from Titan
modules it imports, and are registered by those modules:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `packages/titan-metrics/src/rpc-service.ts` | `OmnitronMetrics` | 6 | **3 anonymous** (`getSnapshot`, `querySeries`, `getPrometheusText`) + authenticated (`cleanup`, `flush`, `evictApp`) |
| `packages/titan-health/src/health.rpc-service.ts` | `Health@1.0.0` | 7 | **all 7 anonymous** |

Both are worth knowing about for a reason beyond completeness: they are
the daemon's anonymous surface. Ten of their thirteen methods answer
without credentials, because `allowAnonymous` is declared in the
packages and the daemon cannot override it. That is harmless while
`daemon.host` is `127.0.0.1` and an exposure the moment it is not —
`omnitron doctor` reports it as `auth.anonymous-surface`.

## Naming convention

Most service ids use the `Omnitron<Subsystem>` PascalCase shape with no
version suffix. `Health@1.0.0` is the exception, and it is not going to
be renamed: the id is Netron's own versioned form, declared by
`@omnitron-dev/titan-health` for every application that imports the
module, so it is not omnitron's to change. Query it with the suffix
included.

## What `availableServices` lists

When a `query_interface` fails, the daemon logs the ids it does have.
That list is a **superset** of this page: managed applications register
their own services into the same Netron registry, so a host running
`daos` shows entries like `TransformWorker` alongside the daemon's own.
A name in that list is not evidence of a daemon service, and its absence
from this page is not evidence of a gap.

Query services via Netron's standard interface mechanism:

```typescript
import type { IProjectRpcService } from '@omnitron-dev/omnitron/dto/services';

const peer = await netron.connect('unix://~/.omnitron/daemon.sock');
const project = await peer.queryInterface<IProjectRpcService>('OmnitronProject');
const projects = await project.listProjects();
```

The CLI and webapp do exactly this under the hood. Typed client
interfaces are published from the `@omnitron-dev/omnitron/dto/services`
subpath (`IDaemonService`, `IProjectRpcService`, `IOmnitronAuthService`,
`IOmnitronLogsService`, `IInfraService`); other services can be queried
untyped via `queryInterface(serviceId)`.

## Per-service summary

Each subsection lists the methods you can call directly. For full
parameter and return types, refer to `src/services/<name>.rpc-service.ts`
and the `src/shared/dto/` types it imports.

### `OmnitronAlerts` — `alert.rpc-service.ts`

Alert rules + delivery for operator-defined thresholds (metric
exceeds value, app crashed N times, etc.).

| Method | Effect |
| ------ | ------ |
| `getRules()` | All alert rules |
| `createRule(...)` | Define a new rule |
| `updateRule({id, updates})` | Patch a rule |
| `deleteRule({id})` | Remove a rule |
| `getEvents({ruleId?, status?, limit?})` | Fired-alert events |
| `acknowledgeAlert({alertId, acknowledgedBy})` | Mark as acknowledged |
| `getActiveAlerts()` | Currently firing, unresolved alerts |
| `getSummary()` | Aggregate counts (open / acknowledged / resolved) |

### `OmnitronAuth` — `auth.rpc-service.ts`

User authentication, session management, JWT issuance.

| Method | Effect |
| ------ | ------ |
| `signIn(credentials)` | Begin a session; returns JWT + session id |
| `validateToken({token})` | Verify a JWT; returns claims |
| `validateSession({sessionId})` | Verify a session id |
| `refreshSession({sessionId})` | Renew session expiry |
| `signOut({sessionId})` | Drop session |
| `getActiveSessions()` | List the caller's own active sessions |
| `changePassword({oldPassword, newPassword})` | Self-service password change |

`signIn`, `validateToken`, `validateSession`, `refreshSession`, and
`signOut` are all `allowAnonymous` (the session id / token is the
credential). `getActiveSessions` and `changePassword` are
`@Public({ auth: true })` — any authenticated caller, operating on
its own identity (not admin-gated).

### `OmnitronBackups` — `backup.rpc-service.ts`

Database backup, restore, scheduling.

| Method | Effect |
| ------ | ------ |
| `createBackup({database, compress?})` | One-shot backup of one database |
| `createAllBackups(...)` | Back up every registered database |
| `createFullBackup(...)` | Full backup including non-database state |
| `listBackups({database?})` | List available backups |
| `restoreBackup({backupId})` | Restore from a backup |
| `deleteBackup({backupId})` | Drop a backup file |
| `setSchedule({database, cron})` | Configure recurring backups |
| `getSchedule({database})` | Read current schedule |
| `listSchedules()` | Every configured schedule |
| `removeSchedule({database})` | Drop a schedule |

Driven by `omnitron backup` commands. Reads (`listBackups`,
`getSchedule`, `listSchedules`) gate on `viewer`; every mutation
requires `admin`.

### `OmnitronDeploy` — `deploy.rpc-service.ts`

App deployment workflows.

| Method | Effect |
| ------ | ------ |
| `deployApp({app, version, strategy?, deployedBy?})` | Run a deploy with the chosen strategy |
| `rollback({app, deployedBy?})` | Roll back to previous version |
| `getHistory({app?, limit?})` | Deployment history |
| `listDeployableApps()` | Apps this daemon can deploy |

Strategies: `rolling | all-at-once | blue-green | canary`.

### `OmnitronDiscovery` — `discovery.rpc-service.ts`

Discovery of Omnitron-managed targets across Docker and SSH.

| Method | Effect |
| ------ | ------ |
| `discoverContainers()` | Scan local Docker |
| `discoverNodes({hosts})` | SSH-scan given hosts |
| `scanAll()` | Combined scan |

Used by `omnitron discover`.

### `OmnitronEvents` — `event-broadcaster.rpc-service.ts`

Cross-process event bus over Netron. Webapp subscribes here for
live UI updates.

| Method | Effect |
| ------ | ------ |
| `subscribe({channels, ...})` | Register a subscriber; returns `subscriberId` |
| `unsubscribe({subscriberId})` | Drop subscription |
| `pushEvent({channel, payload})` | Publish an event (admin-only; test/admin path) |
| `getStats()` | Subscriber count + per-channel stats |

`subscribe` / `unsubscribe` / `getStats` gate on `viewer`;
`pushEvent` requires `admin`.

### `OmnitronFleet` — `fleet.rpc-service.ts`

Cross-node fleet operations: register nodes, drain, set roles.

| Method | Effect |
| ------ | ------ |
| `listNodes()` | All registered nodes |
| `getNode({nodeId})` | Inspect one node |
| `getSummary()` | Aggregate health / counts |
| `registerNode(registration)` | Add a node to the fleet |
| `removeNode({nodeId})` | Remove |
| `setRole({nodeId, role})` | Promote / demote a node |
| `drainNode({nodeId})` | Drain workloads off a node |
| `heartbeat({nodeId})` | Node liveness ping (called by remote daemons) |

Reads (`listNodes`, `getNode`, `getSummary`) gate on `viewer`;
mutations (`registerNode`, `removeNode`, `setRole`, `drainNode`)
on `operator`. `heartbeat` is `allowAnonymous` — follower daemons
call it before they hold a token.

### `OmnitronHealth` — `health-check.rpc-service.ts`

Active health probes — runs HTTP / TCP / DB checks on demand.

| Method | Effect |
| ------ | ------ |
| `checkApp({appName, port?})` | Probe one app |
| `checkApps()` | Probe every app |
| `checkInfrastructure()` | Probe Postgres / Redis / etc. |
| `checkAll()` | Full platform health report |

### `OmnitronInfra` — `infrastructure.rpc-service.ts`

Read-only inventory of provisioned infrastructure.

| Method | Effect |
| ------ | ------ |
| `getState()` | Full infrastructure state (containers, env, networks) |
| `listContainers()` | All managed containers |
| `getConnectionInfo({service})` | Resolved host / port / creds for a logical service |
| `getContainerLogs({container, tail?})` | Tail one container's logs |
| `startContainer({container})` | Start a managed container |
| `stopContainer({container})` | Stop a managed container |
| `removeContainer({container})` | Remove a managed container |

Reads gate on `viewer`; `startContainer`, `stopContainer` and
`removeContainer` on `operator`.

### `OmnitronKubernetes` — `kubernetes.rpc-service.ts`

Kubernetes integration.

| Method | Effect |
| ------ | ------ |
| `listPods({namespace?, labelSelector?})` | List pods |
| `getPod({name, namespace?})` | One pod |
| `deletePod({name, namespace?})` | Delete pod |
| `getPodLogs({name, namespace?, tail?})` | Tail logs |
| `listDeployments({namespace?})` | List deployments |
| `scaleDeployment({name, replicas, namespace?})` | Scale |
| `restartDeployment({name, namespace?})` | Rolling restart |
| `listServices({namespace?})` | List services |
| `execInPod({pod, command, namespace?})` | Run command in pod |

Driven by `omnitron k8s ...`. Every method requires `admin`.

### `OmnitronLogs` — `log-collector.rpc-service.ts`

Log query + streaming.

| Method | Effect |
| ------ | ------ |
| `queryLogs({app?, level?, search?, labels?, traceId?, from?, to?, limit?, offset?})` | Filter logs |
| `getLogStats()` | Per-app log size + rotation stats |
| `getIngestionStats()` | Ingested / dropped totals and buffer depth |
| `streamLogs({app?, level?, search?, tail?, since?})` | Last `tail` entries, oldest-first (default 100) |

`omnitron logs` calls `queryLogs` or `streamLogs`. Note the
full-text filter is `search`, not `grep`, and `streamLogs` is a
poll — it returns a page ending at now, it does not hold a
subscription open.

### `OmnitronNodes` — `node-manager.rpc-service.ts`

Node inventory + health history (14 methods — the largest service
beyond `OmnitronDaemon`).

| Method category | Methods |
| --------------- | ------- |
| Inventory | `listNodes`, `getNode`, `addNode`, `updateNode`, `removeNode` |
| Checks | `checkNodeStatus`, `checkAllNodes`, `triggerNodeCheck` |
| History | `getCheckHistory`, `getUptimeBar`, `getNodeHealthSummaries` |
| Misc | `listSshKeys`, `getCheckConfig`, `setCheckConfig` |

Includes the uptime-bar machinery the webapp uses to draw
green/yellow/red availability bars.

### `OmnitronPipelines` — `pipeline.rpc-service.ts`

CI/CD pipeline definition and execution.

| Method | Effect |
| ------ | ------ |
| `createPipeline(definition)` | Define a pipeline |
| `getPipeline({id})` | Read one pipeline |
| `listPipelines()` | List all |
| `deletePipeline({id})` | Drop a pipeline |
| `executePipeline({id, params?})` | Trigger a run |
| `cancelRun({runId})` | Cancel a running pipeline |
| `getRunStatus({runId})` | One run's status |
| `listRuns({pipelineId?, limit?})` | Run history |

### `OmnitronProject` — `project.rpc-service.ts`

Project + stack registry. 14 methods covering both layers.

| Method category | Methods |
| --------------- | ------- |
| Projects | `listProjects`, `getProject`, `scanRequirements`, `addProject`, `updateProject`, `removeProject` |
| Project apps | `getProjectApps` |
| Stacks | `listStacks`, `getStack`, `getStackStatus`, `createStack`, `deleteStack`, `startStack`, `stopStack` |

Roles: all reads (`listProjects`, `getProject`, `scanRequirements`,
`getProjectApps`, `listStacks`, `getStack`, `getStackStatus`) gate on
`viewer`; `startStack` / `stopStack` on `operator`; project CRUD
(`addProject`, `updateProject`, `removeProject`) and stack CRUD
(`createStack`, `deleteStack`) on `admin`.

### `OmnitronSecrets` — `secrets.rpc-service.ts`

Encrypted secret CRUD.

| Method | Effect |
| ------ | ------ |
| `get({key})` | Decrypt and read one |
| `set({key, value})` | Encrypt and store |
| `delete({key})` | Remove |
| `list()` | List keys (values hidden) |

Always gated by `admin` role.

### `OmnitronSync` — `sync.rpc-service.ts`

Cross-daemon state synchronisation (service-to-service, used in
cluster mode).

| Method | Effect |
| ------ | ------ |
| `receiveBatch(batch)` | Accept a sync batch from another daemon |
| `drainBuffer({limit?})` | Pull pending sync data |
| `ackDrained({ids})` | Acknowledge what the caller has durably taken |
| `getSyncStatus()` | Current sync state |

`receiveBatch`, `drainBuffer` and `ackDrained` gate on `['admin',
'operator', 'service_role']` (daemon-to-daemon over TCP);
`getSyncStatus` is `viewer` (webapp monitoring). Not typically
called directly by operators.

:::caution The slave side has no production caller
`SyncService.setMasterConnection()` — the injection point that
gives a slave daemon its channel to the master — is called only
from tests. Nothing in `src/` wires it, so on a real slave the
sync service buffers to its local WAL and never delivers. The
server half documented above is reachable and correct; the client
half is not connected.
:::

### `OmnitronSystemInfo` — `system-info.rpc-service.ts`

Host inventory.

| Method | Effect |
| ------ | ------ |
| `getSnapshot()` | CPU / RAM / disk / OS info |

The webapp uses this for the host-info card.

### `OmnitronTelemetry` — `telemetry.rpc-service.ts`

Telemetry ingestion endpoint for `titan-telemetry-relay`
aggregator role. Apps push batches here; the daemon stores and
aggregates.

| Method | Effect |
| ------ | ------ |
| `pushBatch({nodeId, entries})` | Follower daemon pushes batch; returns `{ ackd }` count |
| `getRelayStats()` | Internal relay stats |

`pushBatch` is `allowAnonymous` (follower daemons call it over TCP
before holding a token); `getRelayStats` gates on `viewer` (webapp
monitoring).

### `OmnitronCluster` — `cluster/cluster.rpc-service.ts`

Leader election (Raft-shaped) across master daemons. Registered
only when `daemon.cluster.enabled` is set, and only on a master.

| Method | Effect |
| ------ | ------ |
| `requestVote({candidateId, term})` | Vote in an election |
| `leaderHeartbeat({leaderId, term})` | Leader liveness, resets the follower's election timer |
| `getClusterState()` | This node's term, state, leader and peer count |
| `stepDown()` | Relinquish leadership |
| `isLeader()` | Whether this node currently leads |

Peers call the first two over plain HTTP at the daemon's RPC port
with no credential, so both are `allowAnonymous`; `getClusterState`
gates on `viewer`. `LeaderElection` rejects a vote or a heartbeat
whose `candidateId` / `leaderId` is not in the fleet registry,
which stops an arbitrary outsider — but a node id is discoverable
and forgeable, so this is membership, not authentication. Keep
`daemon.host` at its loopback default unless the fleet plane is on
a trusted network.

### `OmnitronTraces` — `trace-collector.rpc-service.ts`

Distributed trace ingestion + query.

| Method | Effect |
| ------ | ------ |
| `ingestSpan(span)` | Push a single span |
| `ingestBatch({spans})` | Push many |
| `getTrace({traceId})` | One trace |
| `queryTraces(filter)` | Filter by service / duration / status / time range |
| `getServiceMap()` | Derived service-call topology |

## Auth role recap

| Role        | Members                            | Typical capability |
| ----------- | ---------------------------------- | ------------------ |
| `viewer`    | `viewer`, `operator`, `admin`      | Read-only inspection |
| `operator`  | `operator`, `admin`                | Lifecycle + scale + exec |
| `admin`     | `admin` only                       | Destructive: shutdown, secrets, role changes |
| anonymous   | anyone with socket access          | `ping`, the `OmnitronAuth` endpoints, `OmnitronFleet.heartbeat`, `OmnitronTelemetry.pushBatch` |

Methods on the same service can vary in role:
- `OmnitronAuth.signIn` is anonymous;
  `OmnitronAuth.getActiveSessions` requires any authenticated caller
  (`@Public({ auth: true })`), operating on the caller's own identity
  — not admin-gated.
- `OmnitronProject.listProjects` is viewer;
  `OmnitronProject.startStack` is operator; `OmnitronProject.deleteStack`
  is admin.

## Querying a service from your code

```typescript
import { Netron } from '@omnitron-dev/titan/netron';
import { createNullLogger } from '@omnitron-dev/titan/module/logger';
import type {
  IProjectRpcService,
  IDaemonService,
} from '@omnitron-dev/omnitron/dto/services';

// `Netron` takes a logger — pass your application's, or
// `createNullLogger()` to discard Netron's own output. `create` also
// starts it, which `connect` requires.
const netron = await Netron.create(createNullLogger());
const peer   = await netron.connect('unix://~/.omnitron/daemon.sock');

const project = await peer.queryInterface<IProjectRpcService>('OmnitronProject');
const projects = await project.listProjects();

// Services without a published interface are queried untyped:
const deploy = await peer.queryInterface('OmnitronDeploy');
await deploy.deployApp({ app: 'api', version: 'v1.2.3', strategy: 'rolling' });
```

The same code works against a remote daemon by swapping the URL
(`tcp://server:9700`).

## Anti-patterns

- **Calling mutating methods over the public TCP plane without
  RBAC.** Operator-level methods change app state — expose only
  behind proper auth.
- **Long-running calls on RPC.** Some methods (deploy, backup
  restore) can run for minutes — prefer fire-and-forget patterns
  (start the run; poll status) over a long-held RPC.
- **Hand-rolling JSON for `pushBatch` / `ingestBatch`.** The
  contract types are exported — use them; the wire format may
  evolve.
- **Treating `OmnitronSync` as a public API.** It's daemon-to-
  daemon plumbing. The shape may change between releases without
  notice.

## See also

- [Daemon](./daemon.md) — the `OmnitronDaemon` service + auth model
- [Architecture](./architecture.md) — where these services live
- [CLI](./cli.md) — most commands map directly to one method here
- [Console](./console.md) — webapp uses the same services
