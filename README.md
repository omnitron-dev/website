# Omnitron documentation

The public Omnitron manual and a reference project built with Lumen. Lumen
compiles Markdown and literal-widget MDX into static HTML, Pagefind search and
Markdown exports. React islands provide API filtering, interactive examples and
theme controls; reading and searching the manual requires no application RPC.
The layout uses the same Prism identity as Omnitron Console.

Start with the [Lumen overview](docs/lumen/overview.md),
[authoring guide](docs/lumen/authoring.md) or
[explanation of this site's build](docs/lumen/this-site.md).

The site uses the released `@omnitron-dev/lumen`, `@omnitron-dev/lumen-ast`, `@omnitron-dev/lumen-ui` and
`@omnitron-dev/prism` packages at **0.4.6**. The tracked lockfile records the npm
dependency graph used by CI and distribution.

## Develop

Use Node **24.13.0** and the pnpm version in [package.json](package.json).
For a registry checkout:

```bash
pnpm install --frozen-lockfile
pnpm start
```

For framework development, use a separate, full
[Omnitron checkout](https://github.com/omnitron-dev/omni) with its dependencies
installed. From this repository:

```bash
node ../omni/apps/omnitron/bin/sdk.js init --project-dir .
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir .
```

The SDK selector builds required packages through Turbo and watches their source.
Wait for `Development SDK build ready` or `Development SDK build is current`,
then run `pnpm start` in another terminal. Lumen watches content, assets and client
source. Restart that standalone preview after an SDK build or a configuration
change to load updated Node modules.

The path passed to `sdk dev` selects the framework checkout explicitly. Append
`--no-watch` for one build. Inspect the selection with
`node ../omni/apps/omnitron/bin/sdk.js status --project-dir .`. The canonical [.pnpmfile.mjs](.pnpmfile.mjs) and private development
lock belong to this workflow; do not add another SDK hook or substitute local
archives into the registry lock. To return from a selected source SDK to the
locked npm packages, stop any managed preview and run
`node ../omni/apps/omnitron/bin/sdk.js registry --project-dir .`.

On the development Mac, put `LUMEN_OUT_DIR`, `LUMEN_VIRTUAL_STORE_DIR` and `TMPDIR`
on the mounted AGI development volume before SDK selection and pnpm commands.
[pnpm-workspace.yaml](pnpm-workspace.yaml) uses pnpm's isolated linker: the local
`node_modules` stays a physical directory while package contents use the chosen
virtual store. Other machines default to `build` and `node_modules/.pnpm`.

### Automatic SDK refresh

[omnitron.config.js](omnitron.config.js) declares an optional local `dev/site`
application on port 4178. Use a development Omnitron owner with file watching
enabled and the `sourceRefresh@1` capability. Prepare the SDK while the stack is stopped, then
register and start the project against that owner:

```bash
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir . --no-watch
omnitron project add omnitron-docs "$PWD"
omnitron stack start omnitron-docs dev --working-tree
omnitron health omnitron-docs/dev/site
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir . --stack dev
```

Each successful SDK build reconciles the application's source binding; the owner
restarts it when refresh is needed. The SDK's `refresh confirmed` message records
an acknowledged generation and source binding. The HTTP health probe separately
checks the served page. A failed
compiler build leaves the previous process and content running. Use one preview
for this checkout at a time and stop the managed stack before switching SDKs.
See [project and stack management](docs/omnitron/projects.md) for registration
and lifecycle details.

## Build and verify

```bash
pnpm check:content
pnpm check:source ../omni
pnpm typecheck
pnpm build
CI=true pnpm test:browser
pnpm serve --host 127.0.0.1 --port 4173
```

`pnpm build` runs [scripts/build.js](scripts/build.js) through Xec. It invokes
Lumen's ordinary build, then checks emitted links, assets and fragments.
The browser command starts its own Lumen server on port 4179; stop an existing
preview on that port first. `serve` holds one verified generation, so restart it
to inspect a later build. Output recovery and the current macOS/Linux publication
boundary are documented in [the build guide](docs/lumen/this-site.md).

The [URL contract](migration/url-contract.json) preserves 236 original routes
and 2,855 content anchors. The initial 3,092-anchor count also included 237
renderer-only IDs; excluded structural IDs are recorded in that contract.
Keep public routes and externally useful headings stable.

## Content and architecture

| Source | Responsibility |
| --- | --- |
| [docs/](docs/) and [pages/](pages/) | Documentation, landing pages and explicit public routes |
| [lumen.config.ts](lumen.config.ts) | Corpus directories, SSR layout, client entry and strict link checks |
| [src/site/](src/site/) | Trusted layout, Prism theme and registered React islands |
| [sidebars.json](src/data/sidebars.json) | Section navigation using document IDs and category routes |
| [api-guides.mjs](scripts/api-guides.mjs) | Public package entry points mapped to their guides |
| [static/](static/) | Local fonts and public assets |

Document outcomes, prerequisites, complete imports, defaults and failure behavior.
Keep examples publicly reproducible; label proposals as Design RFC. Documents
contain literal widget props, not executable MDX imports. Register application
components in the trusted client entry.

After public API changes, run `pnpm docs:api ../omni` and review the generated
[src/data/api-index.json](src/data/api-index.json). Source checks compare package
exports, CLI commands and service contracts with their guides. An inventory entry
is not proof of a working example: run the complete examples you change.

## Distribution

[CI](.github/workflows/ci.yml) and [GitHub Pages](.github/workflows/deploy.yml)
install released npm packages with a frozen application lock; neither uses a
local SDK profile. Source checks use the matching Omni release tag, `v0.4.6`.

When updating packages, generate the lock from published npm versions in a clean
consumer, then verify frozen install, dependency audit, types, build and browser
interactions. Commit the lock together with its workspace configuration. Pushing
`main` triggers the Pages deployment. Local SDK acceptance does not establish
registry reproducibility.
