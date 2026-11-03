---
title: Releases and verification
description: Build from pinned project and runtime commits, verify artifacts, attest on a stack, and retain a recovery path.
---

# Releases and verification

`omnitron release` separates building an artifact from deploying it. A release
records the **project commit** and the **Omnitron commit** used to build its
applications. The build runs in clean clones and stores its gates, artifacts
and manifest.

## Rebuilding an artifact

Register the project directory that contains its lockfile and ecosystem config.
In a monorepo, the builder clones the whole repository at the selected commit
and runs the build from that directory. The manifest records the relative path
in `project.directory` when the project lives below the Git root.

Declare `@omnitron-dev/titan` as a runtime dependency of every bootstrap
application. During packaging, the builder resolves its public entry point
inside the installed application graph. A Titan dependency provided only by a
parent workspace fails this check before an archive is written.

Build from clean project and framework commits with the checked-in lockfiles and
their pinned package manager. The build timestamp in a clean framework package is
the commit time; the release record records when the build actually ran. A source
export without Git metadata can supply `SOURCE_DATE_EPOCH` in whole Unix seconds
for the build stamp. CI compares the SHA-256 of two independently compiled and
packed archives and verifies that changing file contents or executable permission
changes the hash.

Equal archive hashes identify delivered bytes. They do not by themselves identify
a running process, or prove that native dependencies built for macOS will run on
Linux. Use the launch receipt and the destination's runtime when checking a stack.

### Match the execution target

A checked application archive contains its compiled code, production dependencies,
installed optional packages and resolved peers. Build it with the target operating
system, architecture, Node binary and libc. `omnitron release show <release>` and
**Releases → Built with** display the target. Older manifests display *Target not
recorded*. The JSON output also includes the Node executable digest.

The receiving node compares the shared Titan packages and their transitive
dependencies with the independent process owner's installed graph. Package bytes,
versions, resolved peers, optional dependencies and shared module identities must
match. The owner, the application and its extensions then resolve shared modules
to the same installed package. Application-specific packages stay in the release.

The deployment detail identifies a mismatched package or dependency. Check the
owner build and target before retrying. The node verifies the stack settings and
the installed graph before migrations or registration changes. Delivery runs offline.

The optional `NODE_OPTIONS=--max-old-space-size=<MiB>` setting must match the
value recorded in the archive. Additional module paths, loaders and preloads cannot
be attested. After start, the owner verifies the application entry point, runtime and
installed file tree. The launch receipt lets CLI and Console distinguish delivery
history from the release a process is actually running.

### Package a project-specific release

Use the headless `@omnitron-dev/omnitron/release-archive` entry point when a
project adds its own signed manifest or native artifacts. Populate a fresh staging
directory with approved files, then generate the hashes before adding your manifest.

```ts
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { releaseFileHashes, sha256File, writePortableArchive } from '@omnitron-dev/omnitron/release-archive';

const files = await releaseFileHashes(stagingDirectory);
await writeFile(join(stagingDirectory, 'release.json'), JSON.stringify({ revision, files }));
await writePortableArchive(stagingDirectory, destination, { exclusive: true });
const checksum = await sha256File(destination);
```

`releaseFileHashes` rejects symlinks. The archive writer also supports internal
relative links for dependency graphs, sorts entries, preserves executable bits
and removes filesystem timestamps. Exclusive creation protects an existing release
when two builders finish at the same time.

## Build and inspect

Register the project and commit its `pnpm-lock.yaml`. The selected project
commit determines how the controller obtains the framework.

- **npm registry.** Declare `@omnitron-dev/omnitron` in a workspace importer.
  The controller checks the public npm tarballs against the lockfile's SHA-512
  digests, verifies their common source commit and checks installed package
  files. A sibling Omnitron checkout is unnecessary. This mode requires access
  to the public npm registry and archives containing a full `gitHead`. Older
  packages without that evidence require a linked source build.
- **Linked checkout.** For framework development, point workspace links at a
  single Omnitron checkout. The controller builds the linked packages from its
  clean clone. Mixing linked and registry framework packages fails the build.

In Console, **Releases → Built with** and the CLI command `omnitron release show`
identify the framework source and package count. Use `--json` on the CLI to
inspect the recorded npm versions and integrity digests. A registry release
requires the destination process owner's full, clean framework commit as well
as a compatible runtime graph. A backend upgrade alone can leave an older owner
in charge of the applications.

If a resident owner predates build reporting, release admission asks the node to
verify the running owner on demand. The node checks the registered systemd or
launchd service, process identity and executable, and the contents of its sealed
runtime. A change of owner or controller during verification invalidates the
result. If the node cannot prove the owner build, the deployment detail reports
the reason before any migration or application restart. Inspect the owner service
on that node and retry the release check once its identity can be verified.

Pin `--project-commit` to reproduce a build. For linked sources,
`--omni-commit` selects a revision. For registry packages it checks the exact
commit already pinned by their archives.

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

## Understand what is built and what is running

A project owns multiple stacks. A release is a stored build that can be deployed
to several stacks; building or downloading it does not start any applications.
Keep these observations separate:

| Evidence | What it establishes |
| --- | --- |
| Release manifest | Source commits, build gates and packaged artifacts |
| Current stack inventory | Observed process state, application counts and node reachability |
| Last recorded deployment | The latest `stack.start` audit record for that stack |
| Attestation | What probes measured, on which stack and at what time |
| Git publication snapshot | Whether remote-tracking branches contained the commits when the build ran |

In Console, select the project and open **Releases**. **Deployment state** lists
its stacks, placement, running/configured application counts and last recorded
deployment. The same view appears on release and stack details. Stack and release
links connect these views. The artifact list counts storage on the controller,
within the selected project filter. It is not a count of active deployments.
**High host load** records a build host's five-minute load average above its CPU
core count when checks finished; gate results remain separate.

For example, `dev: stopped, Apps 0/6` and `test: running, Apps 6/6` describe two
configured stacks with only the remote stack running. A historical release beside
`test` does not prove those processes still use that build after later updates.
Updated owners report verified launch receipts: the release ID, original manifest
SHA-256, artifact SHA-256, launch ID and verification time travel with each process
observation. Console shows **Launch release verified** only when every observed
running application has complete, consistent launch evidence. Missing peers,
legacy owners, conflicting manifests and mixed releases remain explicit. A receipt
identifies the artifact admitted at launch; it does not continuously inspect code
already loaded into memory. Never infer launch identity from the last audit record,
a directory name or a build-cache marker. An unreachable node or failed inventory
request remains unknown, not stopped or empty. Launch receipts trust the node,
its process owner and local filesystem; they are not signed remote attestations
against a compromised host or another process with the same OS-user privileges.

```bash
omnitron release status sample
omnitron --json release status sample
omnitron release status sample --inspect-installed
```

This read-only command uses the same model as Console. Exit `0` means the available
observations resolve the report; `2` means incomplete evidence, including an
unreported current release or unavailable history/inventory; `1` means command
failure. JSON separates `inventory`, `history` and per-stack `runningRelease`.
The older `list` and `show` JSON retain `deployedOn` for compatibility and identify
its meaning with `deploymentEvidence: "audit-history"`.

When launch evidence is missing or an installation may have changed, use **Inspect
installed files** on the stack's Deployment state row, or `--inspect-installed` in
the CLI. This is an explicit, read-only operation available to viewers; it never
runs during status polling and never restarts applications. The node binds its
read to fresh owner observations of the process, start time and entry point,
then hashes retained archives and the current bootstrap. The controller matches
archive SHA-256 **and byte count** against every matching project manifest.

The result separates a retained base release from installed modifications. A
changed bootstrap or different reported framework build is **modified**. Reused
artifacts can match several releases: all candidates remain visible as ambiguous.
A matching bootstrap is only a partial installation check; other files and loaded
memory have not been proven. Disk observations never create launch receipts.
Missing archives, unsupported node backends, unavailable build stamps, catalog
errors and changes during inspection remain explicit, rather than becoming a
false match. JSON adds a separate `installed` collection without changing
`runningRelease`; modifications, ambiguity or incomplete inspection also exit `2`.

Inspection is bounded: one scan per node, at most 32 application handles, eight
archives per installation, 512 MiB per archive and 2 GiB of archive input per node.
Archive subprocesses have ten-second deadlines and bounded output; the node's
disk work has a 45-second deadline. A stack inspects at most 16 nodes with four
concurrent requests and reports any nodes excluded by the time budget. Larger
installations or missing sources require a separate integrity investigation. No
file paths, environment variables or archive contents are accepted from the viewer.

The neutral **History: test** label means a recorded deployment. **Git: no remote
branch** means no recorded remote-tracking branch contained a source commit at
build time. **Git: not checked** means that evidence was unavailable. Neither
label indicates execution on localhost, artifact-store upload status, or the
current state of a Git server. Rechecking the project today does not rewrite the
historical manifest.

Imported configurations retain their runtime namespace. Deployment status joins
that namespace to the canonical project/stack and chooses the newest record.
Conflicting records or invalid timestamps remain explicit uncertainty; no extra
project registration is needed.

The browser-safe `@omnitron-dev/omnitron/release-reading` entry point exports
`readReleaseDeploymentState`, `stackDeploymentHistory` and
`readSourcePublication` for other clients. It composes the existing stack and
audit APIs without provisioning, starting, stopping or deploying anything.

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

### Promoting a dependency from npm

For a coordinated Xec or Kysera release, compare each exact version with the
publisher's saved SHA-512. An accepted upload, a distribution tag and a
downloadable tarball can become visible at different times. Download by package
name and exact version from a fresh cache to exercise the same index as an
install. If this read returns `ETARGET` after npm accepted the upload, keep the
original receipt and retry the read as the registry index updates.

```sh
package='@xec-sh/core@0.11.2'
scratch=$(mktemp -d)
npm view "$package" dist.integrity --prefer-online
npm pack "$package" --ignore-scripts --cache "$scratch/cache" --pack-destination "$scratch"
printf 'sha512-%s\n' "$(openssl dgst -sha512 -binary "$scratch"/*.tgz | openssl base64 -A)"
```

Compare the SHA-512 of the downloaded bytes with both the registry integrity
and the preparation receipt. Once the whole batch matches, update the
manifests and lockfile together. Keep any minimum-release-age exception
scoped to an exact, verified package version. Run two builds from separate
clean checkouts with the same Node executable, pnpm version and target.
Compare the runtime, application archives and static assets, then test
admission of the resulting archives against the target runtime. Live release
registrations continue to refer to their original digests.

### Following a remote transfer

Open **Deployments** in the project workspace or run
`omnitron --json stack progress <project> [stack]`. Each remote stack start
assigns one operation ID to provisioning and delivery across its nodes.
Expand **Transfer details** to copy that ID, the timestamp or the selected release.
Two stacks sharing a host and an application name have separate observations.
The latest report for each stack, node and application is kept in controller
memory. An earlier controller may supply reports without workspace identity.
Console keeps those behind an explicit control. Use **Audit** for recorded
starts and **Releases** for evidence of which artifact a process loaded.

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
releases named by the latest deployment records. If that history is unavailable
or a recorded release has no identity, normal applied pruning refuses. This
protection does not attest current process identity; explicitly retain recovery
artifacts and investigate out-of-band deployments before deletion.

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
| `omnitron release list` | List controller artifacts and recorded deployment history |
| `omnitron release status <project>` | Observe stack placement, process state and separate deployment history |
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
