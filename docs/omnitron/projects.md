---
title: Projects and stacks
description: One monorepo owns its applications and libraries; named stacks express deployment environments without duplicating projects.
---

# Projects and stacks

Register a repository once. A project owns its applications and internal libraries;
a stack selects the applications, infrastructure and placement for one named environment.
`local`, `test`, `stage` and `prod` are ordinary stack names, not separate projects.
A stack can run on one machine or span several nodes, mixing processes, containers
and explicitly configured external services.

| Boundary | Owns | Does not imply |
| --- | --- | --- |
| Project | Repository, application definitions, internal libraries, stack configurations | One server or one environment |
| Stack | Application selection, service overrides, nodes, deployment policy | A new project or a copy of source code |
| Placement | A particular application/service on a physical node | Ownership of the whole stack |
| Service connection | A consumer's explicit destination and credentials | Permission to deploy or stop the provider |

Keep shared internal code in workspace packages. Fetch independently versioned libraries
from the npm registry and lock their versions. A development checkout is an explicit
local override, not a production dependency on another repository's filesystem.

## Start with one configuration

Define the applications once in the root `omnitron.config.ts`, and describe environments
in its `stacks` map. Register the root, then use the same project identity everywhere:

```bash
omnitron project add sample /srv/projects/sample
omnitron stack list --project sample
omnitron stack status sample test
omnitron topology show sample prod
```

See [configuration](./configuration.md), [infrastructure overrides](./infrastructure.md#stack-level-overrides)
and [release admission](./releases.md). Promoting a release does not create another project.

## Compose configurations in a large repository

An independently maintained configuration directory inside the same repository can
contribute stacks to its owner. It remains a source of configuration, not another
workspace in the project menu. Every source stack gets an explicit, unique name in
the owning project:

```bash
omnitron project configuration import sample research /srv/projects/sample/research --stack local=research
omnitron project configuration list sample
omnitron stack status sample research
```

Console exposes the same operation through **Projects → Import stacks**. The directory
must resolve inside the registered repository; symlinks cannot escape that boundary.
Map all configured and user-created source stacks. A name collision is refused.
The configuration is executable project code: importing it is an administrator operation.

A new `project add` for a directory already owned by a registered project is refused
with guidance to import its stacks. Project settings show configuration sources;
navigation remains **project → stack**.

## Consolidate an older registration without interrupting applications

If a repository subdirectory was previously registered as `sample-research`, attach
its existing runtime identity explicitly:

```bash
omnitron project configuration import sample research /srv/projects/sample/research --registration sample-research --stack local=research
```

This atomically removes the separate catalogue project and assigns its configuration
to `sample`. It does not stop, restart or rename processes. Auto-start settings, secrets,
checkpoints, log/metric identities and existing experiment registrations retain their
original namespaces. CLI stack operations resolve public names to those namespaces.
`omnitron logs sample/research/api` resolves the same application as its former name.
Low-level process diagnostics may still display the retained runtime name.

Project-wide logs and metrics include owned configuration sources; selecting one
stack narrows them to that source. Console restores a saved selection of the former
registration inside the owning project. The infrastructure map uses the same ownership.

The RPC requires `expectedRevision`; CLI and Console supply the catalogue revision they
read. A concurrent change refuses the operation instead of overwriting it. Configuration
ownership and removal of the former project row commit together in SQLite with FULL
synchronous durability. Recovery and database backup enumeration include every source.

To undo just the ownership change, without reverting newer history:

```bash
omnitron project configuration detach sample research
```

This restores the former standalone registration and preserves its runtime state.
Do not restore an old complete daemon database over newer telemetry to undo an import.
An owner with imported configurations cannot be removed until they are detached.

## Reuse a service across project boundaries

A consuming project does not import the provider's configuration or share its lifecycle.
Declare an external destination using a stack's `serviceOverrides.external`; bind
consumer credentials through the project's secret facilities. The provider remains
responsible for its deployment, data and availability. Stopping the consumer must not
stop that provider or remove its data. Use separate, least-privilege credentials for
each consuming stack, with an explicit API/protocol version and compatibility policy.

Today these connections are explicit endpoints. An external override disables local
provisioning of that service; the topology reports configuration evidence, not proof
of live traffic or health. Cross-project contract discovery, automatic provider
selection and consumer-aware rollout are future control-plane capabilities, not
permissions implied by an endpoint or a shared display name.

See the [topology workspace](./topology.md) and the
[resilient control-plane contract](./resilient-control-plane.md) for the distinction
between desired placement, observed state and admitted execution.


## Confirmed stack stops

In Console, choose **Review stop…** on a stack card or its detail page. The same
read-only inventory is available to viewers with
`omnitron --json stack stop <project> <stack> --dry-run`. Each row identifies the node, runtime registration,
applications and containers. An unavailable owner or a missing source binding
appears with its reason and prevents confirmation. Opening or closing the review
does not change automatic resume or create a stop operation.

Operators can confirm the reviewed inventory in Console. For automation, pass
the returned `data.digest` to the same command with `--review <digest>`.
A changed process generation, allocation or resource list requires a fresh review.
A nonzero exit status and a null digest mean the full impact could not be verified.

`omnitron stack stop <project> <stack>` prepares an ownership-checked plan on
**every participating node before sending any stop**. Each node records an operation
identity in its private SQLite journal, the current application generations, and
immutable Docker container IDs. Plans expire after ten minutes before execution.
Preparation does not stop applications or remove containers.

Once admitted, the controller durably disables automatic stack resume. The process
owner persists a separate execution fence before terminating anything. That fence
also rejects watcher restarts, scaling and automatic recovery starts. An explicit
new stack start may clear it only after the preceding stop is confirmed.

Applications terminate before their infrastructure. Infrastructure reconciliation and
already admitted provisioning are drained before graceful container removal. Docker
volumes are retained. Other projects/stacks and node RPC connections remain available.
A failed process exit prevents infrastructure removal on that node.

The node returns a durable receipt only after process termination, withdrawn RPC
services and container absence are confirmed. Retrying an operation identity
reconciles its receipt; an old receipt cannot acknowledge a later application
generation. A timeout or lost connection remains **unconfirmed**. It does not mean
that the applications stopped, and it does not trigger a fallback that kills by
bare app name, port or directory.

```bash
omnitron stack stop example production --json
omnitron stack status example production --json
```

The response includes `stopOperation`: its identity, phase, committed intent,
per-node outcomes and diagnostic reasons. Console uses the same persisted state,
including after a page/backend reload. A failed stop retains the resources needed
for reconciliation; complete it before starting a new deployment. Every user stop
records success or failure in the audit trail.

### Resume installed applications

After an operator confirms a signed stop, the elected controller can resume the same installed applications on their original nodes. Use **Resume installed apps** in Console or run:

```bash
omnitron --json stack resume example production
omnitron --json stack status example production
```

Each node must still be bound to the source stack and retain the stopped process generations and verified release artifacts. The stop must identify each node's exact operation and must have removed no containers. A changed placement, missing owner capability, older receipt without a node operation ID or missing installation prevents recovery. Review a new stop to replace an older receipt. Use deployment when an application needs a different release or configuration.

The process owner binds the application generation, launch configuration, manifest, archive and installed tree at verified launch. A backend upgrade alone cannot reconstruct this evidence for an old owner. Classic Node applications must acknowledge readiness over IPC within 30 seconds (for example, `process.send?.("ready")`).

Preparation checks every node before the first launch. Each owner resumes its applications in dependency order. A node confirms success only after observing all of them online. The result identifies the operation, individual nodes, observed applications, time and failure reason. A lost acknowledgement triggers a read of the node's durable receipt. The controller stops dispatching on the first uncertain target. CLI returns a nonzero exit code for a partial or unconfirmed result.

Use stack status to inspect the persisted `resumeOperation` after a disconnect. An observation describes the applications at that instant. For current health, inspect the stack's live placements and application diagnostics. After a partial start, inspect the affected nodes, then review and complete a fresh stop before another recovery attempt. Recovery leaves the previously disabled automatic startup policy in place.

### Existing allocations and rollout

Generated node configurations carry `managedOrigin: { project, stack }` and
`infrastructureOwnership: 'controller'`. The source stack owns provisioning and
migrations; the generated local allocation uses explicit resolved connections and
starts applications without inventing another infrastructure stack. See
[infrastructure ownership](./infrastructure.md#infrastructure-ownership). Both
remote controller stop and a direct stop of that generated local stack use the
same source-bound protocol, including its infrastructure. Publication preserves
the binding and refuses to overwrite an allocation owned by another stack.
An existing unbound allocation requires an explicit, evidence-checked migration;
a new controller never guesses ownership from the project's name. Old owners and
nodes lacking this protocol must be upgraded before confirmed remote stop is
available. This is an activation prerequisite, not an automatic compatibility mode.

The legacy `project/deployed/app` namespace still supports one source stack per
project on a node. Concurrent source stacks on the same node need the canonical
allocation model in [G09](./release-readiness.md); collision is refused meanwhile.
Deployment destinations are durably recorded before remote work begins. Stop merges
that journal with the current declaration and retains removed destinations across
controller restarts; obligations are cleared only after every receipt and a matching
journal revision. Even a change from a remote to a local declaration does not erase
remote obligations. Deployments made before this journal existed require an audited
initial inventory; unavailable historical sources remain explicit gaps.
Docker inventory must be readable on every participating node; an unavailable
Docker daemon is not interpreted as an empty inventory. These boundaries keep the
full lifecycle gate open until allocation migration and fleet acceptance pass.
