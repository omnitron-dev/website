# Omnitron documentation

The public manual and reference Lumen site. Documentation and application code
live in separate repositories; Lumen owns parsing, route checks, rendering,
client compilation, search and static output publication.

Use Node 24 and the pnpm version declared in `package.json`.

The Lumen packages in this branch are an unpublished SDK candidate. Start with
an installed, built, full Omnitron workspace at a reviewed commit, then select it
through the canonical SDK bridge:

```bash
node ../omni/apps/omnitron/bin/sdk.js init --project-dir .
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir .
```

Leave `sdk dev` running for a standalone preview. It watches the selected SDK's
source and build inputs and rebuilds affected packages through Turbo. Wait for
`Development SDK build ready` or `Development SDK build is current`, then start
the site in another terminal. These messages confirm compiled output; they do
not confirm application reload or HTTP readiness. The managed workflow below
uses `--stack` to request application refresh.

```bash
pnpm start
```

The path after `sdk dev` explicitly selects the source workspace. For ongoing
framework development, the command above selects the primary `../omni` checkout.
For a one-time qualification, select a separate reviewed checkout and append
`--no-watch`; that command builds once and exits. The selection persists and does
not automatically follow edits in another workspace. Inspect it with
`node ../omni/apps/omnitron/bin/sdk.js status --project-dir .`; the source is also
recorded in the local `.omnitron/dev-sdk/install.json`. Re-run the canonical
command to switch sources once the target workspace is prepared for development:
selection runs that workspace's normal build graph.

The SDK checkout must be separate from this repository. `sdk dev` uses the
workspace's Turbo build graph and a private development lock. The tracked root
lock still describes the previous published application graph; it does not
certify this Lumen candidate. Normal `pnpm install --frozen-lockfile` becomes a
distribution check only after the Lumen release is published and that application
lock is regenerated with the released versions. A package-manager metadata
document added by pnpm does not establish a registry baseline.

CI and GitHub Pages install released npm dependencies with the frozen application
lock; neither selects a development SDK. The source inventory check uses the
matching Omni release tag. Before pushing this migration to `main`, qualify and
publish Omni 0.4.0, regenerate the application lock in a clean registry consumer,
and run the frozen install, build and browser checks there. Commit that lock
before the website push. A push to this repository's `main` also starts its
existing GitHub Pages deployment workflow.

The development preview rebuilds the site's content, public assets and `src`
files. It does not watch the SDK's compiled output or replace already loaded
Node modules. After `sdk dev` reports a changed SDK build, restart `pnpm start`
to load it; no manual SDK build is needed. Also restart after changing the site
configuration.

For managed development, `omnitron.config.js` declares a local managed
`dev/site` application. `scripts/dev.js` calls the public Lumen CLI API and sends
its startup acknowledgement after the server listens; the declared HTTP probe
checks the real home page at `http://127.0.0.1:4178/`. Lumen watches content and
client files, while Omnitron owns process restarts. Use one preview for this
checkout at a time.

Prepare the SDK while the stack is stopped. Register the project once with a
reviewed Omnitron development owner, then run:

```bash
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir . --no-watch
omnitron project add omnitron-docs "$PWD"
omnitron stack start omnitron-docs dev --working-tree
omnitron health omnitron-docs/dev/site
```

Use a development owner with file watching enabled and the `sourceRefresh@1`
capability. Start the continuous SDK session after the application is online:

```bash
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir . --stack dev
```

Every successful build reconciles this stack, including a build whose output
has not changed. The owner confirms the restarted application's source binding;
the CLI prints `Development SDK refresh confirmed for omnitron-docs/dev` only
after checking the final stack membership, watch policy and generations. The
command refuses a disabled or missing watcher, a starting application, a missing
owned handle or a selected release. It does not substitute a manual restart.
Append `--no-watch` for a single build and reconciliation pass without a watcher.

The canonical `.omnitron/dev-sdk/built.json` schema 2 keeps two separate facts:
`hashes` records SDK build output, while `applications[project/stack][handleKey]`
records an acknowledged generation, definition revision, source directory and
its dependent `buildIdentity`. A build-only checkpoint or another stack's
receipt does not confirm this site's loaded modules. Stopped applications have
no application receipt; reconcile again after they are started. A compiler
failure leaves the checkpoint unchanged. A partial refresh failure retains
individual acknowledgements so a retry can reconcile the remaining bindings.

An application receipt confirms process lifecycle, not the HTTP result. After a
refresh, check `omnitron health omnitron-docs/dev/site` again; the declared HTTP
probe must pass separately from the process acknowledgement.

This managed workflow was qualified in an isolated native owner using Omni
`b5a083e6505c7bcd84ce6793b468e842c27d8d6f`. Two SDK source edits rebuilt through
Turbo, produced new application generations and schema 2 receipts, and changed
the served HTML. A deliberate compiler error preserved the last confirmed
process, generation, checkpoint and HTTP content. The fixture also verified
startup readiness and cleanup. This establishes the local source SDK workflow;
npm distribution, a frozen registry install and Pages publication still require
the release steps above. Stop the stack before changing the selected SDK
workspace or reverting to registry dependencies.

For machine-specific settings, use the existing `omnitron.stacks.json` contract.
The development Mac uses a distinct `local` stack so its settings do not collide
with the portable `dev` declaration:

```json
{
  "local": {
    "type": "local",
    "watch": true,
    "apps": ["site"],
    "infrastructureOwnership": "external",
    "settings": {
      "appEnv": {
        "site": {
          "LUMEN_OUT_DIR": "/Volumes/AGI-Dev/work/omnitron-website/managed-build",
          "TMPDIR": "/Volumes/AGI-Dev/tmp"
        }
      }
    }
  }
}
```

Use `local` in the stack and application commands for that configuration.
These values reach the managed child through stack settings; exporting them only
in the caller's shell does not update an existing daemon. Keep
`LUMEN_VIRTUAL_STORE_DIR` in the SDK/pnpm shell environment. This declaration does
not register, start or reconfigure an existing owner, and production remains the
static Pages build described above.

Build and inspect production output before submitting a change:

```bash
pnpm check:content
pnpm typecheck
pnpm build
pnpm serve --host 127.0.0.1 --port 4173
pnpm test:browser
```

`build` runs through Xec, then checks all generated internal links, assets and
fragments. `migration/url-contract.json` records the previous site's 236 built
routes and 2,855 content anchors. The initial 3,092-anchor comparison included
236 `theme-svg-external-link` icon IDs and one `__blog-post-container` wrapper;
these 237 renderer IDs have no content target. The contract records all 3,566
original HTML IDs and the full list of 711 excluded structural IDs, including
the old renderer root, skip-link target and base-URL diagnostic banner. The new
site has its own working skip link. Keep public content URLs stable when editing prose.
Lumen replaces only output directories with its own generation inventory;
select a new output directory for the first build after migrating from another
tool. Interrupted publication is recovered by the next build or serve. A preview
holds one verified generation until it is restarted, so it does not mix resources
from subsequent builds. This local publication protocol currently requires macOS
or Linux.

On the development Mac, set `LUMEN_OUT_DIR` to a project directory on the mounted
AGI development disk. Build artifacts and new dependency caches belong there.
Set `LUMEN_VIRTUAL_STORE_DIR` to a separate directory on that volume before SDK
selection and subsequent pnpm commands. This uses pnpm's standard isolated node linker and virtual store;
the project keeps its own physical `node_modules` directory and normal package
links, while package contents live in the selected store. Without that variable, other machines use `node_modules/.pnpm`.
The canonical `.pnpmfile.mjs` is maintained by `sdk init`; do not add a second SDK
hook or invent a registry lock for unpublished dependencies.
The initial migration uses an explicitly qualified local SDK candidate until
its package versions are published; local links do not establish registry
install reproducibility. Use the canonical Omnitron SDK workflow for ordinary
source development and pin released versions for distribution.

## Content and ownership

- `docs/`: Markdown and literal-widget MDX documents; no executable MDX imports.
- `pages/`: home, project, category and search routes.
- `src/site/`: the trusted SSR layout, shared Prism identity and client islands.
- `src/data/sidebars.json`: task-oriented navigation with explicit document IDs.
- `static/`: self-hosted fonts and public assets.

Pages should state an outcome, prerequisites, complete import paths, defaults,
failure behavior, ownership and cleanup. Label proposals as Design RFC.
Keep examples neutral and publicly reproducible. Do not publish private project
names, credentials or local filesystem paths.

## Source verification

```bash
pnpm check:source ../omni
pnpm docs:api ../omni
node scripts/check-doc-examples.mjs ../omni docs
```

The API inventory comes from public package manifests and TypeScript exports.
Each entry point needs an explicit guide in `scripts/api-guides.mjs`. Inventory
coverage does not prove every behavior has a complete example. Run the complete
examples you change, and inspect static pages, search and API filtering with a
keyboard at narrow and wide widths in both themes.
