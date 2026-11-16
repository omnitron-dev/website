---
id: "lumen/overview"
slug: "/docs/lumen/overview"
title: Lumen
---
# Lumen

Lumen is Omnitron's document compiler and publishing system. It turns a corpus of Markdown and PDX documents into static HTML, a local search index, Markdown mirrors and agent-readable exports. A typed document tree and a corpus graph connect those outputs to routes, headings, references and access metadata.

Use it for a product documentation site, an engineering knowledge base, or a technical publication that needs both readable pages and structured reuse. React islands add interactive examples where they are useful. This website uses that path with Prism components; an ordinary document remains readable before its interactive controls load.

## Start with the question you need to answer

| Question | Read next |
| --- | --- |
| What happens between a source file and the browser? | [Architecture](./architecture.md) follows parsing, checks, projection, rendering and activation |
| Which parts are ready, and which need application work? | [Use cases](./use-cases.md) separates static publishing from authenticated services |
| How does it compare with other documentation tools? | [Engineering comparison](./comparison.md) examines rendering, authoring, search and operating costs |
| What can I actually interact with? | [Showcase](./showcase.md) contains working examples and explains their execution boundaries |
| How do I write a page? | [Authoring](./authoring.md) covers directives, typed examples, mathematics and playgrounds |

## Choose the boundary

| Package | Responsibility |
| --- | --- |
| `@omnitron-dev/lumen-ast` | Markdown/PDX parsing, typed nodes, HTML/Markdown/Typst transformations, highlighting, math and diagram support |
| `@omnitron-dev/lumen` | Corpus graph, verification gates, static generation and CLI |
| `@omnitron-dev/lumen-ui` | Documentation layouts, local search UI and a shared React context for selectively activated islands |
| `@omnitron-dev/titan-lumen` | Netron-exposed document services in a Titan application, access projection, revision-aware editing and an HTTP MCP adapter |
| `@omnitron-dev/lumen-migrate` | Docusaurus content conversion and route/anchor comparison |

Prism supplies the React component system, design tokens and research/document controls; Lumen supplies the document and publication lifecycle. Their roles are complementary.

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

## Current boundaries

The CLI has working static generation, corpus checks, public exports, local MCP, PDF export and generated identifier types. Richer services are separate integrations: Titan-Lumen must be configured inside an application, and an editor component does not create a persistence service by itself.

Locale metadata and translation-staleness checks exist, but Lumen does not supply a complete locale-routing, translation-management or documentation-versioning workflow. The current Pagefind builder labels its indexing input with the configured default locale. Validate multilingual retrieval explicitly. Likewise, a code fence is not a tested program: `codeExamplesGate` checks empty top-level examples, while Twoslash analyzes only explicitly marked fences. See the [verification boundaries](./architecture.md#what-checks-prove).

## See also {#continue}

- [Architecture and verification](./architecture.md)
- [Deployment choices and use cases](./use-cases.md)
- [Engineering comparison](./comparison.md)
- [Working showcase](./showcase.md)
- [Authoring reference](./authoring.md)
- [This site's build](./this-site.md)
- [Exact public package exports](../reference/api-index.mdx)
