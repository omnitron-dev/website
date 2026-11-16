---
id: "lumen/use-cases"
slug: "/docs/lumen/use-cases"
title: Lumen use cases
---
# Lumen use cases

Choose Lumen by the lifecycle your content needs. A published guide, an interactive component reference and an authenticated editing service share document structures, but require different deployment and verification work.

## Choose the smallest useful boundary

| Situation | Available foundation | Work owned by the application |
| --- | --- | --- |
| Public product or SDK documentation | Static pages, corpus checks, Pagefind, mirrors and agent exports | Navigation, examples, source verification, publishing and redirects |
| Private engineering reference | Audience projection and independent static artifacts | Authentication at the hosting boundary, cache policy and artifact separation |
| Interactive component documentation | Registered React islands, Prism `ComponentExample`, source display | SSR-compatible examples, client registration, keyboard and browser checks |
| Mathematical or technical publication | KaTeX, numbered mathematical objects, reference graph and offline Typst PDF | Editorial review, supported notation, font coverage and export inspection |
| Live documentation inside a Titan application | `LumenModule`, `LumenService`, access policy, live-edit service and MCP adapter | Identity admission, storage, revision conflict handling and service deployment |
| Multilingual, multi-version product portal | Locale metadata, translation-staleness evidence and custom layouts | Locale routes, version snapshots, selectors, translated UI and retrieval validation |

The last row is an integration project. If ready-made locale and version workflows are the main requirement, compare those facilities directly with [Docusaurus, Starlight, Rspress and other systems](./comparison.md#locales-and-versions).

## Publish a guide with repeatable checks

Keep document sources and the trusted site code in version control. Run the corpus checks before generating a complete publication. A minimal configuration is shown in the [overview](./overview.md#build-a-document-site).

```bash
lumen check
lumen build
lumen serve --host 127.0.0.1 --port 4173
```

Inspect the emitted HTML, search result, Markdown mirror and agent entry for a representative page. For an SDK guide, compile importing examples against the package versions readers will install. `codeExamplesGate` does not do that compilation for you. For a migration, compare emitted routes and fragments against the previous publication, including anchors reached from outside the site.

The result can be served as static files. The publishing system still needs a host, certificates, cache rules and a rollback method. Lumen's local output replacement is not a deployment service.

## Explain an API with a working component

Put the example in a normal TypeScript React module. Use Prism's controls and theme tokens, register the component with Lumen, and display source from that same module. A reader can inspect the exact implementation instead of a separately maintained approximation.

Initial rendering needs a useful static preview. Controls should become usable only after their handlers are attached. Browser-only dependencies need an explicit loading path. The [showcase](./showcase.md) demonstrates navigation, editing and isolated execution, and names which actions affect only browser memory.

For code that merely illustrates a result, use a code fence. Use Twoslash when a compiler-generated type annotation helps the explanation. Use the isolated playground for a small editable JavaScript computation. These are different kinds of evidence; a screenshot, a type annotation and a successful execution are not interchangeable.

## Publish a research or engineering paper

Keep the narrative, equations and declared mathematical relationships in the document tree. A graph can detect an unresolved reference or a dependency cycle; reviewers must still assess the argument and its evidence.

Choose `pdf.paperSections` and run `lumen pdf --outDir papers`. Inspect the resulting pages, fonts, equations and source fallbacks for diagrams. The HTML and PDF transforms serve different reading contexts, so visual parity is not implied. See [mathematical authoring](./authoring.md#mathematical-documents).

Lumen does not supply a Jupyter/Knitr execution pipeline. For research built around Python/R/Julia notebooks, compare Quarto or MyST and their reproducibility workflows before deciding whether custom integration is justified.

## Add authenticated services when needed

Titan-Lumen is an optional server integration. `LumenService` reads and searches allowed documents, exposes editable documents through admitted calls, and supports revision/hash-aware edits. `LumenMcpAdapter` routes MCP reads through the existing host's Netron handler. The local CLI MCP server remains an anonymous file-corpus interface.

A usable editing product needs an authenticated host, configured persistence, permissions, an editor connected to the service, and a conflict/retry experience. Prism's `ResearchEditor` supplies an editing interface; it does not make those deployment decisions. A configured knowledge base is an additional search path, not something a static build starts automatically.

Validate the complete request path with the caller's actual roles, including denied reads, a stale edit revision and a restricted search result. Do not present an in-memory browser editor as durable collaborative editing.

## What to measure before adopting

Use your own corpus and representative readers. Record publication time, artifact size, client code for each important route, search transfer size and relevance, time to usable controls, keyboard behavior and the effort required to reproduce the build. Test the chosen hosting and export path with access-restricted content where applicable.

These measurements are decision evidence, not universal rankings. A local index trades an external service dependency for artifact generation and client downloads. A custom island gives control and also creates code to maintain. A shared compiler reduces duplicated transformations, but every exported format still needs validation.

## See also

- [Architecture and verification boundaries](./architecture.md)
- [Engineering comparison](./comparison.md)
- [Working showcase](./showcase.md)
- [Authoring](./authoring.md)
- [Titan application framework](../titan/overview.md)
