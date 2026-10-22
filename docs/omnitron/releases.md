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
