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
| `fleet.rpc-service.ts` | `OmnitronFleet` | 7 | Viewer reads and operator inventory changes |
| `health-check.rpc-service.ts` | `OmnitronHealth` | 4 | viewer |
| `infrastructure.rpc-service.ts` | `OmnitronInfra` | 18 | viewer (read) + operator (start/stop/remove) |
| `kubernetes.rpc-service.ts` | `OmnitronKubernetes` | 9 | admin |
| `log-collector.rpc-service.ts` | `OmnitronLogs` | 4 | viewer |
| `node-manager.rpc-service.ts` | `OmnitronNodes` | 33 | viewer (read), operator (operations), admin (historical repair) |
| `pipeline.rpc-service.ts` | `OmnitronPipelines` | 9 | admin + live human session / trusted local CLI |
| `project.rpc-service.ts` | `OmnitronProject` | 43 | Viewer reads and reviews, operator starts/stops, administrator manages registrations, machine credentials run the recipient protocol |
| `release.rpc-service.ts` | `OmnitronRelease` | 12 | viewer (read), operator (build/attest), admin (prune) |
| `secrets.rpc-service.ts` | `OmnitronSecrets` | 6 | admin |
| `sync.rpc-service.ts` | `OmnitronSync` | 5 | authenticated control plane; historical repair excludes operators |
| `system-info.rpc-service.ts` | `OmnitronSystemInfo` | 1 | viewer |
| `telemetry.rpc-service.ts` | `OmnitronTelemetry` | 1 | Authenticated relay statistics |
| `trace-collector.rpc-service.ts` | `OmnitronTraces` | 5 | viewer (read); operator/admin (ingestion) |

Cluster participation is exposed on controllers, workers and standalone daemons:

| File | Service id (Netron) | Methods | Role gate |
| ---- | ------------------- | ------- | --------- |
| `cluster/cluster.rpc-service.ts` | `OmnitronCluster` | 3 | authenticated reads and administrator step-down |

Plus the core supervisor:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `daemon/daemon.rpc-service.ts` | `OmnitronDaemon` | 27 | mixed — see [Daemon](./daemon.md#rpc-surface--omnitrondaemon-service) |

The daemon exposes its role-protected metrics facade and imports the Titan health service:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `apps/omnitron/src/services/metrics.rpc-service.ts` | `OmnitronMetrics` | 7 | Viewer/control-plane reads (including `getStorageStatus`); operator/control-plane `flush`; admin `cleanup` and `evictApp` |
| `packages/titan-health/src/health.rpc-service.ts` | `Health@1.0.0` | 7 | public `live` and `ready`, 5 detailed methods require control-plane read access |

`OmnitronMetrics` requires authorization for every method. Use `omnitron doctor` to check which diagnostic methods a particular daemon exposes to an unauthenticated connection. It reports observed exposure as `auth.anonymous-surface`.

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

Compatibility access to legacy per-app operation records.

| Method | Effect |
| ------ | ------ |
| `deployApp({app, version, strategy?, deployedBy?})` | Refuses: use the release/stack deployment workflow |
| `rollback({app, deployedBy?})` | Refuses before any mutation; select the previous release through the stack workflow |
| `getHistory({app?, limit?})` | Retained legacy operation records; labels are not artifact evidence |
| `listDeployableApps()` | Empty list: no per-app artifact executor is installed |

Historical strategy labels are retained as recorded requests, not evidence of an implemented rollout.

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
| `unsubscribe()` | Drop the subscription owned by the calling connection |
| `getStats()` | Subscriber count |

All three methods admit viewers. Publication is internal to the daemon.

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

Reads (`listNodes`, `getNode`, `getSummary`) gate on `viewer`;
mutations (`registerNode`, `removeNode`, `setRole`, `drainNode`)
on `operator`. The scheduler records local liveness against its own registration.

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

Node inventory, health history, bundle activation and recovery include 33 public methods.

| Method category | Methods |
| --------------- | ------- |
| Inventory | `listNodes`, `getNode`, `addNode`, `updateNode`, `removeNode` |
| Checks | `checkNodeStatus`, `checkAllNodes`, `triggerNodeCheck` |
| History | `getCheckHistory`, `getUptimeBar`, `getNodeHealthSummaries` |
| Misc | `listSshKeys`, `getCheckConfig`, `setCheckConfig`, `getHistoryConfig` |
| Remote daemon | `getNodeDaemonStatus`, `getNodeDaemonHealth`, `getNodeDaemonMetrics`, `getNodeSystemSnapshot`, `getNodeClusterState` |
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

`refreshTopologyMetadata({ project, stack? })` is admin-only: it captures bootstrap
declarations in bounded child processes and persists the last successful snapshot.
It returns `refreshed` and per-application `failures`, retaining previous metadata
on failure. Viewer `getTopology` and `getTopologyWorkspace` report declaration
source, capture time and coverage warnings without importing bootstrap code. See
[declaration coverage](./topology.md#declaration-coverage).

`inspectInstalledArtifacts({ project, stack })` is an explicit viewer operation. It compares retained archive hashes and byte counts with the release catalog, reports modified installed entry points and framework build metadata, and never creates launch receipts. Its node counterpart, `OmnitronDaemon.inspectInstalledArtifacts({ names })`, accepts canonical owner inventory keys and admits human readers plus authenticated cluster service identities. Both are read-only, bounded, and absent from status polling. See [release evidence](./releases.md#understand-what-is-built-and-what-is-running).

`diagnoseStack({ project, stack })` is a viewer operation. It returns timestamped
prerequisite checks, planned changes and explicit unverified coverage without
provisioning or importing application bootstraps. Imported configuration names
resolve to the same runtime scope as Start; the report retains the public project
and stack names. Concurrent readers share an in-flight inspection. See
[readiness before start](./console.md#stacks).

The project and stack registry exposes release checks, account operations, infrastructure ownership and per-node lifecycle receipts.

| Method category | Methods |
| --------------- | ------- |
| Projects | `listProjects`, `getProject`, `scanRequirements`, `addProject`, `updateProject`, `removeProject`, `importConfiguration`, `detachConfiguration` |
| Project apps and topology | `getProjectApps`, `getTopology`, `getTopologyInventory`, `refreshTopologyMetadata` |
| Target workspace | `getTopologyWorkspace`, `saveTopologyDraft`, `planTopology`, `applyTopologyPlan` |
| Stacks | `listStacks`, `getStack`, `getStackStatus`, `diagnoseStack`, `inspectInstalledArtifacts`, `createStack`, `deleteStack`, `startStack`, `reviewStackStop`, `stopStack`, `resumeInstalledStack` |
| Infrastructure ownership | `refreshInfrastructureOwnership`, `inspectStackHost`, `probeLeftovers`, `stackMaintenance` |
| Stack accounts | `censusStackAccounts`, `createStackAccount`, `removeStackAccount`, `showStackAccount` |
| Recipient lifecycle protocol | `inspectNodeStackStop`, `prepareNodeStackStop`, `executeNodeStackStop`, `prepareNodeInstalledResume`, `executeNodeInstalledResume`, `getNodeInstalledResumeReceipt` |
| Release inspection | `checkRelease`, `getDeployProgress` |

`updateProject({ name, path })` changes the registered location while preserving the
project name, registration history, enabled-stack settings and workspace namespace.
The directory basename is not a rename request. Stop running/starting stacks before
moving a project to another release directory. Configuration is reloaded from the
new path on the next start. A rejected path leaves the registration unchanged.
Use an immutable release directory for updates; a mutable `current` symlink can
otherwise make process definitions and installed package identities disagree.

Roles: all reads (`listProjects`, `getProject`, `scanRequirements`,
`getProjectApps`, `getTopology`, `getTopologyInventory`, `getTopologyWorkspace`, `listStacks`, `getStack`, `getStackStatus`, `diagnoseStack`) gate on
`viewer`; `startStack`, `stopStack` and `resumeInstalledStack` on `operator`; project CRUD
(`addProject`, `updateProject`, `removeProject`) and stack CRUD
(`createStack`, `deleteStack`) on `admin`. Target mutations (`saveTopologyDraft`,
`planTopology`, `applyTopologyPlan`) also require `admin`. They persist target intent,
not executable deployment configuration. See the [workspace contract](./topology.md).

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
| `drainBuffer({limit?})` | Pull pending sync data |
| `ackDrained({ids})` | Acknowledge what the caller has durably taken |
| `getSyncStatus()` | Current sync state |
| `readUnverifiedMetrics({after?, through?, epoch?, limit?})` | Read a bounded page of retained historical metrics; admin or service identity |
| `acknowledgeReconciliation({proofs})` | Settle retained evidence against payload-bound database proofs (service identity only) |

`drainBuffer` and `readUnverifiedMetrics` accept administrators and authenticated machines. Only `service_role` can acknowledge a drained batch or settle historical evidence. Administrators inspect and repair records through `OmnitronNodes.reconcileNodeMetrics` on the controller. Inspection is the default. Pass `restore: true` for repair. The controller binds each batch to its authenticated node connection. All Console read roles and the authenticated machine can call `getSyncStatus`.

Production replication uses the master's authenticated mesh connection to pull
`drainBuffer` batches from each slave. The master ingests a batch before calling
`ackDrained`; pending entries remain available for retry until acknowledged.
Rejected entries remain pending. Permanently discarded entries are logged as
errors and acknowledged explicitly.

Inspect pending entries, the last
acknowledgement, node reachability and mesh logs when diagnosing replication.
An unavailable reading is unknown, not an empty backlog.

### `OmnitronSystemInfo` — `system-info.rpc-service.ts`

Host inventory.

| Method | Effect |
| ------ | ------ |
| `getSnapshot({ fresh? }?)` | Host CPU, memory, mounts, external interfaces, containers and running daemon. A fresh read waits for one shared collection when the cached snapshot has aged. |

The webapp uses this for the host-info card.

### `OmnitronTelemetry` — `telemetry.rpc-service.ts`

`getRelayStats()` returns relay statistics to authorized readers and machine peers on the master. Workers use the authenticated `OmnitronSync` protocol for log and metric replication. A controller acknowledges committed data. See [replication evidence](./cluster.md).

### `OmnitronCluster` — `cluster/cluster.rpc-service.ts`

Controllers, workers and standalone daemons report their participation. An enrolled controller additionally reports its PostgreSQL lease.

| Method | Effect |
| --- | --- |
| `getClusterState()` | Authority, reason, durable epoch, lease freshness, observed leader and peer count |
| `stepDown()` | Demote locally and release this controller's epoch |
| `isLeader()` | Whether this node holds a confirmed fresh lease |

All reads require viewer/operator/admin or a control-plane service identity.
Step-down requires an administrator. The former
anonymous vote and heartbeat methods have been removed. A lease observation is
not a fence for remote effects; see [cluster coordination](./cluster.md).

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
| anonymous   | anyone with socket access          | `ping` and public sign-in/session endpoints |

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
const legacyOperations = await deploy.getHistory({ app: 'sample/test/api', limit: 20 });
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
- **Sending unauthenticated telemetry to the daemon.** Managed workers retain replication entries in their outbox. Monitor delivery through the registered node and its persistence receipts.
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
| `files/files.rpc-service.ts` | `OmnitronFiles` | 21 | admin + live human session / trusted local CLI |
| `files/file-node.rpc-service.ts` | `OmnitronFileNode` | 1 | authenticated mesh service identity |

`OmnitronFiles` is the master-only administrator API: `roots`, `archiveFormats`, `list`, `stat`, `readText`, `readChunk`, `saveText`, `mkdir`, `rename`, `trash`, `trashList`, `restore`, `beginUpload`, `uploadChunk`, `uploadStatus`, `finishUpload`, `acknowledgeUpload`, `abortUpload`, `copy`, `transfers`, `controlTransfer`. Each call revalidates human authority; mutations and content reads require audit intent.

`OmnitronFileNode.invoke` runs on each node and accepts the v1 typed file protocol only for authenticated control-plane service peers. It implements OS access, private staging and durable write receipts. It is not a browser or application RPC proxy. See [File workspace](./files.md).


The six recipient lifecycle operations accept only an authenticated machine credential.
`stopStack` and `resumeInstalledStack` coordinate them on behalf of an operator.
Nodes verify ownership and admission before applying an effect. Their durable
receipts are available to the controller after a transport interruption.
