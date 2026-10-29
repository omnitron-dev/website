---
title: Releases and verification
description: Build from pinned project and runtime commits, verify artifacts, attest on a stack, and retain a recovery path.
---

# Releases and verification

`omnitron release` separates building an artifact from deploying it. A release
records the **project commit** and the **Omnitron commit** used to build its
applications. The build runs in clean clones and stores its gates, artifacts
and manifest.

## Build and inspect

The project must be registered with Omnitron. Use explicit revisions when
reproducing a build:

```bash
omnitron release build sample \
  --project-commit <project-sha> \
  --omni-commit <omni-sha> \
  --for test
omnitron release list
omnitron release show <release-id>
```

`--for <stack>` includes the static bundle for that stack's gateway environment.
`--keep-source` retains the build clones after success. `--skip-gates` records
the gates as not run; it does not produce a verified release suitable for a
stack that requires those gates.

Read the gate results and artifact list before deployment. The manifest
describes what was built; the daemon's audit trail describes which release
a stack took.

## Dependency identity

The local bundle carries workspace packages and local `file:` archive overrides.
It asks pnpm for the effective overrides, validates each archive's package name,
and records its version and SHA-256 in `BUNDLE.json`. The destination installs
those same bytes. A missing archive or an archive outside its source workspace
fails the build instead of silently selecting the published package. The copy is
verified again before the bundle is completed; changing an archive during packing
fails the build. Archive contents, resolution configuration and lockfiles also
participate in the application build cache, including same-version replacements.

Direct dependencies and optional dependencies use the same override as transitive
consumers. Registry version overrides are retained too. Platform-specific binaries
are installed on the destination; a macOS `node_modules` tree is never copied to
Linux. After publishing a dependency to npm, update its version and lockfile,
remove its local archive override, and verify a clean install before deployment.

## Validate linked source checkouts

Development applications can share a sibling Omnitron checkout. The release
builder reproduces that relative layout with clean clones of pinned commits.
Application tooling can use the same validation through the Node-only
`@omnitron-dev/omnitron/source-layout` entry point:

```typescript
import { readLinkLayout, planBuildRoot } from '@omnitron-dev/omnitron/source-layout';

const layout = readLinkLayout(lockfileText);
if ('refusal' in layout) throw new Error(layout.refusal);
const plan = planBuildRoot(buildRoot, projectRoot, layout);
if ('refusal' in plan) throw new Error(plan.refusal);
```

The planner rejects multiple external source roots, non-workspace targets and
layouts escaping the isolated build directory. Tooling must also check that the
installed links and package manifests exist. Published dependencies need no
sibling-checkout layout. Do not replace this validation with an allowed count of
links: adding a framework module does not change whether a layout is reproducible.

## Verify the deployed system

An attestation records what probes measured about a release on a named stack.
Build success alone does not establish that the deployed application works.

```bash
omnitron release attest <release-id> --stack test --on-node
```

`--on-node` stages the release's own probes on the stack's node and runs them
under its deployment lease. The project supplies its probe implementation.
The daemon records the results and the provenance of the probe sources.

To submit an already collected result instead:

```bash
omnitron release attest <release-id> --stack test --from result.json
```

Use one input mode: `--on-node` or `--from`. The daemon checks attestation
freshness against deployment history. A recorded probe failure remains a
failure; storing the result does not turn it into a passing gate.

## Move a release between machines

Configure `releaseStore` in the daemon configuration and keep its credential
in the vault. The transfer commands use the artifact store:

```bash
omnitron release push <release-id>
omnitron release pull <release-id>
```

A pull checks the received release before making it available locally.
`--root <dir>` changes the local release root. `push --repair` rewrites objects
when a store was found damaged; it is an explicit repair operation.

## Retain recoverable artifacts

```bash
omnitron release prune --keep 5
```

Without `--yes`, prune reports what it would remove. Applied pruning protects
releases reported as running by the audit trail. If the daemon cannot
establish which releases are in use, normal applied pruning refuses; repair
the evidence before deleting artifacts.

Retaining an artifact is only one part of recovery. A previous application
must still be compatible with the current schema. See
[Production readiness](../deployment/production-readiness.md).

## Project tool integration

Application-specific probes and account tools belong to the application
repository. Omnitron supplies node transport, deployment coordination and
container addresses.

The container environment uses `<PROJECT>_PG_CONTAINER`,
`<PROJECT>_REDIS_CONTAINER` and `<PROJECT>_GATEWAY_CONTAINER`. The namespace
comes from the registered project name, uppercased with punctuation replaced
by underscores. Values use the stack's actual container prefix. A project
named `sample` therefore receives `SAMPLE_PG_CONTAINER`, even if its
containers use a custom prefix.

This contract lets a private application remain an integration test bed
without making its identity part of the framework.

Operator-side TypeScript tools can import `createDaemonClient`,
`ExecutionService`, `RemoteDeployer`, `buildBundle`, `archiveBundle` and
`StackInfrastructureManager` from `@omnitron-dev/omnitron/operations`.
This is a server/CLI entry point: keep it out of browser bundles and let the
daemon retain transport credentials in its vault. The regular CLI and Console
pipelines remain the interface for running and tracking deployments.

## Command reference

| Command | Purpose |
| --- | --- |
| `omnitron release build <project>` | Build pinned project and runtime commits |
| `omnitron release list` | List local releases and deployment information |
| `omnitron release show <id>` | Inspect commits, gates and artifacts |
| `omnitron release attest <id>` | Record probe results for a stack |
| `omnitron release push <id>` | Upload to the configured artifact store |
| `omnitron release pull <id>` | Fetch and verify a stored release |
| `omnitron release prune` | Preview or apply retention |

Use `--help` on a command for its complete option set.

## Prepare without damaging the running release

Remote application installation uses a separate directory identified by package version and artifact digest. Reinstalling a package version does not clear the currently running directory. A failed transfer or dependency install leaves existing application files in place. Dependency installation enforces package engine requirements.

For each node, all selected artifacts must install and migrate successfully before publishing new boot definitions. If one preparation fails, no candidate on that node is activated. Earlier successful migrations may already have committed: this is not a transaction across application databases. Use backward-compatible schema changes and verified database backups.

Publication preserves definitions of applications outside the selected deployment, updates the explicit host-upgrade contract's release paths while retaining its hooks, and writes private boot files through atomic file replacement. A private on-node registration snapshot supports restoring the previous configuration after a publication/registration failure. A multi-file publication can be interrupted; the host-upgrade preflight refuses inconsistent configuration. Configuration restoration does not by itself prove running processes were rolled back; inspect application health and the deployment outcome.

Before a controlled daemon upgrade, Omnitron compares the serving inventory with the configuration that a fresh daemon would load from disk. Missing applications or stale release paths fail preflight before stopping the daemon. A forked daemon's actual Node executable is captured and reused for controlled restart, without changing the host's global Node link. Systemd upgrades preserve the captured unit's runtime binding. Application-specific health checks must pass after restoration.

New nodes without a runtime default to Node 22.23.4. Existing runtimes are not globally replaced by a deployment. Check application engine compatibility and use an explicitly scoped runtime or supervisor configuration when upgrading a host that runs other software.
