---
id: "lumen/showcase"
slug: "/docs/lumen/showcase"
title: Lumen showcase
---
# Lumen showcase

These examples run inside this Lumen publication. Each has a specific boundary: document navigation, browser state, or an isolated worker. They demonstrate components and integration rather than controlling a deployed Omnitron instance.

## Navigate a small document

Choose **Prepare** or **Verify**, or use the button to move between them. The selected section is React state inside Prism's `DocLayout` and `DocSidebar`. This is a working component preview; it does not change the website's route. The surrounding sidebar and page links are the actual site's navigation.

<PrismExample example="doc-layout" hydrate="visible" />

The example's source panel shows the same TSX module that renders the preview. Reset remounts the component. This connection between implementation and displayed code is part of the website's example wrapper, using Prism's `ComponentExample`.

## Edit a local document

Change the text in the editor and choose **Save snapshot**. Expand **Saved Markdown** to inspect the captured source. This updates browser memory only: reloading discards the edit, and no document service is called.

<PrismExample example="research-editor" hydrate="visible" />

Prism's `ResearchEditor` emits a source snapshot. A production authoring application can connect that value to Titan-Lumen's revision-aware service, but must supply authentication, storage and conflict handling. The preview's timing sentence is sample text, not a performance measurement.

## Execute a bounded computation

Change the multiplier or the array, then run the expression. The result is produced by a fresh QuickJS execution in a browser worker. It is not a pre-recorded output. The example receives no DOM, network, filesystem or host credentials.

<Playground hydrate="visible" code="return [1, 2, 3].map(value => value * 2)" />

A syntax error appears in the result area. A subsequent run starts a new execution. This playground demonstrates JavaScript computation; it does not import the Omnitron SDK or invoke a remote service.

## Read one document in several formats

The following tabs are Lumen document directives. Their content is present in static HTML; browser behavior adds selection and keyboard navigation. Use the arrow keys to change tabs, or Home and End to reach either end.

:::tabs{label="Inspect one Lumen document"}
:::tab{label="HTML" value="html"}
Read the [architecture](./architecture.md) with its headings, tables and navigation.
:::
:::tab{label="Markdown" value="markdown"}
Open the [architecture Markdown mirror](/docs/lumen/architecture.md) and inspect the same public text.
:::
:::tab{label="Agent index" value="agents"}
Use the [agent index](https://omnitron.dev/llms.txt) to discover documents without scraping navigation.
:::
:::

## Search this publication

Open the header's search control and search for **Lumen architecture**. Follow a result to the actual document. The client loads Pagefind assets from this site's published output; no Titan search service is involved. The [API index](../reference/api-index.mdx) is a separate interactive view over a generated symbol inventory, with package and import-path filters.

Searching and filtering answer different questions. Full-text search finds an explanation; the API index identifies a public export. Neither establishes that a described runtime behavior has been tested.

## Inspect rendering boundaries

The [authoring guide](./authoring.md) includes a real browser-rendered Mermaid diagram, build-time KaTeX output and a Twoslash type query. Compare their initial HTML and activated state. A diagram's source fallback, an equation's typeset HTML and a compiler-generated annotation each reflect a different stage of the pipeline.

For implementation details, follow [this site's build](./this-site.md). For supported syntax and registration, use [authoring](./authoring.md). These demonstrations use the site's existing Prism theme and Lumen island runtime; they do not add a separate application framework.

## See also

- [Architecture](./architecture.md)
- [Authoring examples](./authoring.md)
- [Use cases](./use-cases.md)
- [Engineering comparison](./comparison.md)
- [This site's implementation](./this-site.md)
