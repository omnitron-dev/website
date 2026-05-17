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
Netron service id, purpose, and key methods. Verified against
`src/services/*.rpc-service.ts`.

## Quick index

| File | Service id (Netron) | Methods | Role gate (typical) |
| ---- | ------------------- | ------- | ------------------- |
| `alert.rpc-service.ts` | `OmnitronAlerts` | 7 | operator + viewer |
| `auth.rpc-service.ts` | `OmnitronAuth` | 7 | mixed (some allowAnonymous for signIn) |
| `backup.rpc-service.ts` | `OmnitronBackups` | 6 | operator |
| `deploy.rpc-service.ts` | `OmnitronDeploy` | 3 | operator + admin |
| `discovery.rpc-service.ts` | `OmnitronDiscovery` | 3 | viewer |
| `event-broadcaster.rpc-service.ts` | `OmnitronEvents` | 4 | mixed |
| `fleet.rpc-service.ts` | `OmnitronFleet` | 8 | operator |
| `health-check.rpc-service.ts` | `OmnitronHealth` | 4 | viewer |
| `infrastructure.rpc-service.ts` | `OmnitronInfra` | 3 | viewer |
| `kubernetes.rpc-service.ts` | `OmnitronKubernetes` | 9 | operator |
| `log-collector.rpc-service.ts` | `OmnitronLogs` | 3 | viewer |
| `node-manager.rpc-service.ts` | `OmnitronNodes` | 14 | operator |
| `pipeline.rpc-service.ts` | `OmnitronPipelines` | 8 | operator |
| `project.rpc-service.ts` | `OmnitronProject` | 14 | operator + viewer |
| `secrets.rpc-service.ts` | `OmnitronSecrets` | 4 | admin |
| `sync.rpc-service.ts` | `OmnitronSync` | 3 | service-to-service |
| `system-info.rpc-service.ts` | `OmnitronSystemInfo` | 1 | viewer |
| `telemetry.rpc-service.ts` | `OmnitronTelemetry` | 2 | service-to-service |
| `trace-collector.rpc-service.ts` | `OmnitronTraces` | 5 | viewer + operator |

Plus the core supervisor:

| File | Service id | Methods | Role gate |
| ---- | ---------- | ------- | --------- |
| `daemon/daemon.rpc-service.ts` | `OmnitronDaemon` | 25 | mixed — see [Daemon](./daemon.md#rpc-surface--omnitrondaemon-service) |

## Naming convention

Service ids all use the `Omnitron<Subsystem>` PascalCase shape
(no version suffix). Query them via Netron's standard interface
mechanism:

```typescript
import type { IDeployService } from '@omnitron-dev/omnitron/services';

const peer = await client.connect('unix://~/.omnitron/daemon.sock');
const deploy = await peer.queryInterface<IDeployService>('OmnitronDeploy');
await deploy.deployApp({ app: 'api', version: 'v1.2.3' });
```

The CLI and webapp do exactly this under the hood.

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
| `getActiveSessions()` | List active sessions (admin) |
| `changePassword({...})` | Self-service password change |

`signIn` and `validateToken` are typically `allowAnonymous`; the
rest gate on the session's role.

### `OmnitronBackups` — `backup.rpc-service.ts`

Database backup, restore, scheduling.

| Method | Effect |
| ------ | ------ |
| `createBackup({database, compress?})` | One-shot backup |
| `listBackups({database?})` | List available backups |
| `restoreBackup({backupId})` | Restore from a backup |
| `deleteBackup({backupId})` | Drop a backup file |
| `setSchedule({database, cron})` | Configure recurring backups |
| `getSchedule({database})` | Read current schedule |

Driven by `omnitron backup` commands.

### `OmnitronDeploy` — `deploy.rpc-service.ts`

App deployment workflows.

| Method | Effect |
| ------ | ------ |
| `deployApp({app, version, strategy?, deployedBy?})` | Run a deploy with the chosen strategy |
| `rollback({app, deployedBy?})` | Roll back to previous version |
| `getHistory({app?, limit?})` | Deployment history |

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
| `pushEvent({channel, payload})` | Publish an event |
| `getStats()` | Subscriber count + per-channel stats |

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

Mutating ops live in the daemon directly (Docker compose runs).

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

Driven by `omnitron k8s ...`.

### `OmnitronLogs` — `log-collector.rpc-service.ts`

Log query + streaming.

| Method | Effect |
| ------ | ------ |
| `queryLogs({app?, level?, grep?, lines?, ...})` | Filter logs |
| `getLogStats()` | Per-app log size + rotation stats |
| `streamLogs({app?, follow})` | Streaming subscription |

`omnitron logs` calls `queryLogs` or `streamLogs`.

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
| `getSyncStatus()` | Current sync state |

Not typically called directly by operators.

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
| `pushBatch({nodeId, entries})` | Producer pushes batch; returns ack count |
| `getRelayStats()` | Internal relay stats |

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
| anonymous   | anyone with socket access          | `ping`, `signIn`, `validateToken` |

Methods on the same service can vary in role:
- `OmnitronAuth.signIn` is anonymous;
  `OmnitronAuth.getActiveSessions` is admin-only.
- `OmnitronProject.listProjects` is viewer;
  `OmnitronProject.deleteStack` is operator.

## Querying a service from your code

```typescript
import { Netron } from '@omnitron-dev/titan/netron';
import type {
  IProjectService,
  IDeployService,
  IFleetService,
} from '@omnitron-dev/omnitron/services';

const netron = new Netron();
const peer   = await netron.connect('unix://~/.omnitron/daemon.sock');

const project = await peer.queryInterface<IProjectService>('OmnitronProject');
const projects = await project.listProjects();

const deploy = await peer.queryInterface<IDeployService>('OmnitronDeploy');
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
