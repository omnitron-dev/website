---
sidebar_position: 6
title: Services reference
description: Every RPC service exposed by the daemon — names, methods, roles.
---

# Services reference

The Omnitron daemon exposes the RPC services below. Some are conditional
on enabled modules or daemon configuration. All share the same auth model
(see [Daemon / Auth flow](./daemon.md#auth-flow)) and address the
same socket / TCP / HTTP planes.

This page is the canonical inventory: service name, registered
Netron service id, purpose, and key methods.

Re-check this page against the source with
`node scripts/check-services-reference.mjs <path-to-omni>` — it
reads `@Service`/`@Public` out of `src/**/*.rpc-service.ts` and
diffs them against the index table below.

## Quick index

| File | Service id (Netron) | Methods | Role gate (typical) |
| ---- | ------------------- | ------- | ------------------- |
| `daemon/backend.rpc-service.ts` | `OmnitronBackend` | 2 | control-plane read (status); local Unix admin (control address) |
| `access.rpc-service.ts` | `OmnitronAccess` | 5 | viewer (effective permissions) + admin (accounts) |
| `terminal.rpc-service.ts` | `OmnitronTerminal` | 9 | admin + live human session / trusted local CLI |
| `alert.rpc-service.ts` | `OmnitronAlerts` | 8 | viewer (read) + operator (mutate) |
| `audit.rpc-service.ts` | `OmnitronAudit` | 2 | admin |
| `auth.rpc-service.ts` | `OmnitronAuth` | 7 | mixed (5 allowAnonymous; 2 authenticated) |
| `backup.rpc-service.ts` | `OmnitronBackups` | 11 | viewer (read) + admin (mutate) |
| `deploy.rpc-service.ts` | `OmnitronDeploy` | 4 | viewer (history) + operator (deploy/rollback) |
| `discovery.rpc-service.ts` | `OmnitronDiscovery` | 3 | viewer |
| `event-broadcaster.rpc-service.ts` | `OmnitronEvents` | 3 | viewer (subscribe, unsubscribe, stats) |
| `fleet.rpc-service.ts` | `OmnitronFleet` | 8 | viewer (read) + operator (mutate); heartbeat anonymous |
| `health-check.rpc-service.ts` | `OmnitronHealth` | 4 | viewer |
| `infrastructure.rpc-service.ts` | `OmnitronInfra` | 18 | viewer (read) + operator (start/stop/remove) |
| `kubernetes.rpc-service.ts` | `OmnitronKubernetes` | 9 | admin |
| `log-collector.rpc-service.ts` | `OmnitronLogs` | 4 | viewer |
| `node-manager.rpc-service.ts` | `OmnitronNodes` | 32 | viewer (read), operator (operations), admin (historical repair) |
| `pipeline.rpc-service.ts` | `OmnitronPipelines` | 9 | admin + live human session / trusted local CLI |
| `project.rpc-service.ts` | `OmnitronProject` | 25 | viewer (read) + operator (start/stop) + admin (CRUD) |
| `release.rpc-service.ts` | `OmnitronRelease` | 12 | viewer (read), operator (build/attest), admin (prune) |
| `secrets.rpc-service.ts` | `OmnitronSecrets` | 6 | admin |
| `sync.rpc-service.ts` | `OmnitronSync` | 6 | authenticated control plane; historical repair excludes operators |
| `system-info.rpc-service.ts` | `OmnitronSystemInfo` | 1 | viewer |
| `telemetry.rpc-service.ts` | `OmnitronTelemetry` | 2 | pushBatch anonymous; getRelayStats viewer |
| `trace-collector.rpc-service.ts` | `OmnitronTraces` | 5 | viewer (read); operator/admin (ingestion) |

And, only when `daemon.cluster.enabled` is set on a master:

| File | Service id (Netron) | Methods | Role gate |
| ---- | ------------------- | ------- | --------- |
| `cluster/cluster.rpc-service.ts` | `OmnitronCluster` | 5 | viewer (state) + **unauthenticated** (`requestVote`, `leaderHeartbeat`) |

Plus the core supervisor:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `daemon/daemon.rpc-service.ts` | `OmnitronDaemon` | 26 | mixed — see [Daemon](./daemon.md#rpc-surface--omnitrondaemon-service) |

And two the daemon does not declare at all — they come from Titan
modules it imports, and are registered by those modules:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `apps/omnitron/src/services/metrics.rpc-service.ts` | `OmnitronMetrics` | 7 | Viewer/control-plane reads (including `getStorageStatus`); operator/control-plane `flush`; admin `cleanup` and `evictApp` |
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
their own services into the same Netron registry. An application can
register `TransformWorker` alongside the daemon's own services.
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

Provisioned infrastructure inventory, container control and host-owned ingress.

| Method | Effect |
| ------ | ------ |
| `getState()` | Full infrastructure state (containers, env, networks) |
| `listContainers()` | All managed containers |
| `getConnectionInfo({service})` | Resolved host / port / creds for a logical service |
| `getContainerLogs({container, tail?})` | Tail one container's logs |
| `startContainer({container})` | Start a managed container |
| `stopContainer({container})` | Stop a managed container |
| `removeContainer({container})` | Remove a managed container |
| `provisionStack` / `inspectHostServices` | Reconcile or inspect infrastructure on the executing host |
| `configureHostIngress` / `getHostIngress` | Configure ingress ownership or read configured/observed state |
| `checkHostIngress` / `validateHostIngress` | Inspect the proposed change and validate publication inputs |
| `applyHostIngress` / `removeHostIngress` | Publish or remove an owner’s ingress with generation checks |
| `restoreHostIngressOwner` / `rollbackHostIngressTakeover` | Restore an owner or reverse a takeover using the expected generation |
| `recoverHostIngress` | Recover an interrupted ingress publication |

Reads gate on `viewer`; `startContainer`, `stopContainer` and
`removeContainer` on `operator`. Ingress configuration, takeover rollback and
recovery require `admin` or trusted `service_role`; check/apply/remove/owner
restore use control-plane roles. Read the generated API signature and the
method’s declared gate before composing an operational workflow.

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

Node inventory, health history, bundle activation and recovery: 32 public methods.

| Method category | Methods |
| --------------- | ------- |
| Inventory | `listNodes`, `getNode`, `addNode`, `updateNode`, `removeNode` |
| Checks | `checkNodeStatus`, `checkAllNodes`, `triggerNodeCheck` |
| History | `getCheckHistory`, `getUptimeBar`, `getNodeHealthSummaries` |
| Misc | `listSshKeys`, `getCheckConfig`, `setCheckConfig`, `getHistoryConfig` |
| Remote daemon | `getNodeDaemonStatus`, `getNodeDaemonHealth`, `getNodeDaemonMetrics`, `getNodeClusterState` |
| Mesh and telemetry | `getMeshStatus`, `getNodeRelayStats`, `getNodeSyncStatus`, `getNodeIndicators` |
| Historical repair (admin) | `reconcileNodeMetrics({nodeId, restore?, after?, through?, epoch?})` |
| Bundle operations | `installBundleOnNode`, `activateBundleOnNode`, `recoverBundleOnNode` |
| Upgrades | `planUpgrade`, `upgradeNode`, `upgradeNodes`, `getUpgradeProgress`, `cancelUpgrade` |

Includes the uptime-bar machinery the webapp uses to draw
green/yellow/red availability bars.

### `OmnitronPipelines` — `pipeline.rpc-service.ts`

Xec and shell automation, shared by Console, CLI and local MCP. All methods require `admin`; a human session is revalidated at the service boundary. Mutations must record an audit intent before taking effect.

| Method | Effect |
| ------ | ------ |
| `createPipeline(definition)` | Define a pipeline |
| `updatePipeline({id, definition})` | Validate and replace a definition, preserving its ID |
| `getPipeline({id})` | Read one pipeline and its revision |
| `listPipelines()` | List all |
| `deletePipeline({id})` | Drop a pipeline |
| `executePipeline({id, expectedRevision, params?})` | Admit a reviewed revision; reject a definition changed since review |
| `cancelRun({runId})` | Request cancellation and await the owned execution |
| `getRunStatus({runId})` | One run with bounded per-step output and diagnostics |
| `listRuns({pipelineId?, limit?})` | Bounded history summaries; excludes step output and parameters |

See [Xec automation](./automation.md) for execution limits, revision review, cancellation and failure recovery. A child process is not a sandbox for untrusted agent code.

### `OmnitronProject` — `project.rpc-service.ts`

Project and stack registry: 25 public methods, including release checks, account operations and infrastructure ownership.

| Method category | Methods |
| --------------- | ------- |
| Projects | `listProjects`, `getProject`, `scanRequirements`, `addProject`, `updateProject`, `removeProject` |
| Project apps and topology | `getProjectApps`, `getTopology` |
| Stacks | `listStacks`, `getStack`, `getStackStatus`, `createStack`, `deleteStack`, `startStack`, `stopStack` |
| Infrastructure ownership | `refreshInfrastructureOwnership`, `inspectStackHost`, `probeLeftovers`, `stackMaintenance` |
| Stack accounts | `censusStackAccounts`, `createStackAccount`, `removeStackAccount`, `showStackAccount` |
| Release inspection | `checkRelease`, `getDeployProgress` |

`updateProject({ name, path })` changes the registered location while preserving the
project name, registration history, enabled-stack settings and workspace namespace.
The directory basename is not a rename request. Stop running/starting stacks before
moving a project to another release directory. Configuration is reloaded from the
new path on the next start. A rejected path leaves the registration unchanged.
Use an immutable release directory for updates; a mutable `current` symlink can
otherwise make process definitions and installed package identities disagree.

Roles: all reads (`listProjects`, `getProject`, `scanRequirements`,
`getProjectApps`, `getTopology`, `listStacks`, `getStack`, `getStackStatus`) gate on
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
| `readUnverifiedMetrics({after?, through?, epoch?, limit?})` | Read a bounded page of retained historical metrics; admin or service identity |
| `acknowledgeReconciliation({proofs})` | Verify payload-bound database proofs and atomically settle source evidence; admin or service identity |

`receiveBatch`, `drainBuffer` and `ackDrained` gate on `['admin',
'operator', 'service_role']` (daemon-to-daemon over TCP);
`getSyncStatus` accepts human read roles and the authenticated control plane.
Historical repair methods require `admin` or `service_role`; neither `viewer` nor
`operator` can change proof. The master coordinator
`OmnitronNodes.reconcileNodeMetrics` requires `admin`. Inspection is its default;
`restore: true` explicitly enables repair.

Production replication uses the master's authenticated mesh connection to pull
`drainBuffer` batches from each slave. The master ingests a batch before calling
`ackDrained`; pending entries remain available for retry until acknowledged.
Rejected entries remain pending. Permanently discarded entries are logged as
errors and acknowledged explicitly.

`SyncService.setMasterConnection()` is an unused push-path hook. Its `connected`
flag does not describe the active pull channel. Inspect pending entries, the last
acknowledgement, node reachability and mesh logs when diagnosing replication.
An unavailable reading is unknown, not an empty backlog.

### `OmnitronSystemInfo` — `system-info.rpc-service.ts`

Host inventory.

| Method | Effect |
| ------ | ------ |
| `getSnapshot()` | CPU / RAM / disk / OS info |

The webapp uses this for the host-info card.

### `OmnitronTelemetry` — `telemetry.rpc-service.ts`

Telemetry ingestion endpoint for `titan-telemetry-relay`
aggregator role. It is registered only on master daemons. Apps push batches here;
the daemon stores and aggregates. Slave log/metric replication uses `OmnitronSync`
above and does not require this separate relay endpoint.

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
| `operator`  | `operator`, `admin`                | Lifecycle + scale |
| `admin`     | `admin` only                       | Arbitrary execution, automation, SSH, shutdown, secrets, role changes |
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

## Release and audit services

`OmnitronRelease` provides `preflight`, `list`, `get`, `getLog`, `builds`,
`getBuild`, `build`, `stopBuild`, `prune`, `attest`, `attestOnNode` and
`deployments`. Build execution and artifact state are separate from deployment
history. See [Releases and verification](./releases.md) for the workflow.

`OmnitronAudit` exposes `available` and `list`, both gated to administrators.
Check availability before interpreting an empty result as proof that no
operation took place. The audit trail records who requested control-plane
changes and their outcomes.

## Console administration and SSH

`OmnitronAccess`: `describe`, `listUsers`, `createUser`, `setRole`, `revokeSessions`. See [Console access](./access.md) for transactions, audit and revocation.

`OmnitronTerminal`: `capabilities`, `inspectHost`, `trustHost`, `open`, `list`, `read`, `write`, `resize`, `close`. See [SSH workspace](./terminal.md) for ownership, host verification and bounded binary I/O. Both services are registered on a master; they are not application user-management APIs.


## File workspace services

| File | Service id | Methods | Role gate |
| --- | --- | --- | --- |
| `files/files.rpc-service.ts` | `OmnitronFiles` | 20 | admin + live human session / trusted local CLI |
| `files/file-node.rpc-service.ts` | `OmnitronFileNode` | 1 | authenticated mesh service identity |

`OmnitronFiles` is the master-only administrator API: `roots`, `list`, `stat`, `readText`, `readChunk`, `saveText`, `mkdir`, `rename`, `trash`, `trashList`, `restore`, `beginUpload`, `uploadChunk`, `uploadStatus`, `finishUpload`, `acknowledgeUpload`, `abortUpload`, `copy`, `transfers`, `controlTransfer`. Each call revalidates human authority; mutations and content reads require audit intent.

`OmnitronFileNode.invoke` runs on each node and accepts the v1 typed file protocol only for authenticated control-plane service peers. It implements OS access, private staging and durable write receipts. It is not a browser or application RPC proxy. See [File workspace](./files.md).
