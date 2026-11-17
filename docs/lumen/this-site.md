---
id: "lumen/this-site"
slug: "/docs/lumen/this-site"
title: How this manual is built
---
# How this manual is built

This repository consumes Lumen's ordinary CLI. Its layout uses Lumen navigation components and the shared Prism identity used by Omnitron Console.

## The build path

1. The native Xec `build` task runs Lumen, then verifies emitted routes. `lumen.config.ts` declares document and page directories, the SSR layout, shared island registry and client entry.
2. Lumen parses the corpus, resolves public routes and checks internal links and anchors.
3. The public audience projection supplies HTML, search and Markdown exports.
4. Registered React examples render with the page context during the build, including lazy modules. Vite bundles the declared client entry; `LumenShell` keeps the static preview visible until its interactive replacement commits.
5. The completed generation replaces the previous output after its full inventory is written. A failed content check retains the previous generation.

There is no application RPC required to read or search this static manual.

Build, check, preview, development and corpus-export commands load the same executable project graph, including `import.meta.glob` and raw source imports. Programmatic integrations use `withLumenProject(root, async ({ config, build }) => { ... })` and finish their work before that callback returns.

The trusted configuration, layout and renderer are compiled into one Vite SSR graph. Local components and imported React packages share the project's React peers, so state and context hooks also work during static rendering. The compiler preserves source module paths and ESM resolution and releases its temporary files after success or failure.

Browser resources enter through `clientEntry`, `stylesheets` or `publicDir`. CSS imported by the server layout or registered examples, including its relative fonts and images, enters the same verified output generation. The compiler preserves lazy module boundaries, so a deferred browser component is not evaluated while building an unrelated static preview. Server-side JavaScript imports of resource URLs require inline assets or explicit public URLs; conflicting emitted files fail the build.

Publication persists a small recovery journal before moving the previous output.
After interruption, the next build or serve verifies ownership and file hashes
before retaining the complete new generation or restoring the complete previous
one. `lumen serve` holds a verified snapshot until shutdown; restart it to preview
a later build. Do not point another development server at the mutable output
while rebuilding. This is recoverable directory replacement on a local macOS or
Linux filesystem, with a brief rename gap; Windows publication is not supported.

## What is interactive

- The header opens Lumen's local search dialog.
- Ordinary Prism examples include their initial preview and source in static HTML. Their controls enable when handlers are ready. Immediate examples let asynchronous loading reach Lumen’s outer boundary, which retains the complete static preview; they do not replace it with a loading placeholder. Examples requiring browser-only libraries explicitly offer **Load example**, instead of silently failing during the build.
- The [Lumen architecture explorer](./architecture.md#explore-the-pipeline) displays reproducible compiler/corpus outputs and a real local React interaction, using the same Prism example registry.
- The API index filters the generated public symbols by package, import path and kind.
- The authoring guide runs editable JavaScript inside a bounded QuickJS worker and renders a Mermaid diagram with the actual browser engine.
- Type annotations and mathematical typesetting are generated during the build and remain readable without JavaScript.
- The theme menu offers Light, Dark and System. It remembers the selected mode;
  System follows changes to the operating-system preference. Shared color tokens
  apply before the client mounts, and PrismProvider owns live theme updates.
- The header mark unfolds on hover or keyboard focus and returns afterward.
  It remains still when reduced motion is requested.
- The API inventory is fetched only when its island is present on the page.
- Navigation and page contents remain ordinary links and static HTML. Theme and
  search controls enable after their client handlers are ready; the document and
  navigation remain usable without JavaScript.

The API inventory is generated from public package manifests and TypeScript re-exports. It checks that each entry point has a guide; it does not prove that every behavior has a complete example.

## A page for people and tools

The interactive reading-format tabs and direct Markdown mirror links in this section require Lumen 0.4.8 or later.

Choose a format for the authoring guide. All three links are part of the static document. Use the arrow keys to change tabs, or Home and End to jump to either end.

:::tabs{label="Public reading formats"}
:::tab{label="HTML" value="html"}
Use the [authoring guide](./authoring.md) to try the diagram and playground.
:::
:::tab{label="Markdown" value="markdown"}
Read the [authoring guide as Markdown](/docs/lumen/authoring.md) to reuse its text and code.
:::
:::tab{label="Agent index" value="agents"}
Find public documents in the [agent index](https://omnitron.dev/llms.txt).
:::
:::

The Markdown below produces this group. Add a shared `syncKey` to several groups on one page when the same choice should follow the reader. Give matching choices the same `value`.

```markdown
:::tabs{label="Public reading formats"}
:::tab{label="HTML" value="html"}
Use the [authoring guide](./authoring.md) to try the diagram and playground.
:::
:::tab{label="Markdown" value="markdown"}
Read the [authoring guide as Markdown](/docs/lumen/authoring.md) to reuse its text and code.
:::
:::tab{label="Agent index" value="agents"}
Find public documents in the [agent index](https://omnitron.dev/llms.txt).
:::
:::
```

## Preserving public links

The migration records the previous built site's route and anchor inventory in `migration/url-contract.json`. Validation compares the new output against that contract and checks internal links in the emitted HTML, including fragment targets. Content changes must retain externally useful anchors or provide an explicit reviewed redirect.

## Source and distribution

The website and framework are separate repositories. CI installs the released
Lumen and Prism versions from the website lockfile, then verifies documentation
against the exact Omni commit recorded in `src/data/api-index.json`. That commit
can include newer platform APIs, but must already be available on GitHub before
the website is pushed. The API index uses the same revision for declaration
links. A successful local source check does not establish that CI can fetch it.

Use the normal Omnitron SDK workflow for a development checkout and released
package versions for distribution. An unpublished SDK candidate must be
qualified explicitly; a local dependency link is not evidence of a reproducible
registry installation. Live examples must work with the locked renderer.

See [contributing](../community/contributing.md) for the project workflow and [compatibility](../reference/compatibility.md) for supported versions.


## See also

- [Lumen architecture](./architecture.md)
- [Working showcase](./showcase.md)
- [Engineering comparison](./comparison.md)
- [Authoring](./authoring.md)
