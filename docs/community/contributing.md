---
id: "community/contributing"
slug: "/docs/community/contributing"
sidebar_position: 1
title: Contributing
description: Set up the source or documentation repository and verify a focused change.
---

# Contributing

Omnitron maintains two public repositories:

| Repository | Contents |
| --- | --- |
| [omnitron-dev/omni](https://github.com/omnitron-dev/omni) | Runtime, packages, supervisor, CLI and web console |
| [omnitron-dev/website](https://github.com/omnitron-dev/website) | This documentation site |

Each repository has its own package manifest and lockfile. Clone them as
sibling directories when working on documentation that needs source checks.

## Work on the runtime {#work-on-the-runtime}

Install Node.js 22+ and the pnpm version declared in `package.json`.
Docker is needed for tests that use external services.

```bash
git clone https://github.com/omnitron-dev/omni.git
cd omni
pnpm install --frozen-lockfile
pnpm build
```

Run the relevant package checks before broad workspace checks:

```bash
pnpm -F @omnitron-dev/titan-cache test
pnpm -F @omnitron-dev/titan-cache typecheck
pnpm lint
pnpm fm:check
```

Omnitron's `pnpm -F @omnitron-dev/omnitron typecheck` checks the Node.js
implementation and every server test. `typecheck:tests` runs the latter check
on its own. Server fixtures retain the backend's strict settings, with the
module resolution used by Vitest. `pnpm -F @omnitron/console typecheck` checks
the browser implementation and all Console tests against the same Prism and
browser contracts. These commands run in the workspace CI typecheck job.
A test that executes successfully must also satisfy its current public types;
do not hide obsolete fixture fields or missing evidence behind casts.

Pass test paths directly to pnpm scripts, for example:

```bash
pnpm -F @omnitron-dev/omnitron test test/unit/release-owner-admission.test.ts
```

The root `pnpm test` runs the workspace suite. `pnpm test:ci` starts a dedicated
Compose project, runs that suite and removes its test resources on success or
failure. CI runs the complete suite in addition to focused release and security
gates; a passing focused gate does not substitute for the full run. For repeated
local tests, use `pnpm test:up` and `pnpm test:down` instead. Redis-backed suites
use real test infrastructure in CI too. `USE_MOCK_REDIS=true` is an explicit
unit-only mode; unavailable Redis does not silently select it. Read
[Testing](../testing/index.md) for the distinctions between unit,
integration and cross-runtime tests.

## Update dependencies together {#update-dependencies-together}

Update manifests and the lockfile in an isolated checkout, then build and test
before changing a running deployment. Use the package manager version pinned in
`package.json`; an older pnpm cannot read every lockfile produced by pnpm 12.
The workspace keeps resolution rules, patches and explicit lifecycle-script
permissions in `pnpm-workspace.yaml`.

```bash
pnpm -r update --latest --lockfile-only
pnpm install --frozen-lockfile
pnpm peers check
pnpm build
pnpm check:packages
```

Review major-version migrations and peer ranges. A transitive security override
across a major version needs compatibility checks for the actual consuming API;
changing its resolution alone does not establish compatibility. Keep package-manager
supply-chain checks and review version-specific exceptions. Run checks for the
affected runtime, browser and CLI paths.

The workspace uses the hoisted pnpm layout declared in `pnpm-workspace.yaml`.
It enables standard `bundledDependencies` archives for the KB extraction toolchain:
`ts-morph` and its dependency tree are packed from the tested lockfile. This keeps
the corrected glob implementation in the published package. Consumers choose their
own installation layout and do not need Omnitron's workspace overrides. Reinstall
with `pnpm install --frozen-lockfile` when changing the workspace layout; a local
package-manager configuration must not override the tracked layout.

The workspace installs the native TypeScript 7 compiler as `@typescript/native`
and the current compatible Compiler API as `typescript` through the
`@typescript/typescript6` npm alias. `tsc` uses the native compiler; ESLint and
API-based tooling use the compatibility package. Both are development tools,
not runtime requirements for applications.

`pnpm check:packages` packs every public workspace and verifies that all declared
exports, types and command entry points exist in the archive. CI runs it after
building. Its `--install-consumer /absolute/new/directory` option also installs the
real archives with npm, replays the consumer's generated lockfile with `npm ci`
and audits the resulting production dependencies. Both minimal and all-package
installations must pass.
Release preparation requires that audit and the public runtime checks, including
TypeScript extraction and a SQLite journal write/read. An unavailable audit or a
reported vulnerability fails preparation; a clean workspace audit cannot substitute
for this consumer check.

When a library embeds a development dependency, list its exact name in
`package.json#tsup.noExternal` and use that list in the tsup build. The source
check accepts that build input; the archive check rejects a JavaScript import or
type declaration that would still require the package on a consumer's machine.

Netron React supplies both ESM and CommonJS declarations. The testing
package uses Node.js 22.12+ native `require(esm)` support for its CommonJS entry
conditions. Validate
consumer applications against the same package artifacts and ensure Titan
resolves to one instance per application. Preserve the previous lockfile,
artifacts and state snapshot for rollback. An immutable experiment that pins
an older runtime needs a separate registration for an upgraded environment;
replacing its recorded hashes changes the experiment rather than reproducing it.

Published Omnitron 0.4.10 uses Xec 0.12.0 packages. Package manifests and the
committed lockfile select their versions and integrity; workspace overrides and
patches are declared in `pnpm-workspace.yaml`. No third-party package source is
currently stored under `vendor/`. Run the dependency and package-consumer checks
when updating these inputs; do not add a second SSH transport to Omnitron.

The current unreleased backup-recovery implementation requires the Xec Core
0.13 execution-ownership contract. Release preparation checks both the declared
application dependency and the installed package before changing versions or
starting a build. Local isolated builds repeat that check after frozen install.
Until the required Xec package is published and the lockfile is updated, preparation
fails explicitly. Existing sealed archives can still be inspected or published
without rebuilding them. The repository driver remains the pinned published CLI;
a locally built Xec binary is not a substitute for the missing runtime contract.

A consumer that develops against Omnitron source can use relative `link:`
dependencies into one checkout. Keep its manifests and workspace overrides in
agreement. The release builder reproduces that layout with clean Git clones and
checks that every framework link resolves into the selected clone. pnpm 12
lockfiles contain separate YAML documents for tooling and application packages;
release tooling reads the application importer graph across those documents.

## Work on the documentation {#work-on-the-documentation}

From the parent directory of your source checkout:

```bash
git clone https://github.com/omnitron-dev/website.git
cd website
pnpm install --frozen-lockfile
pnpm start
```

The development server prints its local URL. Before submitting a change:

```bash
pnpm check:content
pnpm typecheck
pnpm build
```

The production build rejects broken page links and anchors. Test search
against a production build with `pnpm serve`; the local search index is
generated during the build.

For checks against a sibling source checkout:

```bash
pnpm check:source ../omni
```

These checks compare inventories, CLI commands, package subpaths, defaults,
service names and catalog coverage with source. They do not establish that
every documentation example runs; execute the examples you change.

## Write a useful page {#write-a-useful-page}

State the outcome and prerequisites first. Use complete file names for
runnable examples and label excerpts as excerpts. Explain configuration
defaults, errors, lifecycle behaviour and the next operational step where
they affect the reader.

- Use sentence case, explicit code languages and relative links.
- Keep third-party references relevant to actual dependencies or integrations.
- Use neutral example names and reserved example domains.
- Link to public source paths that a fresh checkout can resolve.
- Mark proposals **Design RFC** and distinguish them from shipped APIs.
- Add a page to `src/data/sidebars.json` so readers can discover it.

## Change the code {#change-the-code}

Follow the package's existing conventions. Preserve public API compatibility
unless the change deliberately introduces a documented migration. For a bug
fix, add a regression test that exercises the failed behaviour.

Keep type-only imports explicit and use `.js` extensions for relative ESM
imports. Use the repository's lint and formatting configuration.

## Submit a change {#submit-a-change}

Open a focused pull request in the repository you changed. Describe the
problem, the resulting behaviour and the checks you actually ran. Link a
related documentation PR when the code and manual need to change together.

Use a descriptive conventional commit title, such as
`fix(titan-cache): invalidate tagged entries` or
`docs(netron): explain HTTP startup`.

## Release process {#release-process}

The repository uses Xec as its scripting engine. Run the checked-in recipes through
the pinned CLI installed by `pnpm install --frozen-lockfile`; `pnpm release` is the
same entry point as `pnpm exec xec release`. No temporary publisher or personal
shell setup is required.

The implementations live in `.xec/commands/`: `release`, `release-build`,
`check-packages`, `reproduce` and `update`. They register their options, arguments
and update subcommands directly with Xec; there is no second argument parser or alternate
release script. Use `pnpm exec xec release --help`,
`pnpm exec xec update --help`, or a specific subcommand's `--help`. Unknown options,
extra arguments and conflicting release operations fail before the action.

From a clean `main`, inspect the inventory and plan:

```sh
pnpm exec xec release --list
pnpm exec xec release <version> --dry-run
```

Prepare and qualify the release with the full commit of the backend being replaced:

```sh
pnpm exec xec release <version> --prepare --previous <full-previous-commit> --push-source
```

This command commits synchronized public versions, builds and checks the package
archives in an isolated source export, creates a local annotated tag, and pushes
only the exact source branch for CI. Omit `--push-source` if your Git publication
is handled separately. The same Xec workflow runs the independent build comparison,
CI checks and native transition/rollback checks concurrently after preparation.
The policy in `.xec/release-policy.mjs` selects the CI executor and exact Node
versions. This repository uses GitHub Actions; the Omnitron platform and
application deployment do not require GitHub.

Local preparation and reproducibility use two independent clean builds in total.
The producer builds and freezes its runtime once. Xec packs each public package
once, adds its exact source provenance, validates it and retains the resulting
immutable batch before consumer acceptance. Consumer checks read those same
archive bytes; they never pack a replacement. This contract requires published
Xec Ops 0.13 and is refused on an older installed API.

If acceptance fails, repeat `--prepare` from the same clean commit and inputs.
Xec verifies `producer.json` and every archive, then runs acceptance in a fresh
source-only snapshot. It installs verification tools but does not rebuild the
producer. The final `release.json` is written only after acceptance and cleanup
succeed. A changed input or damaged archive is an explicit refusal, not a cache
miss that silently starts another build.

Qualification verifies the accepted first build and performs one further build
from a fresh checkout and frozen installation. Both use the same commit, Node version,
platform, architecture, pinned pnpm and build policy, with build-cache reads
disabled. The environment is explicitly replaced rather than overlaid: required
system/tool/cache settings and public Vite inputs are selected; daemon authority
and ambient Turbo credentials are excluded. Receipts bind environment and
configuration digests, the frozen lockfile and the installed Xec driver closure
without recording credential values. `NODE_OPTIONS` may set resource and diagnostic
limits, but may not inject external loaders into the producer. Both producers run
pending dependency builds under the checked-in pnpm policy without restoring native side-effect caches. The sealed runtime, Console
and normalized public npm archives must match. Missing, changed or incompatible
preparation evidence stops qualification.
CI and native jobs still perform their own target-specific builds. The standalone
`pnpm check:reproducibility` gate performs two fresh builds when no preparation
is supplied.

Within each workspace build, `pnpm build` requests `build` and `build:titan` in
one Turbo graph, so shared prerequisites run once while their declared ordering
remains enforced. The full workspace test job completes that build before running
`pnpm test:ci --only` with `TURBO_FORCE=true`: every normal package test executes
without restoring cached results, and its build prerequisites are already present.
The ordinary developer command `pnpm test:ci` still builds prerequisites. These
changes remove duplicate work; elapsed release time depends on the completed
local and remote runs.

The CI reproducibility job installs this same frozen workspace before running
`pnpm check:reproducibility`, which invokes the pinned Xec engine. A fresh runner
does not depend on a globally installed Xec or another job’s build output.

The qualification binds every result to the candidate commit, previous backend,
policy and build Node version. It requires all configured CI jobs and native transition
and rollback on every configured Node. A lost workflow dispatch response is
reconciled by its saved intent; repeating the command does not dispatch a duplicate.
A failed native run remains failed. Inspect it before explicitly retrying the
GitHub run; Xec observes its new attempt when qualification is resumed.

```sh
pnpm exec xec release <version> --qualify --previous <full-previous-commit>
pnpm exec xec release <version> --status
```

Preparation evidence is retained under
`.release-artifacts/qualification/<commit>/preparation/`: the runtime's `BUILD.json`
records production, while `PREPARATION.json`, `sdk/` and `sdk-inventory.json`
are finalized only after Xec has sealed the accepted batch. `BUILD.json` alone
is not consumer acceptance or publication authority. The qualification directory retains
`qualification.json` with each stage's evidence, plus the accepted independent
build's `QUALIFICATION.json`, runtime and SDK archives. On resume, completed
stages are reverified and reused. A partial build directory is not a completed
receipt. `--status` checks the selected evidence without builds, workflow
dispatches or receipt changes.

Native CI retains the actual tested Linux runtimes. Xec downloads them, verifies
their source, run, attempt, archive checksum and runtime digest, and extracts them
with Omnitron's existing archive validator. Evidence and artifacts live under
`.release-artifacts/`. Use an external development volume for large builds and
set `TMPDIR` and package manager cache directories before the command if required
by your machine.

Package preparation verifies exports and three ordinary npm consumers without
workspace overrides: a minimal CLI/Netron runtime, every public package together
and Lumen on its own, including optional dependencies. The runtime runs one
ordinary `npm install`; the other two resolve fresh lockfiles and install once
through `npm ci`. All profiles verify installed archive integrity and run an audit.
Inspect `release.json`, SHA-512 digests and `NOTES.md` under `.release-artifacts/<version>/<commit>/`.

Publish the sealed batch:

```sh
pnpm exec xec release <version> --finish
```

Publication rechecks the saved qualification and archive bytes; it does not rerun
builds or tests. Xec checks npm authorization before pushing the selected commit
and its single tag, submits the archives and completes the GitHub release only
after npm confirms the batch. The separate `--push`, `--publish`, `--resume`
and `--github` operations use the same qualification gate.

If npm reports an expired session, run
`npm login --auth-type=web --registry=https://registry.npmjs.org/` and check
`npm whoami --registry=https://registry.npmjs.org/`. Credentials remain in
npm's normal configuration; qualification receipts contain no tokens.

### Browser approval and recovery {#browser-approval-for-a-package-batch}

Complete the npm challenge in the browser. If npm offers temporary approval for
the current IP and token, it can cover subsequent uploads during that period.
Xec submits the archives in dependency order, then verifies version metadata,
downloaded SHA-512 and the release channel. Registry scanning can continue after
an upload is accepted. [npm browser authorization](https://github.blog/changelog/2022-07-26-general-availability-of-improved-2fa-experience-in-npm/).

Keep the exact clean checkout and its original artifacts after an interruption.
Repeat `--finish` for that version; Xec reconciles saved uploads and waits for
registry confirmation. Never rebuild a reserved version to resolve a conflict.
Use the same `--registry <url>` when resuming a private registry release.

### Correct an unsubmitted draft

If qualification finds a defect after local preparation, preserve the prepared
commit in a clean checkout of the same repository with its original archives.
Commit the fix on `main`, then run
`pnpm exec xec release <version> --supersede <old-checkout>` from `main`.
Xec verifies the old sealed artifacts, refuses any publication journal or remote
tag, and preserves the annotated object under `refs/release-attempts/` before
removing the old local tag with compare-and-swap. It never changes an npm version
or remote reference. Then repeat preparation on the new commit. A release that
was already submitted must resume its exact bytes or use a new version.

### Managed controller updates

Xec coordinates the update through Omnitron's existing lifecycle API. The daemon
owns role checks, immutable runtime pins, operation locks, progress and rollback.
Xec does not stop services over SSH or implement another process owner.

From the qualified checkout, prepare selected registered remote nodes:

```sh
pnpm exec xec update plan <candidate-commit> --node test-controller --node production-controller
```

The recipe imports the retained native runtimes, stages matching variants and
returns the durable Omnitron plan. It does not activate them. Review that plan and
its impact before applying it:

```sh
pnpm exec xec update apply <plan-id>
pnpm exec xec update status <plan-id>
pnpm exec xec update reconcile <plan-id>
```

A blocked or uncertain operation retains its receipt and returns a nonzero exit
status with the controller’s reason. Migration incompatibility requires a separate
database transition; the recipe does not bypass that refusal.

Use `--request-id <uuid>` to reuse a known planning request. After a lost
activation response, inspect or reconcile that ID; never replay activation
blindly. An already qualified runtime from another builder can be supplied with
`--runtime <directory>`. `--cli <executable>` selects the fleet controller CLI.

For a completed local development batch, use the native local-sync command:

```sh
pnpm exec xec update local-sync
pnpm exec xec update local-sync --review <sha256>
pnpm exec xec update local-sync --status
```

Preparation returns a review of supervision, Console and the exact local stack
selections. Applying the digest may restart those applications; review the scope
and recovery limitations first. After interruption, inspect status before
requesting recovery with `local-sync --review <sha256> --rollback`. Set
`OMNITRON_DEV_CACHE` or use `--cache-dir` to retain verified builds between batches.
The status and recovery paths reuse retained evidence and do not start a build.

For a backend-only transition, the separate commands below preserve the execution
owner. Xec runs the sealed candidate's own Node and CLI so admission checks
understand its requirements; `--cli` cannot substitute an older CLI for these
local check/apply operations:

```sh
pnpm exec xec update local-check <qualified-runtime>/packages/0/dist
pnpm exec xec update local-apply <qualified-runtime>/packages/0/dist
```

These commands retain the execution owner. A required owner, guardian or schema
transition is reported by Omnitron and must follow its own reviewed plan; it is
never silently folded into a backend update. Updating the Console container is
also a separate service operation when required by its deployment configuration.

The CI rehearsal executes the release through the actual Xec CLI against a
loopback registry. It covers partial publication, delayed visibility, conflicting
digests and exact Git refs. Qualification tests cover failed and skipped jobs,
lost dispatch responses, resumed builds and incomplete evidence. Update tests
verify that planning cannot activate a backend and that uncertain activation is
not repeated.

## Report a problem {#report-a-problem}

Include package versions, Node.js version, operating system, expected
behaviour, observed behaviour and a minimal reproduction in a
[source issue](https://github.com/omnitron-dev/omni/issues/new).
Report documentation problems in the
[website repository](https://github.com/omnitron-dev/website/issues/new).
For security reports, follow the [security policy](./security.md).

Contributions use the project's MIT license.
