# Omnitron documentation

Public documentation for [Omnitron](https://github.com/omnitron-dev/omni),
built with Docusaurus. The site is maintained in its own repository.

```bash
pnpm install --frozen-lockfile
pnpm start
```

Use the pnpm version declared in `package.json` (`packageManager`). CI and Pages
read the same field through `pnpm/action-setup`; do not add a separate `version`
input to the workflows.

Before submitting:

```bash
pnpm check:content
pnpm typecheck
pnpm build
```

To compare documentation inventories with a sibling source checkout:

```bash
pnpm check:source ../omni
node scripts/check-doc-examples.mjs ../omni docs
```

The example checker reports possible API mismatches in fragments for review;
it is not an end-to-end test. Run the complete examples you edit. The public
content check rejects private project references and local-only paths.
The build rejects broken internal links and anchors.

Use `pnpm serve` to inspect the production build, including local search.
Check narrow and wide viewports, both themes, keyboard focus and reduced
motion. Fonts are self-hosted; their licenses are in `static/fonts/`.

Pages should state an outcome, prerequisites, complete import paths, defaults,
failure behaviour and useful next steps. Keep examples neutral and publicly
reproducible. Label architectural proposals as Design RFC.

## Public API inventory

`pnpm docs:api ../omni` rebuilds the searchable API index from public package
manifests and TypeScript re-exports. `scripts/api-guides.mjs` maps each entry
point to a guide. New packages or entry points fail the source check until
that mapping is reviewed. The check detects stale inventory data; it does
not establish that every behaviour has a complete prose example.

For new guides, document setup, ownership and teardown, failure behaviour,
and a representative verification step. Keep architectural proposals
labelled separately from implemented APIs. Link the guide from the sidebar
and the relevant task in the developer map.
