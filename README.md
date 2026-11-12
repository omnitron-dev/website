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
node ../omni/apps/omnitron/bin/sdk.js dev ../omni --project-dir . --no-watch
pnpm start
```

The SDK checkout must be separate from this repository. `sdk dev` uses the
workspace's Turbo build graph and a private development lock. The tracked root
lock still describes the previous published application graph; it does not
certify this Lumen candidate. Normal `pnpm install --frozen-lockfile` becomes a
distribution check only after the Lumen release is published and that application
lock is regenerated with the released versions. A package-manager metadata
document added by pnpm does not establish a registry baseline.

The development preview rebuilds content and client sources. Restart after
changing the configuration. Build and inspect the production output before
submitting a change:

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
