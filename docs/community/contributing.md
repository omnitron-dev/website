---
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

## Work on the runtime

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

## Update dependencies together

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

Unpublished Xec changes are supplied as archives under `vendor/`. Their manifest
records the clean source commit and SHA-256/SHA-512 digests. Workspace overrides
select the same Core, Kit, Loader and Ops artifacts throughout the dependency
graph. Refresh the artifacts together after testing Xec; do not add a second SSH
transport to Omnitron.

A consumer that develops against Omnitron source can use relative `link:`
dependencies into one checkout. Keep its manifests and workspace overrides in
agreement. The release builder reproduces that layout with clean Git clones and
checks that every framework link resolves into the selected clone. pnpm 12
lockfiles contain separate YAML documents for tooling and application packages;
release tooling reads the application importer graph across those documents.

## Work on the documentation

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

## Write a useful page

State the outcome and prerequisites first. Use complete file names for
runnable examples and label excerpts as excerpts. Explain configuration
defaults, errors, lifecycle behaviour and the next operational step where
they affect the reader.

- Use sentence case, explicit code languages and relative links.
- Keep third-party references relevant to actual dependencies or integrations.
- Use neutral example names and reserved example domains.
- Link to public source paths that a fresh checkout can resolve.
- Mark proposals **Design RFC** and distinguish them from shipped APIs.
- Add a page to `sidebars.ts` so readers can discover it.

## Change the code

Follow the package's existing conventions. Preserve public API compatibility
unless the change deliberately introduces a documented migration. For a bug
fix, add a regression test that exercises the failed behaviour.

Keep type-only imports explicit and use `.js` extensions for relative ESM
imports. Use the repository's lint and formatting configuration.

## Submit a change

Open a focused pull request in the repository you changed. Describe the
problem, the resulting behaviour and the checks you actually ran. Link a
related documentation PR when the code and manual need to change together.

Use a descriptive conventional commit title, such as
`fix(titan-cache): invalidate tagged entries` or
`docs(netron): explain HTTP startup`.

## Release process

From a clean `main`, list the public workspaces and preview an exact semantic
version. The plan reports the source revision, package count and npm channel.

```sh
node scripts/release.mjs --list
node scripts/release.mjs <version> --dry-run
node scripts/release.mjs <version> --prepare
```

Preparation commits public package versions, builds an isolated copy of the
source and verifies the exported files in each archive. Two ordinary npm installs
check the published dependency graph without workspace overrides: the minimal
CLI/Netron consumer exercises the runtime, and an install of every public package
audits optional modules as well. Inspect `release.json`
and `NOTES.md` in `.release-artifacts/<version>/<commit>/`. The public npm
channel for `1.0.0-rc.1`, for example, is `rc`.

```sh
node scripts/release.mjs <version> --push
node scripts/release.mjs <version> --publish
node scripts/release.mjs <version> --github
```

The first command atomically pushes the selected commit and its annotated tag.
The second checks the remote tag, downloads every published archive and compares
its SHA-512 with the sealed artifact. A staged upload is not a confirmed release:
Xec waits up to 30 minutes for version metadata, the tarball and the release
channel to agree. Pending upload receipts let a later resume continue confirmation
without publishing the same archive again.
After an interruption, keep the artifacts and use `node scripts/release.mjs <version>
--resume` at the same clean commit. GitHub publication checks all packages
before creating the release. An internal registry can be selected explicitly
using `--registry <url>` for publication, resumption and confirmation.

### Browser approval for a package batch

Omnitron 0.3.2 pins Xec Ops 0.11.3. That publisher requests a numeric OTP per
package and waits for each registry scan. An updated Xec release operator can
resume the same tagged Omnitron checkout and its original receipts. From a Xec
checkout containing batch publication and native npm browser authorization, run:

```sh
pnpm release <version> --resume --workspace /path/to/tagged/omni --no-push
```

Finish or cancel the previous publisher before starting this command. On npm's
first challenge, confirm in the browser and select the five-minute option
for the current IP and token when offered. Xec submits the accepted archives
in dependency order while npm scans them. An explicit version conflict must
be reconciled before the next submission. At the end, Xec downloads and checks
the whole batch before creating the GitHub release in the checkout's repository.
Builds, tests and consumer audits run during preparation. A registry challenge
after the authorization expires opens a new prompt.
[npm browser authorization](https://github.blog/changelog/2022-07-26-general-availability-of-improved-2fa-experience-in-npm/).

The CI rehearsal runs two dependent packages through Git and a loopback npm
registry. It interrupts publication after the first package, resumes the
second through delayed staged visibility, downloads both archives and rejects a
conflicting digest. It also checks that unrelated tags stay local.

## Report a problem

Include package versions, Node.js version, operating system, expected
behaviour, observed behaviour and a minimal reproduction in a
[source issue](https://github.com/omnitron-dev/omni/issues/new).
Report documentation problems in the
[website repository](https://github.com/omnitron-dev/website/issues/new).
For security reports, follow the [security policy](./security.md).

Contributions use the project's MIT license.
