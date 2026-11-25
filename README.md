# Omnitron documentation

The public Omnitron manual and a reference project built with Lumen. Lumen
compiles Markdown and literal-widget MDX into static HTML, Pagefind search and
Markdown exports. React islands provide API filtering, interactive examples and
theme controls; reading and searching the manual requires no application RPC.
The layout uses the same Prism identity as Omnitron Console. Site actions, navigation,
drawers and documentation trees use the published Prism UI and icons. React islands
connect their shared interaction states to the site theme; the server still emits
ordinary links and a complete navigation fallback for readers without JavaScript.
Keep site CSS focused on page layout and document prose.

Start with the [Lumen overview](docs/lumen/overview.md),
[authoring guide](docs/lumen/authoring.md) or
[explanation of this site's build](docs/lumen/this-site.md).

The site uses Lumen and Prism **0.4.17**. CI and GitHub Pages install the tracked lockfile. Table semantics, syntax colors, navigation and breadcrumb theming come from the published framework.

The [privacy guide](docs/foundations/privacy.md) explains data boundaries.
[Node architecture](docs/omnitron/architecture.md) explains supervision and
recovery with diagrams and an interactive model. The
[Agent Studio](docs/omnitron/studio.md) and [event flows](docs/omnitron/flows.md) guides cover workflows available since 0.4.15. The [durable workflow runtime](docs/omnitron/workflow-runtime.md) and [verification harness](docs/omnitron/agent-harness.md) are design proposals.

## Develop

Use Node **24.13.0** and the pnpm version in [package.json](package.json).
Run these commands from the website repository root. For a registry checkout:

```bash
pnpm install --frozen-lockfile
pnpm start
```

For framework development, use a separate, full
[Omnitron checkout](https://github.com/omnitron-dev/omni) with its dependencies
installed. Set `OMNI_SOURCE_DIR` to its absolute path; the source and website
repositories may live anywhere. From the website repository root:

```bash
OMNI_SOURCE_DIR="/absolute/path/to/omni-source"
node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" init --project-dir .
node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" dev "$OMNI_SOURCE_DIR" --project-dir .
```

The SDK selector builds required packages through Turbo and watches their source.
Wait for `Development SDK build ready` or `Development SDK build is current`,
then run `pnpm start` in another terminal. Lumen watches content, assets and client
source. Restart that standalone preview after an SDK build or a configuration
change to load updated Node modules.

The path passed to `sdk dev` selects the framework checkout explicitly. Append
`--no-watch` for one build. Inspect the selection with
`node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" status --project-dir .`. The canonical [.pnpmfile.mjs](.pnpmfile.mjs) and private development
lock belong to this workflow; do not add another SDK hook or substitute local
archives into the registry lock. To return from a selected source SDK to the
locked npm packages, stop any managed preview and run
`node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" registry --project-dir .`.

For custom build and cache locations, set `LUMEN_OUT_DIR`,
`LUMEN_VIRTUAL_STORE_DIR` and `TMPDIR` to existing writable directories on your
chosen storage before SDK selection and pnpm commands.
[pnpm-workspace.yaml](pnpm-workspace.yaml) uses pnpm's isolated linker: the local
`node_modules` stays a physical directory while package contents use the chosen
virtual store. Without overrides, output defaults to `build` and the virtual
store to `node_modules/.pnpm`.

### Automatic SDK refresh

[omnitron.config.js](omnitron.config.js) declares an optional local `dev/site`
application on port 4178. Use a development Omnitron owner with file watching
enabled and the `sourceRefresh@1` capability. Prepare the SDK while the stack is stopped, then
register and start the project against that owner. From the website root, use
the source checkout selected above:

```bash
node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" dev "$OMNI_SOURCE_DIR" --project-dir . --no-watch
omnitron project add omnitron-docs "$PWD"
omnitron stack start omnitron-docs dev --working-tree
omnitron health omnitron-docs/dev/site
node "$OMNI_SOURCE_DIR/apps/omnitron/bin/sdk.js" dev "$OMNI_SOURCE_DIR" --project-dir . --stack dev
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

Run from the website root. Source checks require a separately obtained Omni
checkout at the revision recorded in `src/data/api-index.json`; the
[contributing guide](docs/community/contributing.md#work-on-the-documentation)
shows how to obtain that revision. Replace the sample path with its absolute
location. Building the website itself uses its locked registry packages.

```bash
OMNI_SOURCE_DIR="/absolute/path/to/omni-source"
node scripts/check-dependency-audit.js
pnpm check:content
pnpm check:source "$OMNI_SOURCE_DIR"
node scripts/check-doc-examples.mjs "$OMNI_SOURCE_DIR" docs pages
pnpm typecheck
pnpm build
pnpm exec playwright install chromium --no-shell
CI=true pnpm test:browser
pnpm serve --host 127.0.0.1 --port 4173
```

`pnpm build` runs the native Xec task in [.xec/config.yaml](.xec/config.yaml).
Its ordered steps invoke Lumen's ordinary build and check emitted links, assets
and fragments. A failed step stops the task; Xec owns execution and cancellation.
Browser tests use Playwright’s pinned Chromium in its standard headless mode,
so installation does not download a separate headless shell.
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
components in the shared [island registry](src/site/islands.ts) for static previews
and client activation. Browser-only examples explicitly opt into loading after an
action; ordinary previews and their source are present in the initial HTML.
Interactive controls remain disabled until their handlers are mounted.

After public API changes, set `OMNI_SOURCE_DIR` to the clean, committed platform
checkout containing those changes and run `pnpm docs:api "$OMNI_SOURCE_DIR"`
from the website root. Review the generated [API index](src/data/api-index.json) and
make its source commit available in the public platform repository before pushing
the website. The index records that commit for CI and for links to declarations.
Source checks compare package exports, CLI commands and service contracts with their guides. The API check also parses published code examples and verifies their named framework imports against the pinned source.
Titan inventories also compare package coverage, static factory methods and declared external
runtime dependencies. An inventory entry or interface field is not proof of implemented
behavior: trace the public factory through DI and the operation that consumes an option.
Distinguish native implementation, optional adapter and application glue. Record lifecycle
ownership and commit/delivery boundaries; do not infer them from a method name or package
dependency. Similar APIs do not establish design provenance: do not describe features
as borrowed or inspired by another project without attributable evidence. Compare
capabilities with current sources and reproducible measurements. Typecheck importing
TypeScript and React examples with `node scripts/check-doc-examples.mjs "$OMNI_SOURCE_DIR" docs pages`
from the website root, with dependencies installed in the source checkout, and exercise
the complete changed example when it claims runtime behavior.

## Distribution

[CI](.github/workflows/ci.yml) installs the released renderer from the frozen
npm lockfile and checks the manual against the exact public Omnitron commit in
the API index. After browser acceptance, main publishes that same build to GitHub
Pages. Pull requests never publish; manual publication follows the same checks.

Guides may describe newer platform APIs, but live examples and rendering features
must work with the locked Lumen and Prism versions.

The site maintains a separate install-time dependency security patch for picomatch 4.0.7 used by its direct
Vite dependency. Lumen 0.4.17 includes the same reviewed parser fix in its bundled
Vite distribution. KB is outside the website dependency graph, and Prism includes
the documentation sidebar's scroll restoration. The former KB and Prism client
patches and the KB side-effects cache exclusion have been removed.

Both parsers accept repeated extglobs only for nonempty literal words made from
ASCII letters, digits, underscores, hyphens or dots. Alternatives must have distinct
initial letters or characters, ignoring case. Other repeated forms raise a syntax
error during compilation. Ordinary file globs such as `docs/**/*.md` retain their
usual meaning. [GitHub security advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

Before running build tools, CI checks the registry audit and every file in both
installed parser distributions. An additional finding, changed bytes, or an
unexpected third installation stops the build. The registry audit covers the
direct Vite dependency; the separate file inventory also covers Lumen's bundled
copy. A clean report must have a successful exit status and zero vulnerability
counts; the installed-file verification still runs. A report with findings must
match only the reviewed advisory. The lockfile records the verified npm SHA-512
for each of the 13 Omnitron packages admitted at exactly 0.4.17.

For release verification, use a clean checkout and a dedicated project virtual store.
An upgrade can leave an earlier Lumen bundle in a reused store. The inventory
reports the extra parser even after the lockfile selects the new release.

When an upstream fix ships or Lumen's bundled dependency changes, review the
lockfile, installed files and audit policy together before removing the remaining
site patch.

If **Check out documented platform source** fails with `upload-pack: not our ref`,
compare the requested SHA with `revision` in `src/data/api-index.json`. A local
commit is insufficient: that exact commit must be available from
`omnitron-dev/omni` on GitHub. Push the reviewed platform commit first, then
rerun the website check. Keep the pin intact; substituting an older commit or
`main` would check different source and invalidate declaration links.

When updating packages, generate the lock from published npm versions in a clean
consumer, then verify frozen install, dependency audit, types, build and browser
interactions. Commit the lock together with its workspace configuration. Pushing
`main` triggers the Pages deployment. Local SDK acceptance does not establish
registry reproducibility.
