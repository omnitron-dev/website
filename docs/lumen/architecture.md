---
id: "lumen/architecture"
slug: "/docs/lumen/architecture"
title: Lumen architecture
---
# Lumen architecture

Lumen separates document meaning, publication and browser behavior. The compiler produces a typed tree; the corpus assigns document identity and resolves references; the publisher emits a selected audience's artifacts. Trusted React components then make selected regions interactive. This separation lets the same document feed a web page, a Markdown client, a search index or a PDF without treating the source as an application module.

## Explore the pipeline

Choose a stage in this working Prism example. Parsing, link resolution, verification, projection and publication panels show results captured from the installed Lumen APIs for a small fictional corpus. The **Activate** stage contains a real React state update. Stage selection itself does not rebuild a site or start a service.

<PrismExample example="lumen-pipeline" hydrate="visible" />

The **Verify** stage compares an accepted link with a missing target; **Project** shows why removing restricted content before publishing differs from hiding it in the browser. **Render** lets you inspect HTML, Markdown, search records and the agent index. The source panel exposes the example component used here.

## Follow a document

| Stage | Input | Output | Runs in |
| --- | --- | --- | --- |
| Parse | Markdown/PDX and frontmatter | `LumenDocumentAst`, positions and diagnostics | Build process; parsing APIs are also usable independently |
| Assemble | Parsed documents and route configuration | `CorpusGraph` with IDs, routes, anchors and declared relationships | Build process |
| Verify | Graph, document trees and selected gates | Named results with errors or warnings | CLI or your own integration |
| Project | Corpus plus audience roles | Allowed documents and sections, with derived metadata | Before public rendering, indexing and exports |
| Publish | Projected documents, trusted layout and island registry | HTML, bundled assets, Pagefind files, Markdown mirrors and agent exports | Build process |
| Activate | Published HTML, island descriptors and client registry | Interactive components under `LumenShell` | Reader's browser |

The stages describe responsibilities, not a promise that every command runs every gate. The [verification table](#what-checks-prove) explains that distinction. Browser activation neither reparses the entire source corpus nor starts a Titan service.

## A document is data; a component is trusted code

The public `@omnitron-dev/lumen-ast` entry exports `parseDocument`, `parseDocumentSync`, typed nodes and transformations. The parser accepts Markdown, supported directives and literal PDX widgets. It does not execute MDX imports, arbitrary JavaScript expressions or event-handler expressions from document text.

```typescript
import { parseDocument } from '@omnitron-dev/lumen-ast';

const document = await parseDocument(
  '# Installation\n\nRead [configuration](./configuration.md).',
  'docs/installation.md',
);
console.log(document.children.map(node => node.type));
```

A widget names a component in the site's trusted registry and passes serializable data. The build needs that component to produce a useful initial preview; the browser needs the corresponding registration to attach behavior. A missing registration is an integration error, not a new component inferred from its name.

```jsx
<PrismExample example="doc-layout" hydrate="visible" />
```

`PrismExample` is this website's wrapper around Prism's `ComponentExample`; it is not a built-in Lumen tag available in every project. Its source and preview come from the same example module. See [authoring](./authoring.md) for registration and source-display details.

## The graph connects documents

`CorpusGraph` stores document IDs, source paths, output routes, heading anchors, mathematical objects and relationships. Links can resolve through the graph instead of relying on filenames alone. Explicit dependency edges participate in dependency ordering; ordinary navigation links may form cycles.

`lumen types --outDir generated` publishes unions of public document IDs, routes and mathematical object IDs. Applications can consume these declarations where they need compile-time identifier checking. This does not automatically type every Markdown link or every arbitrary string in application code.

## What checks prove

| Check | Implemented evidence | Limit |
| --- | --- | --- |
| Parsing and route assembly | Syntax diagnostics; duplicate IDs/routes and invalid routes are rejected | A valid document can still contain an incorrect claim |
| `linksGate` and `anchorsGate` | Internal targets and fragments resolve in the corpus | External URLs and deployed HTTP behavior need separate checks |
| `codeDefaultsGate` | Selected documented defaults are compared with supported TypeScript declarations, including explicitly referenced source files | It cannot infer every runtime default or configuration branch |
| `undocumentedExportsGate` | Declared symbols and selected source exports are matched against documentation evidence | A symbol mention does not establish behavioral coverage |
| `codeExamplesGate` | Empty top-level code blocks are rejected | It does not compile or execute examples |
| `mathKernelGate` | Mathematical dependency/reference integrity, cycle checks and stale-translation diagnostics | It is not a proof assistant or a theorem verifier |
| A `typescript twoslash` fence | TypeScript language-service analysis of that fence with packaged standard libraries | It does not execute the example or resolve this website's workspace dependencies |

`lumen check` runs the built-in gate set and configured custom gates; `--gates` selects a subset. `lumen build` performs parse/route checks, configured link/anchor checks and custom gates. It does not implicitly run the entire `check` suite. Configure broken links and anchors as `throw` when publication must stop on those errors.

This repository adds source, import, route and browser checks to cover its own promises. Those scripts are website integration, not capabilities automatically inherited by a new Lumen project. A failure should name its evidence: parse error, unresolved anchor, invalid import, inaccessible control or inaccurate prose.

## One public projection, several outputs

The default audience is anonymous. `projectDocumentAst`, `projectCorpusDocument` and `projectCorpus` apply access rules before deriving public outputs. The projected tree supplies content for HTML, search text, Markdown mirrors and agent exports. Public navigation and layout data must use the same projected corpus.

A static artifact has no request-time identity check. Anyone who receives a privileged build can read its files, including search shards and Markdown exports. Keep public and privileged artifacts in separate publication boundaries and inspect all output formats. Hiding a navigation item is not an access policy.

Pagefind creates a local index during the build. The browser retrieves its published modules and shards from the site's host; ordinary queries do not require a search SaaS or Titan endpoint. Your hosting logs, custom islands, analytics and additional search providers remain separate privacy decisions. The current index builder uses the configured default locale for indexing input, so document locale metadata alone is insufficient evidence for multilingual search quality.

## Static HTML and selective React activation

`@omnitron-dev/lumen-ui` exports `LumenShell`, island runtime primitives, navigation and search components. Islands share the shell's React provider context. Their `load`, `idle`, `visible` or `interaction` trigger controls activation timing. The runtime preserves the server preview until its replacement commits; source HTML remains available while deferred code loads.

An island is not a security sandbox. Its trusted component code has the ordinary capabilities of your client application. The isolated QuickJS playground is a separate execution mechanism with a different boundary. Do not use an island's delayed loading as an access restriction.

Mermaid is also a distinct browser workload: its actual engine converts diagram source into SVG after activation. Without JavaScript, readers retain the source fallback. Syntax highlighting, explicitly requested Twoslash analysis and KaTeX HTML typesetting can happen during the build. These operations have different costs and should not be bundled into a claim that every feature is static.

## Formats and runtime entry points

| Need | Public entry point or command | Integration boundary |
| --- | --- | --- |
| Parse or transform a document | `@omnitron-dev/lumen-ast` | Typed tree and output transforms |
| Browser highlighting or diagrams | `@omnitron-dev/lumen-ast/highlight`, `/diagrams` | Load the specific browser feature; avoid a broad server-oriented import |
| Static project | `@omnitron-dev/lumen`, `lumen check/build/serve` | Build configuration, corpus, layout and deployment |
| Shared UI and islands | `@omnitron-dev/lumen-ui`, `/runtime`, `/layout`, `/blocks`, `/search` | Register components and client behavior explicitly |
| PDF | `lumen pdf`, `@omnitron-dev/lumen-ast/typst` | Node-only offline Typst worker; selected paper sections and fonts |
| Local agent access | `lumen mcp --stdio` | Anonymous local corpus projection; Node-only MCP contract |
| Authenticated live documents | `@omnitron-dev/titan-lumen` | Host application, admitted Netron identity, persistence and policies |

PDF export uses a real Typst compiler with bundled fonts and an in-memory source. It has no package-registry or host-font lookup. Unsupported mathematics or missing glyphs fail; diagrams retain source in this output. It is a document export, not a screenshot of the site's React layout.

Titan-Lumen exposes `LumenService`, its module factory, access filtering, revision-aware live editing and `LumenMcpAdapter`. Roles come from the admitted Netron invocation. The HTTP MCP adapter delegates through the host's existing Netron handler; it does not establish another authentication stack or listener. Local file search is distinct from static Pagefind search. An optional configured knowledge base adds a further retrieval dependency.

## Reproduce the walkthrough

In this website repository, the Xec task in `.xec/tasks/lumen-example.js` builds a temporary two-document corpus using public package exports. It runs the real parser, graph, link/anchor gates, audience projection, serializers and Pagefind builder, then captures their results in `src/data/lumen-pipeline.json`.

```bash
xec run check-lumen-example
```

The check compares the captured result with the installed SDK, including an intentionally broken link and the omission of the example's team note from public outputs. The normal `xec run build` includes this check. Use `xec run update-lumen-example` to regenerate the fixture for review. This is a website demonstration check, not an additional built-in Lumen command. The complete static site still needs its own build and browser verification.

## Review the implementation

The main source boundaries are `packages/lumen-ast/src/compiler`, `packages/lumen/src/corpus`, `packages/lumen/src/gates`, `packages/lumen/src/ssg`, `packages/lumen/src/search`, `packages/lumen-ui/src/hydration` and `packages/titan-lumen/src`. Package manifests define which entry points are public. Read implementation and tests for the behavior you rely on; exported type names and historical audit reports do not establish that behavior by themselves.

## See also

- [Use cases and deployment responsibilities](./use-cases.md)
- [Engineering comparison](./comparison.md)
- [Working showcase](./showcase.md)
- [Authoring and export commands](./authoring.md)
- [This website's implementation](./this-site.md)
