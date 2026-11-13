---
id: "lumen/overview"
slug: "/docs/lumen/overview"
title: Lumen
---
# Lumen

Lumen compiles a document corpus into static HTML, local search, Markdown mirrors and an agent index. The same parsed document graph supplies page rendering and link checks. This manual is a reference consumer of that build path.

## Choose the boundary

| Package | Responsibility |
| --- | --- |
| `@omnitron-dev/lumen-ast` | Markdown/PDX parsing, typed nodes, HTML and Markdown transformations, code highlighting and diagrams |
| `@omnitron-dev/lumen` | Corpus graph, verification gates, static generation and CLI |
| `@omnitron-dev/lumen-ui` | Documentation layouts, search UI and selective React island hydration |
| `@omnitron-dev/titan-lumen` | Titan-hosted document services, access policy, live editing and MCP integration |
| `@omnitron-dev/lumen-migrate` | Docusaurus content conversion and route/anchor comparison |

A static build needs no Titan server. Add Titan-Lumen only when the application needs authenticated document services. A public static artifact is readable by anyone who receives its files; privileged builds require a corresponding hosting boundary.

## Build a document site

Start with one document and one configuration file. The source directory determines the document routes. With the default route rules, `docs/intro.md` becomes `/docs/intro`.

:::filetree{title="Engineering manual"}
- `docs/` — public document sources
  - `intro.md` — first page
- `lumen.config.ts` — build configuration
:::

Set the input and output directories explicitly:

```typescript
import { defineLumenConfig } from '@omnitron-dev/lumen';

export default defineLumenConfig({
  title: 'Engineering manual',
  srcDir: 'docs',
  outDir: 'build',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
});
```

```bash
lumen check
lumen build
lumen serve --host 127.0.0.1 --port 4173
```

`build` rejects invalid routes and broken internal links before publishing its output. `serve` previews the existing build; it does not start a backend or deploy the site. `dev` rebuilds watched content and reloads the local preview. Restart it after changing the build configuration.

## Read and reuse the corpus

Every public document has a Markdown mirror. [This page as Markdown](/docs/lumen/overview.md), the [agent index](https://omnitron.dev/llms.txt) and [complete public corpus](https://omnitron.dev/llms-full.txt) are produced from the same public projection as the site.

Open the Markdown mirror beside the HTML page and compare the headings. The agent index links to individual documents. The complete corpus combines them for clients that need one download.

The default static audience is anonymous. Restricted documents and sections are projected out before HTML, search or agent exports are produced. Do not put secrets in public content or client props.

## Local MCP access

```bash
lumen mcp --stdio --root .
```

The official MCP SDK serves `search_corpus`, `get_document` and
`lumen_inspect_ast`. Resource paths are corpus-relative, for example
`lumen://corpus/docs/intro.md`. The local endpoint exposes the anonymous
projection only: restricted documents and sections are absent from search,
resources and AST output. It rejects missing or invalid corpora at startup.

The spawning process owns this local trust boundary. Caller-supplied roles do
not grant access. Use Titan-Lumen's adapter for authenticated live calls through
Netron. Both adapters share the isolated Node-only `lumen-ast/mcp` contract;
the AST root and browser entry do not import the server SDK. Diagnostics go to
stderr, and the transport closes an input exceeding its 1 MiB buffer limit even
before a newline arrives.

## Continue

- [Author documents and interactive examples](./authoring.md)
- [Inspect this reference site's build](./this-site.md)
- [Find exact package exports](../reference/api-index.mdx)
