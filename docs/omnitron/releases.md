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

Register the directory containing the ecosystem configuration. The builder
clones the whole repository at the selected commit and reads this configuration
from its registered path. Starting there, it finds the nearest committed
`pnpm-lock.yaml` up to the repository root. That lockfile's directory owns
dependency installation, workspace builds and gates. A nested configuration can
share the monorepo lockfile. The manifest records its relative path in
`project.directory`.

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

### Qualify a separate working copy

Install dependencies in each checkout using the Node target and the pnpm version
pinned by the project. Keep `verifyDepsBeforeRun: error`. A symlink to another
checkout's entire `node_modules` also reuses that checkout's workspace state and
links; matching lockfiles alone do not make it this checkout's installation.
Share the package manager's [content-addressable store](https://pnpm.io/symlinked-node-modules-structure)
instead. On a fresh checkout, run the project's declared checks normally:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Use `--offline` for installation when the store already contains every required
package. A missing package is a failed prerequisite. Keep the lockfile, archive
integrity checks and allowed build scripts intact. Running an underlying test
binary directly can help diagnose a failure, but does not prove that the normal
package-manager entry point passed. Native dependencies must match the selected
Node, operating system and architecture.

Working-copy checks cover the files present during that run. For a release,
commit the intended source and use the existing builder. It creates fresh clones,
installs from the frozen lockfile and records the declared gates and artifacts.
For vendored framework archives, supply their full source revision and a local
repository containing it; the builder reproduces and verifies their bytes.
Reproduction executes the framework's declared `pnpm run build`, including any
auxiliary generation/declaration steps, with Turbo cache reads disabled. It does
not substitute a partial list of tasks. The result must match every committed
archive's SHA-512 before application installation or gates run.
A local Git repository is a supported source and does not require a push.

An isolated controller directory keeps qualification registrations and output out
of a running controller's registry. Create a fresh directory for the attempt,
leave its daemon stopped, and use the same directory for both commands:

```bash
OMNITRON_HOME=/work/qualification-instance omnitron project add example /work/example
OMNITRON_HOME=/work/qualification-instance omnitron release build example \
  --project-commit <full-project-sha> \
  --omni-commit <full-framework-sha> \
  --framework-repository /work/framework
```

Register the directory containing `omnitron.config.ts`, which can be nested in a
monorepo. Declare gates through `omnitron.release.gates` in the workspace's
`package.json` or its existing `scripts/gates.mjs`, never both. With neither,
the manifest records `not-run`; an artifact is not evidence that tests passed.
`OMNITRON_HOME` isolates controller state, not test databases, application ports
or external services. Configure those separately for the project's checks.

### Keep package-manager resolution semantics

A checked release preserves the production dependency graph installed from its
frozen lockfile. Build reuse hashes the effective pnpm override rules, their
ordering and local override archive contents. Version-qualified files, aliases,
parent-specific selectors and dependency removals therefore participate in the
same build identity without being converted to another package manager's rules.
Changing archive bytes at the same path invalidates reuse; an identical checkout
at another temporary path does not. Local override archives must stay inside the
selected workspace and retain their verified bytes.

An npm-installable source bundle is a different output. Its supported override
forms are narrower. In particular, pnpm's `parent>child` targets an immediate
child, while an npm nested override also affects deeper descendants. Omnitron
refuses an unsupported conversion rather than broadening its effect.
Version-qualified local archives also require the checked release path:

```bash
omnitron release build <project>
```

This packages the verified installed graph for the selected target. It does not
relax source, lockfile, archive or runtime admission checks. See the native
[pnpm override semantics](https://pnpm.io/settings/dependency-resolution#overrides)
and [npm bundle override semantics](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides).

### Keep repository identity separate from credentials

Repository addresses become public build provenance in CLI, Console and exported
manifests. Use a Git credential helper or SSH agent for authentication. Release
builds reject remote URLs containing HTTP user information, passwords, query
parameters or fragments before cloning or recording those addresses. Ordinary
SSH usernames and local repository paths remain supported.

An existing unsafe or malformed manifest is reported as **invalid manifest**,
with a safe refusal reason; it is not presented as an unfinished build. The
catalog withholds its raw metadata, including embedded producer manifests.
Admission checks the same identities without changing their pinned bytes. Restore
a verified original manifest or create a new release with a credential-free
remote; editing a selected manifest invalidates its digest.

### Inspect migration provenance

An application artifact records its owning Git package in
`artifacts[].packageSource`. The `migrations` map identifies tracked migration
files; `migrationPrograms` identifies the explicitly declared entry modules,
including registries whose filenames do not contain `migrations`.

Each declared entry records the source path, Git blob and SHA-256, plus the
compiled path and SHA-256 from the actual packed closure. The builder uses the
same database ownership and stack overrides as deployment. With `--for <stack>`,
it records that stack's declarations. Without a selected stack, it combines the
configured stacks and refuses conflicting bindings. It verifies physical files
and committed source bytes without evaluating application or migration code.

Program provenance does not prove which migrations ran in a database, nor does
it inventory every imported source file. A registry can change when adding a
migration; its fingerprint is separate from the immutable migration-file map.
The shared Kysera runner remains responsible for comparing applied migration
bodies with database history. Imported applications retain the producer's
records. Missing records in an older artifact mean **unknown**, and an empty
migration-file map does not prove the absence of migration programs.

### Inspect an archive without running it

Use the public `@omnitron-dev/omnitron/release-archive` entry point when tooling
needs to inspect compiled modules, native binaries or static assets offline:

```ts
import { inspectReleaseArtifact } from '@omnitron-dev/omnitron/release-archive';

const inspected = await inspectReleaseArtifact(releaseId, 'api', {
  files: [
    { path: 'dist/native/service' },
    { path: 'dist/native/asset.json', includeContents: true },
  ],
});
if (inspected.manifestSha256 !== trustedManifestSha256) {
  throw new Error('Release differs from the trusted selection');
}
```

Obtain `trustedManifestSha256` from the reviewed release selection, independently
of the inspected store. The result includes the consumer artifact, its original
producer and target, verified closure, and each requested file's size and SHA-256.
The default store can be overridden with `releasesRoot`.

Inspection reuses release loading, bounded extraction and complete closure
verification. It accepts a target different from the inspection machine and
never imports application code, starts an owner or records an installation.
Requested files must be physical regular members. Hashing is streamed;
`includeContents` opts into at most 4 MiB per file and 16 MiB per request.
There may be up to 64 requested files, in addition to the launch entry. Private
scratch copies are removed on success and failure. The existing full-tree
verifier's resource limits still apply.

This proves integrity against the trusted manifest, not deployment permission,
passed release gates, application behavior or migration safety. A legacy archive
without a recorded compiled launch, closure or target is refused. The shared
loader verifies all archives in the selected release, so an absent or corrupt
sibling artifact also refuses inspection.

### Match the execution target

A checked application archive contains its compiled code, production dependencies,
installed optional packages and resolved peers. Build it with the target operating
system, architecture, Node binary and libc. `omnitron release show <release>` and
**Releases → Built with** display the target. Older manifests display *Target not
recorded*. The JSON output also includes the Node executable digest.

The application owns its complete SDK and bootstrap adapter. Local and remote
installation preserve the same archived dependency graph: package bytes, peers,
optional dependencies and module identities remain those admitted by the build.
An independently updated owner supplies process supervision and the exact Node
executable; it does not replace the application's Titan or Omnitron packages.
The application SDK commit and owner commit are separate identities and may differ.

Both paths use the same bounded archive extraction and closure verification.
Before execution, they verify the archive digest and size, compiled launch entry,
private package graph, complete payload, target and allowed Node options. Checked
delivery runs offline, without installing dependencies or rebinding the graph.
A mismatch refuses the operation with its cause; rebuild for the required target
or repair the declared input instead of modifying an installed archive.

Remote admission and checked delivery use the same authenticated native owner
probe. It verifies the registered supervisor, live process, sealed runtime and
private Netron resident execution protocol 1. The probe measures the target with
the owner's actual Node executable, independently of the controller and SSH
login shell. Admission compares platform, architecture, Node version, native ABI,
executable SHA-256 and libc against each artifact's producer. A matching framework
commit cannot substitute for this evidence; different framework commits are valid.

The receiving backend supplies the extractor from its attested runtime; the
owner supplies the execution binding. Owner ID, PID and controller epoch are
checked before delivery, registration and start.
An unknown protocol, coupled daemon or changed grant refuses the operation.
These checks preserve the existing role and recipient-fencing requirements;
they are not a transaction across nodes. An older owner can run its application's
own compatible SDK without claiming newer launch-receipt capabilities.

The optional `NODE_OPTIONS=--max-old-space-size=<MiB>` setting must match the
value recorded in the archive. Additional module paths, loaders and preloads cannot
be attested. After start, the owner verifies the application entry point, runtime and
installed file tree. The launch receipt lets CLI and Console distinguish delivery
history from the release a process is actually running.

### Pin a local stack

A local stack can keep its application code separate from the developer checkout.
Its selected release identifies the archive and manifest used for future starts.
The registered project's configuration still supplies its working directories,
environment, data locations and infrastructure. A stack that has never selected
a release continues to start from its working tree.

Admission compares the configuration's source inputs with the release commit.
Relative imports may reach sibling configurations or shared files anywhere in the
same repository; those files and shipped configuration directories participate
in the check. A used symbolic link and its resolved target both participate:
changing only the link cannot silently select another configuration with identical
current bytes. Every used link must be tracked, including links in directory paths;
its resolved target must stay inside the same repository and cannot be an ignored
source input. The same rules cover links used by shipped configuration files.
Untracked or escaping links, ignored targets, imported code outside the repository,
and source inside a Git submodule without its own verified binding refuse admission.

An input-inventory error stops preparation; it does not silently reduce the set of
checked files. Ordinary ignored runtime files, such as machine-local secrets read
explicitly by configuration, remain runtime inputs whose bytes are not verified
against the release commit. This exception does not make ignored imported code or
a used symlink's ignored target admissible. A source receipt does not attest every
external file or service that trusted configuration code can read.

1. Build the project release for the local execution target. Each application
   needs a packaged entry and a complete production dependency graph. Bootstrap
   apps must resolve their own compatible Titan and Omnitron adapter. By default
   the packed bootstrap is `dist/bootstrap.js`. Set the app's `releaseEntry`
   to select a different compiled JavaScript file inside its package.
2. Run `omnitron --json stack prepare-release <project> <stack> <release>`.
   Preparation verifies the archives and stages them in a private directory.
   It can run while the stack serves traffic. A successful preparation can
   report `prepared: true`, `ok: false`, `state: "requires-stop"`. The files
   are ready, but active applications still use the previous code.
3. Record the current selection from `omnitron --json stack status <project> <stack>`
   and agree on an application maintenance window. To keep databases and other
   stack containers running, review
   `omnitron stack stop <project> <stack> --keep-infrastructure --dry-run`, then
   execute the same mode with `--review <digest>`. This stops the applications,
   disables automatic resume and preserves infrastructure ownership and the
   selected release. Confirm every stop receipt before proceeding. Omit
   `--keep-infrastructure` only when the reviewed plan includes container removal.
   Keep the previous release or working tree available for recovery.
4. Run `omnitron stack start <project> <stack> --release <release>`. Verify
   application readiness and source-specific health checks. A plain subsequent
   start, including controller recovery, selects the same manifest. Project
   reloads preserve the physical release entry.

The controller stores the selected ID and manifest SHA-256 in SQLite. The owner
keeps the applications fenced while their definitions change. If the owner loses
an acknowledgement during the switch, inspect the stack before issuing an explicit
start to finish the operation. Changed or missing release contents block launch.

Before testing controller crash recovery, check that
`execution.recovery.status` is `ready` for the new generation. Stopping or
starting an application invalidates the previous certificate. A crash before
the next certificate leaves the resident owner serving its applications and
the supervisor waiting for reconciliation. See [Recovery after a backend
crash](./backend-handoff.md#recovery-after-a-backend-crash).

To roll back, confirm the affected applications have stopped and run the same
start command with the previous release ID. If the original source was the
working tree, use `omnitron stack start <project> <stack> --working-tree`.
The choice affects later restarts. Database migrations, external writes and
events that arrived during downtime need their own compatibility and recovery
plan. A code rollback does not restore that data.

A local pin requires a connected independent execution owner on macOS or Linux
and the Node executable digest recorded at build time. An allocation owned by another controller
takes its release from that controller. A local gateway serving a mutable
working-tree static directory cannot use this release selection. An application
relying on a script or symlink outside the archive must package that dependency
before it can be pinned.

### Development mode and a selected release

A local stack can run either its registered working tree or a selected release.
A local host, a project checkout used as `cwd`, and `watch: true` do not imply
that the running code comes from that checkout. Inspect each application's
observed release identity and entry point. A packaged static web server does not
run Vite or provide HMR; editing the checkout cannot update that server.

The current persistent selection applies to the **whole stack**.
`stack start --working-tree` changes later launches for all its applications and
requires a reviewed stop of that stack. `project reread` preserves a selected
release. There is currently no durable per-application switch between working-tree
and release code. Do not replace an installed payload or redefine an owner entry
privately to simulate one: that bypasses selection and can be lost on recovery.

A reliable per-application transition requires the same persisted source selection
in startup, reread and diagnostics, together with an owner transition scoped to the
selected applications. It must preserve other process identities, survive a
controller interruption and retain the previous source for rollback. Until that
contract is implemented and qualified, a stack containing shared scientific or
production services must not be switched to development mode as a frontend fix.

### Use an application from another project

A consumer can pin one application from an independently built producer release.
The producer release must already exist in the controller release store. Obtain
its ID and exact `manifestSha256` with `omnitron --json release show <release-id>`;
Console shows the same digest under **Releases → Built with → Manifest SHA-256**.
Record both values in the consumer configuration:

```ts
{
  name: 'collector',
  releaseFrom: {
    release: producerReleaseId,
    manifestSha256: producerManifestSha256,
    app: 'feed',
  },
  env: { CAPTURE_MODE: 'continuous' },
}
```

Build the consumer through the ordinary `omnitron release build` command. It
checks the producer gates, archive size and digest, frozen entry, package source
and execution target. An old archive without those records cannot be imported.
A consumer alias changes the application name in its stack; it does not rebuild
the archive or replace the producer's SDK. The consumer carries the exact producer
manifest bytes and its archive, so it remains self-contained if the standalone
producer release is later removed from the store. Nested imports preserve every
producer reference and its independent gate results.

In **Releases → Artifacts**, expand an application's source to see its producer
repository and commit, SDK commit, target and manifest chain. CLI text and JSON
show the same per-application origin. The consumer's top-level source fields
still describe its own build. These are recorded build inputs; current launch
observations remain in **Deployment state**.

Imported applications currently use verified **local** release installation.
Prepare and select the consumer release as described above. The producer's Node
executable, ABI and platform must match the local execution owner, and its own
adapter and dependencies must remain inside the archive. Its default working
directory is the installed package. An explicit `cwd` can name external mutable
data, but must not reintroduce runtime code or dependencies from a development
checkout. A `releaseFrom` entry cannot also override `bootstrap`, `script`,
`releaseEntry`, `releaseRoot` or enable a watcher.

Preparation verifies code without executing the producer bootstrap. Prerequisite
and topology details remain unknown until its declaration is available through
the normal application lifecycle; an unresolved import is reported explicitly.
When replacing a selected release, migration checks compare the actual producer
package and its existing migration files. Missing previous provenance or changed
applied migrations block the update.

Remote deployment of an imported application is refused before provisioning or
registration changes. It needs producer-captured deployment declarations and a
compatible remote owner; a local import does not grant those capabilities.
Older local owners may run the verified package while reporting no launch
receipt. The selected release and inspected files remain useful evidence, but
neither is presented as a confirmed current process identity.

### Read the executing application's origin

A packaged application can use the public `@omnitron-dev/omnitron/runtime` entry
point to associate its durable output with the bytes admitted for its launch.
The normal Omnitron bootstrap supplies `RUNTIME_CONTEXT` through Titan dependency
injection before eager providers initialize. This does not add a dependency on
Omnitron to Titan itself.

`InstalledRuntimeContext` has two explicit states:

| State | Meaning | Application behavior |
| --- | --- | --- |
| `verified` | The compiled entry, installed payload, SDK binding, Node executable and allowed options match the private installation receipt. | Record the producer and consumer identity with new output. |
| `unavailable` | Development or a legacy installation has no compatible origin contract. | Report unknown provenance or refuse an operation that requires it. |

Malformed metadata, a changed payload or a mismatched runtime throws
`RuntimeOriginVerificationError`. These failures never become an unavailable
context. Verified bootstrap children must load compiled modules from the same
checked installation. Working-tree development retains its ordinary loading path.

The verified context contains `producer` (`ArtifactIdentity`), `consumer`, `entry`,
`payloadSha256`, `executableSha256` and `observedAt`. Imported artifacts retain the
original producer's release, manifest, archive, project commit and SDK commit.
The consumer records the selected release and application alias separately.
Local preparation and remote receipt generation use the same origin mapping.
When a compatible owner verifies a consumer binding, CLI and Console group its
applications under that selected release and retain each original producer in the
expanded evidence. Different producers within one consumer release are therefore
not mistaken for conflicting deployments. Missing or malformed consumer evidence
never becomes a confirmed selection; legacy launch receipts retain their original
meaning.
Remote imports remain subject to the deployment restrictions described above.

`ownerAttestation` is explicitly `null`: startup payload verification is not a
process-owner launch receipt or continuous verification of running memory. An
older owner may execute the application while its launch identity remains
unreported. The application SDK cannot add unsupported owner capabilities.

For a standalone compiled script, call `verifyInstalledRuntime(new URL(import.meta.url))`
before starting work. This verifies the actual script entry; environment variables,
a source checkout's Git HEAD and a package version are not substitutes.
Browser DTOs can use `ArtifactIdentity`, `assertArtifactIdentity` and
`parseArtifactIdentity` from `@omnitron-dev/omnitron/runtime/identity` without
importing filesystem or process APIs. Parsing validates the six identity fields;
it does not admit an artifact or prove that a caller supplied truthful metadata.

For a data collector, commit an ingestion session with this context before opening
an external stream, and preserve that session identity through downstream processing.
Do not relabel historical rows or another producer's messages with the current
aggregator's runtime. Keep absent historical evidence explicit.

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

- **Package registry.** Declare `@omnitron-dev/omnitron` in a workspace importer.
  The controller resolves the project's registry configuration, checks the original
  archives against the lockfile's SHA-512 digests, verifies their common source
  commit and checks installed package files. A sibling Omnitron checkout is
  unnecessary. Archives must contain a full `gitHead`; older packages without
  that evidence cannot establish their framework commit. Registry credentials
  belong to the package manager configuration, not the release manifest.
- **Committed framework archives.** A workspace may pin local framework tarballs
  in Git. Supply the exact source commit with `--omni-commit <sha>`.
  The release builder independently builds that commit from the selected source,
  compares package contents with the archives, checks their lockfile SHA-512
  digests and verifies the installed package files. No hosting provider or branch
  name is mandatory. A manifest written by the consuming project cannot establish
  package origin by itself.
- **Linked checkout.** For framework development, point workspace links at a
  single Omnitron checkout. The controller builds the linked packages from its
  clean clone. Mixing linked and registry framework packages fails the build.

### Read the build result

A retained manifest means packaging finished; it does not mean the release passed
its checks. CLI and Console interpret the same recorded gate and artifact outcomes.
`release build` exits **0** only when every recorded check passed and no artifact
failed, **1** for a failed check or artifact, and **2** when checks are absent or
unfinished (including `--skip-gates`, timeouts and killed checks). A failure takes
precedence over unfinished checks. Signals and earlier build exceptions retain
their ordinary nonzero exit codes.

Console marks an unsuccessful build as failed, displays the specific gate or
artifact reason, and retains its release ID, manifest, logs and individual results
for diagnosis. Successful build checks do not authorize deployment: destination,
source, runtime, role and lifecycle admission still run when selecting the release.

### Choose an SDK source

Repository location and trust are separate concerns. Omnitron uses Git rather
than a hosting provider's API to inspect source history. GitHub, GitLab, private
servers, mirrors and local repositories use the same contract. The official
package's repository is a default supplied by its metadata, not a platform
requirement.

Keep project defaults beside its existing release gates in the workspace
`package.json`:

```json
{
  "omnitron": {
    "framework": {
      "repository": "ssh://git@forge.example/platform/omni.git",
      "ref": "refs/heads/stable"
    },
    "release": {
      "gates": ["typecheck", "test"]
    }
  }
}
```

`repository` selects the actual SDK source. `ref` is optional: a full
`refs/heads/...` requires the exact commit to belong to that branch; a full
`refs/tags/...` requires it to match that tag. Omitting it does not imply `main`.
Configuration is read from the selected project commit. Selection follows one
order: a build override, committed `omnitron.framework`, then the locked
framework package's repository metadata. Legacy packages without repository
metadata use the builder package's declared repository. Linked development uses
its linked checkout unless an explicit source is selected. Invalid explicit
configuration fails instead of silently selecting another source.

A deliberate per-build override replaces that selection:

Through Console or RPC, selecting another SDK repository or supplying any
nonempty environment override requires a current administrator session and a
durable audit intent before the build starts. Source scripts and environment
settings for Git, package managers or interpreters can execute code as the
controller's OS user. The audit records environment variable names, never their
values. An empty environment object does not constitute an override.
Operators can still build registered projects using committed source settings
and the existing controller environment. The local CLI operates with the invoking
OS user's existing access; environment validation still applies.

```bash
omnitron release build sample \
  --framework-repository https://mirror.example/platform/omni.git \
  --framework-ref refs/tags/v1.0.0 \
  --omni-commit <full-commit>
```

Integrations and browser forms can validate the same request with the pure
`parseFrameworkSource` function from `@omnitron-dev/omnitron/release-source`.
It returns the `FrameworkSource` contract and rejects unknown fields, ambiguous
refs and credentials; it does not fetch code or grant permission to build.

The Console build dialog exposes the same options under **SDK source**. Ordinary
builds need no extra fields. CLI and Console report the selected repository, ref
and exact commit in build progress. Overrides are recorded with the build request, and
the resulting manifest retains the resolved repository, exact commit and any
required ref. Console disables overrides without current administrator access or
when an older controller does not report support; those controllers retain their
previous source-selection behavior.
Credentials must stay in Git's SSH agent or credential helper; URLs containing
passwords or HTTP tokens are rejected before logging the request.

Registry downloads use pnpm's own configuration, authentication and HTTP client.
The clean selected workspace supplies `pnpm-workspace.yaml` and `.npmrc`; user
configuration supplies credentials, including user-only `tokenHelper` commands.
Scope registries, TLS and proxy options follow the same precedence as the frozen
install. Download verification never executes package lifecycle or `.pnpmfile`
hooks. Original compressed bytes must match the committed SHA-512 before their
contents can establish package identity.

Run the controller in an ordinary environment without Git repository/object
redirects such as `GIT_DIR` or `GIT_OBJECT_DIRECTORY`. Source verification refuses
these overrides because they can change which repository is inspected. The
current Xec 0.11.2 process API inherits ambient environment keys; an internal
registry request that requires removing a key is refused before starting a
worker rather than claiming isolation that the transport cannot provide. Git
credential helpers and SSH configuration remain available.

### Build from local sources

The registered project's local Git checkout supplies its selected commit; a
reachable project hosting service is not required to clone those local inputs.
Use a local SDK repository explicitly when its commit is available only on the
build machine:

```bash
omnitron release build sample \
  --project-commit <full-project-commit> \
  --framework-repository /srv/sources/omni \
  --omni-commit <full-framework-commit>
```

The builder still creates clean clones, performs the frozen install and declared
gates, and verifies archive contents. Prepared dependencies or an accessible
registry are required; choosing local Git does not make missing packages available.
For a fully offline build, prepare those dependencies and any gate fixtures first.

Source publication is a separate, build-time observation. A local repository
can be a valid build input without being remotely published. A network failure
or unavailable ancestry is **unverified**, not evidence that a commit is
unpublished. Cached remote-tracking branches alone do not establish publication.
The stack's `release.requireOnRemote` policy decides whether confirmed remote
publication is required for deployment. When omitted or `false`, publication is
not a prerequisite; a release must still satisfy every other requirement.
An explicit `true` remains enforced, including for imported producers. Source
overrides do not skip gates, checksum checks or that policy. These states never indicate where an application
is running. Offline use also requires that the selected sources, dependencies
and declared gates are available in that environment.

In Console, **Releases → Built with** and the CLI command `omnitron release show`
identify the framework source and package count. Use `--json` on the CLI to
inspect the recorded npm versions and integrity digests. On a remote stack, a
registry release requires a verified execution owner and compatible Node target.
Its application SDK remains the exact packed graph identified by the producer;
it does not have to share the owner's SDK commit. A backend upgrade alone can
leave an older owner in charge of the applications.

Release admission obtains native evidence through the same registered SSH
credentials, host verification and private Netron endpoint as installation. It
does not infer compatibility from the public daemon version or demand that an
application use the controller's SDK. The current remote managed-owner probe
supports Linux systemd installations; local installation verifies its resident
owner and native executable on the local host. A changed owner or controller
grant invalidates the proof. An unavailable owner, incomplete target or coupled
daemon produces a refusal before any migration or application restart. Repair
the stated condition and repeat the release check; changing a build stamp does
not establish compatibility.

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

To run the workspace's existing checks as release gates, declare their script
names in the workspace `package.json`. For example, set
`"omnitron": {"release": {"gates": ["typecheck", "test"]}}` when both scripts
exist. Each runs through `pnpm run` in order. A failed or interrupted script
leaves each later gate marked `not-run`. Use one gate definition per workspace.
A project that supplies both this list and `scripts/gates.mjs` fails validation.

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
| Git publication snapshot | The recorded source-publication result at build time; new builds query the declared origin |

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

The neutral **History: test** label means a recorded deployment. **Git:
publication recorded** means the manifest recorded a positive source-publication
result. **Git: unpublished source** means it recorded a negative result, including
an explicitly local source. **Git: unverified** means the builder could not
establish publication. These labels describe source evidence, not execution on
localhost, artifact-store upload status or the current availability of a Git server.

New builds query the declared origin's current branches and tags. Cached remote
refs alone cannot establish publication. Older manifests retain the weaker
remote-tracking observation made by their builder; upgrading Console does not
strengthen or rewrite those receipts. Rebuild to obtain the new observation.
The existing `requireOnRemote` stack policy continues to evaluate the recorded
result so that an upgrade does not silently invalidate pinned releases or rollback.

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

Remote application installation uses a separate directory identified by package
version and artifact digest. Reinstalling a package version does not clear the
currently running directory. A failed transfer, archive validation or target check
leaves existing application files in place. Checked releases never install
packages on arrival. The explicit legacy development bundle path has separate
installation and engine checks; it is not a fallback for a rejected checked release.

The installation receipt records the unchanged application SDK and payload,
producer and consumer identities, exact execution target and physical owner
binding. Reusing another owner's receipt is refused even when its SDK bytes
match. Preparation does not evaluate an application module. An installed entry
must pass its receipt check before bootstrap introspection or script execution;
a missing or modified receipt cannot silently turn it into a development app.

For each node, all selected artifacts must install and migrate successfully before publishing new boot definitions. If one preparation fails, no candidate on that node is activated. Earlier successful migrations may already have committed: this is not a transaction across application databases. Use backward-compatible schema changes and verified database backups.

Publication preserves definitions of applications outside the selected deployment, updates the explicit host-upgrade contract's release paths while retaining its hooks, and writes private boot files through atomic file replacement. A private on-node registration snapshot supports restoring the previous configuration after a publication/registration failure. A multi-file publication can be interrupted; the host-upgrade preflight refuses inconsistent configuration. Configuration restoration does not by itself prove running processes were rolled back; inspect application health and the deployment outcome.

Before a controlled daemon upgrade, Omnitron compares the serving inventory with the configuration that a fresh daemon would load from disk. Missing applications or stale release paths fail preflight before stopping the daemon. A forked daemon's actual Node executable is captured and reused for controlled restart, without changing the host's global Node link. Systemd upgrades preserve the captured unit's runtime binding. Application-specific health checks must pass after restoration.

New nodes without a runtime default to Node 22.23.4. Existing runtimes are not globally replaced by a deployment. Check application engine compatibility and use an explicitly scoped runtime or supervisor configuration when upgrading a host that runs other software.
