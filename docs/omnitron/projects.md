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
