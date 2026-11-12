---
id: "lumen/this-site"
slug: "/docs/lumen/this-site"
title: How this manual is built
---
# How this manual is built

This repository consumes Lumen's ordinary CLI. Its layout uses Lumen navigation components and the shared Prism identity used by Omnitron Console.

## The build path

1. `lumen.config.ts` declares document and page directories, the SSR layout and the client entry.
2. Lumen parses the corpus, resolves public routes and checks internal links and anchors.
3. The public audience projection supplies HTML, search and Markdown exports.
4. Vite bundles the declared client entry. `LumenShell` activates React islands through the shared portal runtime.
5. The completed generation replaces the previous output after its full inventory is written. A failed content check retains the previous generation.

There is no application RPC required to read or search this static manual.

The trusted configuration, layout and renderer are compiled into one Vite SSR graph. Local components and imported React packages share the project's React peers, so state and context hooks also work during static rendering. The compiler preserves source module paths and ESM resolution and releases its temporary files after success or failure.

Browser resources enter through `clientEntry`, `stylesheets` or `publicDir`. Importing a separate CSS, image or font file from the SSR layout fails with a diagnostic instead of leaving a missing resource in the published site. Self-contained inline assets need no separate file.

Publication persists a small recovery journal before moving the previous output.
After interruption, the next build or serve verifies ownership and file hashes
before retaining the complete new generation or restoring the complete previous
one. `lumen serve` holds a verified snapshot until shutdown; restart it to preview
a later build. Do not point another development server at the mutable output
while rebuilding. This is recoverable directory replacement on a local macOS or
Linux filesystem, with a brief rename gap; Windows publication is not supported.

## What is interactive

- The header opens Lumen's local search dialog.
- The API index filters the generated public symbols by package, import path and kind.
- The authoring guide runs editable JavaScript inside a bounded QuickJS worker and renders a Mermaid diagram with the actual browser engine.
- Type annotations and mathematical typesetting are generated during the build and remain readable without JavaScript.
- The shared brand and theme control switch between the shared light and dark palettes.
- The API inventory is fetched only when its island is present on the page.
- Navigation and page contents remain ordinary links and static HTML.

The API inventory is generated from public package manifests and TypeScript re-exports. It checks that each entry point has a guide; it does not prove that every behavior has a complete example.

## Preserving public links

The migration records the previous built site's route and anchor inventory in `migration/url-contract.json`. Validation compares the new output against that contract and checks internal links in the emitted HTML, including fragment targets. Content changes must retain externally useful anchors or provide an explicit reviewed redirect.

## Source and distribution

The website and framework are separate repositories. Use the normal Omnitron SDK workflow for a development checkout and released package versions for distribution. An unpublished SDK candidate must be qualified explicitly; a local dependency link is not evidence of a reproducible registry installation.

See [contributing](../community/contributing.md) for the project workflow and [compatibility](../reference/compatibility.md) for supported versions.
