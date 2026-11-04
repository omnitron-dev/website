---
title: Topology workspace
description: Inspect physical placements and configured connections, review target changes, and keep target intent separate from runtime execution.
---

# Topology workspace

Use **Topology** to answer three questions: what is declared, where it is running,
and what evidence supports each connection. Use **Workspace** to design and review
a target placement for a project and stack.

:::important Execution boundary
The workspace saves target intent. **Accept target** and `omnitron topology apply`
do not change executable project configuration, start or stop applications, migrate
data, or affect auto-resume. Ordinary stack deployment continues to use the project's
configured stacks. A target is not an admitted runtime migration.

Automatic node replacement, resource-aware fleet scheduling and database failover
are specified in the [resilient control-plane design](./resilient-control-plane.md).
They are not enabled by saving a target.
:::

## Read the infrastructure map

The global map combines this daemon's actual process/container inventory with
remote stack observations across registered projects. A project or stack selection
narrows that view. Replica cards have a physical node identity: two nodes running
the same application remain separate placements.

| Evidence | Meaning |
| --- | --- |
| Process observation | The owning daemon answered with this process and its state |
| Container observation | The owning runtime returned this container's state and health |
| Configured endpoint | The application launch configuration names this destination |
| Declared dependency | The application declares a startup dependency |
| Unknown observation | This source could not be read; absence or failure has not been proved |

Connections derived from configuration do not claim live traffic. A loopback
endpoint connects only to a service on the same physical node. An ambiguous endpoint
is not arbitrarily attached to the first matching database. A container which has
stopped is not healthy just because its last health check succeeded.

Remote observations retain per-node errors and observation times. An unreachable
replica does not erase a healthy replica, become an empty inventory, or count as a
confirmed stopped application. Logical application summaries can be degraded while
the node inspector explains which placement could not be read.

Graph dragging changes the view layout only. Search, graph/list view, the connections
inspector and [keyboard navigation](./console.md#topology) remain available without
editing deployment intent.

## Application service isolation

Process topology is the local RPC graph inside one application launch. Each
application that declares `topology.expose` or `topology.access` receives its own
native Netron context and private Unix listener, owned by the resident process
owner. The backend's management namespace is separate.

Two projects, stacks, or instances can expose the same service name and version
without sharing a provider. For example, `sample/dev/quotes` and
`sample/test/quotes` can both expose `CollectorWorker`; each consumer resolves
its own application's worker through `createToken('topology:CollectorWorker')`.
No service renaming or extra namespace configuration is needed.

Within one application, each service name/version has one declared provider.
A second provider is a startup error; Omnitron never replaces another provider
silently. Pool proxies retain PM load balancing, and singleton proxies resolve
the current child after a restart without replacing consumers' service definitions.

The same bounded discovery checks apply to pools and single processes. An application
remains `starting` until its declared children have started and provider publication
has completed; a ready child alone cannot announce an unfinished application online. Missing
callable services, invalid metadata, and RPC failures retain the application and
provider names in the startup error. CLI inspection and Console application
details read the same recorded failure. Failed startup releases that launch's
resources; incomplete cleanup remains owned and retryable rather than being
reported as a successful stop.

Stopping or rebuilding one application closes only its listener and providers.
Backend handoff preserves these owner-held contexts. Existing sealed application
SDKs keep using their bootstrap contract and `topology.access` API. An older owner
must be upgraded to gain this isolation; the capability is reported as
`applicationTopology@1`, and an owner upgrade requires a planned application restart.

Intentional connections to another application's public services use an explicit
Netron endpoint. A bare sibling lookup never falls back to another application or
to the management socket. Unix directories use `0700` and sockets use `0600`;
this separates routing namespaces, while OS accounts and containers provide
isolation between mutually untrusted workloads.

## Declaration coverage

Open **Declarations** for the selected project to refresh the bootstrap metadata
used by the map. This administrative action reads each unique bootstrap in a
separate process and commits its `requires` and `omnitronConfig` declarations to
the daemon's SQLite store. It does not call application lifecycle hooks or start
a stack. Imports can execute trusted project code: refresh is an explicit admin
operation, while ordinary viewer reads never import bootstrap code.

```bash
# All registered configurations and stacks of one project
omnitron topology refresh sample
# One stack, using the same authorization and result as Console
omnitron --json topology refresh sample prod
omnitron --json project topology sample --stack prod
```

The read window is bounded to 30 seconds per bootstrap and 90 seconds across the
project. A failed or unread declaration keeps its previous snapshot and a visible
coverage warning; the CLI exits nonzero for partial results. Refresh after rebuilding
applications or changing their dependencies. An HTTP timeout is not a cancellation:
reload the map to inspect committed coverage before retrying.

Expand **declarations available** below the toolbar to inspect each application's
source and capture time. The JSON graph and `topology show` expose the same coverage:

| Source | Meaning |
| --- | --- |
| `entry` | No bootstrap; dependencies come from the configured application entry |
| `launch` | Declaration captured by the execution owner when loading this application |
| `snapshot` | Persisted declaration from an explicit refresh or stack preparation |
| `memory` | Compatibility metadata available only in a previous process cache/checkpoint |
| `missing` | Bootstrap declarations unavailable; explicit configuration alone is insufficient for full coverage |

A new owner carries launch declarations across backend handoffs. Persisted snapshots
also survive a cold backend restart. The graph reports a changed or missing captured
bootstrap file without executing it. Its hash covers the selected source/compiled
bootstrap file, **not the entire imported dependency tree**. A snapshot is not a
continuous code watcher or proof of live connections. Failure, source and capture
time remain visible instead of turning an unknown dependency into an absent one.
Private declaration records stay in the daemon store; viewer responses contain
sanitized endpoint identities, dependency evidence and coverage, never environment
values or credentials.

## Design a target

1. Select a project and stack, then open **Workspace**.
2. In **Placement**, choose the enabled project applications and assign them to
   registered fleet nodes. A local target has no remote nodes; a remote target has
   one; a cluster target has one or more.
3. Inspect **Connections**. Service runtimes come from the same infrastructure
   normalization and binding rules as provisioning. Unknown statefulness remains
   unverified; the diagram does not grant permission to relocate a database.
4. **Save draft** or press Ctrl/Command+S. Saving is protected against concurrent
   edits from another Console or CLI session.
5. **Review plan** to inspect additions, removals, before/after node metadata and blocking issues. A plan is
   bound to the current configuration and draft revision and expires after ten minutes.
6. **Accept target** stores that exact plan ID. It leaves deployment and restart
   configuration unchanged. Export the portable target with **Export JSON**.

Viewers and operators can inspect the workspace. Its mutations currently require
the administrator role. The server enforces the same gate for Console and CLI.
Application definitions, environment values and SSH credentials do not travel in
the portable document or viewer stack configuration.

On a concurrent edit or changed project configuration, reload the saved target or
choose **Rebase edits**. Rebase loads the latest base while preserving your edits
locally; save and review again. It does not silently merge or apply a conflicting plan.
Closing a dirty editor asks before discarding local edits. Narrow windows use a
full-height dialog with content contained inside its scroll region.

## CLI parity

| Command | Result |
| --- | --- |
| `omnitron topology refresh` | Explicit admin declaration capture without a workload restart |
| `omnitron topology show` | Configured target, accepted target and observation gaps |
| `omnitron topology export` | Portable JSON document |
| `omnitron topology draft` | Revision-protected draft save |
| `omnitron topology plan` | Validation and expiring review plan |
| `omnitron topology apply` | Accept an explicit target plan ID; no runtime execution |

```bash
omnitron topology show sample prod
omnitron --json topology show sample prod
omnitron topology export sample prod > prod.topology.json

# Edit the exported target, then save and review it.
omnitron topology draft sample prod prod.topology.json
omnitron topology plan sample prod

# Use the explicit ID returned by plan. This accepts target intent only.
omnitron topology apply sample prod <plan-id>
```

Normal `topology export` writes a portable document directly. With `--json`, the
standard CLI envelope contains that document in `data`; extract it before importing.

The JSON workspace contains `configured`, `desired`, `draft`, `plans`, `observed`,
service/dependency evidence and registered-node choices. `configured` is the current
executable project configuration. `desired` is the accepted target, or the configured
placement when none has been accepted. Use this distinction in automation.

The portable v1 document is deliberately small:

```json
{
  "version": 1,
  "type": "cluster",
  "apps": ["api", "worker"],
  "nodes": [
    { "host": "app-a.example", "port": 9700, "role": "app", "apps": ["api"] },
    { "host": "app-b.example", "port": 9700, "role": "worker", "apps": ["worker"] }
  ]
}
```

Names must identify enabled applications. Unknown fields, credentials embedded in
the document, duplicate nodes/apps, unassigned applications and invalid dependencies
are rejected. A startup `dependsOn` remains local: it cannot become cross-host
readiness merely by placing its target elsewhere. Node `port` is the daemon RPC
port, not a database, Redis or gateway port.

## Durability and limits

Drafts, accepted targets and the corresponding acceptance record use the local
daemon SQLite store. Revision comparison and acceptance share an immediate
transaction with FULL WAL durability. This is local durability, not multi-controller
consensus or a guarantee against losing the machine and its disk. Back up the daemon
state as part of control-plane recovery.

The recent plan window contains twenty plans. Repeating a retained accepted plan
returns its previous result; an evicted plan ID is refused, never re-executed. A stale,
expired or invalid unaccepted plan cannot change the target. PostgreSQL audit is an
additional searchable record; it is not the authority for whether local acceptance
committed.

The current executor supports per-node application subsets through the existing
stack configuration. An explicit `nodes[].apps` list takes precedence over role
labels; an empty list assigns no application processes. When omitted, cluster nodes
with role `database` or `cache` retain their infrastructure-only default; other
placements retain the all-applications default. The planner, observer and executor
share these rules. Infrastructure declarations
are still provisioned per declared node. This is **not** selective service placement,
replication of existing databases, or automatic movement of their volumes.

Changing a node's role label does not create a database cluster. Replacing a host in
a target does not authorize taking over a writer identity. Those operations require
the resource, execution, fencing and data-recovery contracts in the control-plane
design.
