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

The root `pnpm test` runs the workspace suite. Use `pnpm test:up` and
`pnpm test:down` for the Docker test services. Read
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
```

Review major-version migrations and peer ranges. Do not force a transitive
package onto a different major than its parent supports. Keep package-manager
supply-chain checks and review any version-specific exceptions added by an
explicit update. Run checks for the affected runtime, browser and CLI paths.

The workspace installs the native TypeScript 7 compiler as `@typescript/native`
and the current compatible Compiler API as `typescript` through the
`@typescript/typescript6` npm alias. `tsc` uses the native compiler; ESLint and
API-based tooling use the compatibility package. Both are development tools,
not runtime requirements for applications.

Keep published export paths backed by files in the package archive. Validate
consumer applications against the same package artifacts and ensure Titan
resolves to one instance per application. Preserve the previous lockfile,
artifacts and state snapshot for rollback. An immutable experiment that pins
an older runtime needs a separate registration for an upgraded environment;
replacing its recorded hashes changes the experiment rather than reproducing it.

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

Package releases use the repository's Changesets workflow. Read
[Changelog](./changelog.md) for versioning and release expectations.

## Report a problem

Include package versions, Node.js version, operating system, expected
behaviour, observed behaviour and a minimal reproduction in a
[source issue](https://github.com/omnitron-dev/omni/issues/new).
Report documentation problems in the
[website repository](https://github.com/omnitron-dev/website/issues/new).
For security reports, follow the [security policy](./security.md).

Contributions use the project's MIT license.
