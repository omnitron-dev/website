---
id: "lumen/comparison"
slug: "/docs/lumen/comparison"
title: Lumen engineering comparison
---
# Lumen engineering comparison

Lumen is a document compiler, static publisher and optional service integration within Omnitron. Its useful comparison with other tools is about what runs, what authors can express, where data goes and what a team must maintain. Similar features do not establish a shared origin or an architectural dependency.

This comparison uses the implemented Lumen package boundaries and the linked official documentation for other systems. It does not rank unmeasured speed, bundle size or security. Docusaurus refers to its documented 3.x family; other names identify projects rather than an assertion about their latest release.

## How to read the comparison

**Implemented** means an existing mechanism can be identified in Lumen's public entry points and implementation. **Integration** means the host application must assemble, configure or verify it. **Missing workflow** means the current Lumen configuration and CLI do not provide the end-to-end feature. A familiar type name or configuration field does not upgrade an integration task into a finished workflow.

| Criterion | Lumen's current boundary |
| --- | --- |
| Rendering and islands | **Implemented:** static HTML plus registered React islands under a shared context, with load/idle/visible/interaction triggers |
| Authoring and content validation | **Implemented:** Markdown/PDX AST, literal widget props, route/link/anchor checks and configurable gates. **Integration:** behavioral review and importing-example compilation |
| Typing | **Implemented:** typed AST/configuration, public identifier unions and opt-in Twoslash. **Limit:** code fences are not automatically type-checked against installed SDKs |
| Search and privacy | **Implemented:** local Pagefind output from the public projection. **Integration:** host access rules, cache policy and any additional providers |
| Localization and versions | **Implemented:** locale metadata and translation-staleness checks. **Missing workflow:** automatic locale/version routing, release snapshots and selectors. **From 0.4.13:** Pagefind indexes each document under its canonical locale. Server search does not yet enforce its locale option |
| Interactive demonstrations | **Implemented:** registered components and isolated QuickJS execution. **Integration:** source/preview coupling, SSR compatibility and browser tests in the site |
| Extension control | **Implemented:** custom gates, trusted layout, island registry and separate parser/renderer APIs. **Integration:** maintain and qualify those extensions |
| Deployment and evidence | **Implemented:** static publication and separate PDF/type exports. **Integration:** hosting, authenticated Titan services, reproducible dependency installation and artifact verification |

The [architecture guide](./architecture.md) names the source boundaries behind these statements. The [showcase](./showcase.md) exposes actual interactions rather than capability badges.

## Rendering and component models

| System | Document and rendering model | Consequence for an interactive reference |
| --- | --- | --- |
| Lumen | Typed Markdown/PDX tree, static publication, explicit React island registry | Authors pass data to approved components; the site owns component code and activation |
| Docusaurus 3 | MDX compiles to React components; Node plugins and the React theme communicate through the build pipeline | A React documentation application with MDX component scope and theme customization. [MDX](https://docusaurus.io/docs/markdown-features/react), [architecture](https://docusaurus.io/docs/advanced/architecture) |
| Astro Starlight | Astro renders components to HTML by default; `client:*` directives opt components into browser behavior | A direct fit for a mostly static document with selected interactive regions, including React through its integration. [Astro islands](https://docs.astro.build/en/concepts/islands/) |
| Fumadocs | Content sources feed Core and UI; Fumadocs MDX turns documents into React components and structured data | Compose documentation inside a chosen React framework. The current documentation offers more than a Next.js-only integration. [Introduction](https://www.fumadocs.dev/docs), [MDX](https://www.fumadocs.dev/docs/mdx) |
| VitePress | Markdown is processed as a Vue single-file component; static regions are optimized out of initial page JavaScript and skipped during hydration | Use Vue components and in-page logic, respecting SSR compatibility. React islands are not its documented component model. [Vue in Markdown](https://vitepress.dev/guide/using-vue) |
| Rspress | Rspack-based static documentation with React and MDX | Use React components in documents and the provided theme/build extension model. [Introduction](https://rspress.rs/guide/start/introduction) |
| Mintlify | MDX pages can contain custom JSX/TSX components and client state | Its documented component environment has constraints: injected hooks, configured third-party packages, no default exports, no dynamic imports or `React.lazy`. [React components](https://www.mintlify.com/docs/customize/react-components) |
| Quarto | Markdown and executable code cells produce documents and websites | Its central authoring workflow connects narrative to computations; use its interactive output mechanisms for the chosen language/runtime. [Execution options](https://quarto.org/docs/computations/execution-options.html), [websites](https://quarto.org/docs/websites/) |
| MyST | MyST Markdown and notebooks form a structured document model; web themes provide book/article reading experiences | Evaluate scientific-document composition and notebook reuse alongside theme customization. This refers to the MyST CLI, not the separate Sphinx parser alone. [Overview](https://mystmd.org/guide), [themes](https://mystmd.org/guide/website-templates) |

Lumen and Astro both expose explicit activation boundaries, but they are separate implementations with different configuration and extension APIs. Lumen's shared React context matters when several Prism controls need the same theme or provider. Astro's documented model also supports independent components and multiple UI frameworks. Neither observation establishes a universal performance result.

## Authoring, validation and typing

Lumen's document source is structured data. PDX permits literal props for registered widgets, while a normal TypeScript module contains their trusted implementation. That narrows what a document can execute, and also means arbitrary MDX imports and JavaScript expressions are not a drop-in authoring feature. The CLI's gates cover defined relationships and selected source contracts; `codeExamplesGate` does not compile snippets. See [what checks prove](./architecture.md#what-checks-prove).

Docusaurus and Rspress make React/MDX authoring central. Docusaurus supports imports and a global component scope; Rspress documents Markdown, MDX and React components as part of its authoring model. This is useful when authors maintain UI code alongside prose. The integration must still decide how imported code is type-checked and exercised. [Docusaurus MDX](https://docusaurus.io/docs/markdown-features/react), [Rspress guide](https://rspress.rs/guide/start/introduction).

Starlight accepts Markdown with required page metadata and offers MDX or Markdoc with their respective syntax. Its plugin catalogue separately identifies a community link validator and TypeDoc integration. Do not equate schema-valid metadata with source/API correctness. [Authoring](https://starlight.astro.build/guides/authoring-content/), [plugins](https://starlight.astro.build/resources/plugins/).

Fumadocs MDX supplies typed content collections. Collection schemas validate frontmatter or metadata, including Standard Schema-compatible validators. This is a useful distinction from merely typing the site configuration. It still does not establish that a code example behaves as described. [MDX](https://www.fumadocs.dev/docs/mdx), [collection schemas](https://www.fumadocs.dev/docs/mdx/collections).

VitePress's Vue compilation allows template expressions, directives and component logic in Markdown. Mintlify supports reusable React components within its documented MDX constraints. For both, test the exact authoring features and dependencies your examples require rather than assuming unrestricted JavaScript support. [VitePress](https://vitepress.dev/guide/using-vue), [Mintlify](https://www.mintlify.com/docs/customize/react-components).

Quarto's executable cells expose evaluation and output controls. MyST's scientific authoring includes structured metadata, citations and cross-references. These are valuable when a publication needs a computational or scholarly record. Lumen has mathematical objects, KaTeX and Typst export, but no built-in Jupyter/Knitr pipeline or proof assistant. [Quarto execution](https://quarto.org/docs/computations/execution-options.html), [MyST scientific documents](https://mystmd.org/guide/quickstart-myst-documents).

For every system, separate four checks: document syntax, metadata schema, example compilation and example behavior. TypeScript declarations for a library do not automatically establish all four. A good adoption trial includes a deliberately broken link, an invalid field, a wrong import and an incorrect assertion, then records which layer catches each failure.

## Search and privacy

| System | Documented search path | Decision to validate |
| --- | --- | --- |
| Lumen | Pagefind index and assets built from the anonymous projection | Test relevance, shard downloads and every published export; authenticated server search is a different path |
| Docusaurus 3 | Algolia DocSearch, Typesense, community local-search plugins or a custom search component | Choose the provider deliberately; it is not inherently restricted to SaaS. [Search](https://docusaurus.io/docs/search) |
| Starlight | Pagefind by default; optional Algolia DocSearch plugin | Local indexing is already a standard option here. [Site search](https://starlight.astro.build/guides/site-search/) |
| Fumadocs | Built-in server search or a static exported index consumed with the static client; other providers are available | Static mode downloads the exported index, so corpus size affects client cost. [Built-in search](https://www.fumadocs.dev/docs/headless/search/orama) |
| VitePress | In-browser MiniSearch with the local provider; Algolia and other integrations are alternatives | Evaluate tokenization, relevance and downloaded index size. [Search](https://vitepress.dev/reference/default-theme-search) |
| Rspress | Built-in full-text search using FlexSearch | Inspect the emitted index and any custom search extension. [Introduction](https://rspress.rs/guide/start/introduction) |
| Mintlify | Managed documentation search with configurable ranking, exclusion and result presentation | Inspect service configuration and access rules. Excluding a page from search does not make it inaccessible. [Search](https://www.mintlify.com/docs/optimize/search) |
| Quarto | Locally built full-text index by default; optional hosted Algolia | Assess local index delivery or the selected external service. [Website search](https://quarto.org/docs/websites/website-search.html) |
| MyST | Search behavior belongs to the selected site/theme and deployment | Inspect network behavior in that concrete deployment; this comparison makes no unsupported claim that every MyST theme uses a particular local engine. [Themes](https://mystmd.org/guide/website-templates), [deployment](https://mystmd.org/guide/deployment) |

A local index can keep query processing in the browser, but the host still delivers pages and assets. Analytics, custom components and external providers can add network traffic. Conversely, a search service can be self-hosted. Review the actual requests and deployment boundaries; neither “static” nor “local search” proves confidentiality for all content.

## Locales and versions

| System | Established workflow or integration boundary |
| --- | --- |
| Lumen | Locale fields and stale-translation diagnostics exist. Locale routes, translated UI, version snapshots and selectors require application work. Validate the installed Pagefind language handling; the server search locale option is not yet enforced |
| Docusaurus 3 | Built-in translation file conventions and versioned document/sidebar snapshots. [i18n](https://docusaurus.io/docs/i18n/introduction), [versioning](https://docusaurus.io/docs/versioning) |
| Starlight | Built-in multilingual routing, fallback content and RTL support. Its official catalogue lists documentation versioning as a community plugin. [i18n](https://starlight.astro.build/guides/i18n/), [plugins](https://starlight.astro.build/resources/plugins/) |
| Fumadocs | Documentation i18n coordinates with the host framework; versioned root folders can share a site, or versions can use separate deployments. [i18n integration](https://www.fumadocs.dev/docs/next/internationalization), [version navigation](https://www.fumadocs.dev/docs/next/navigation) |
| VitePress | Locale directories and locale-specific configuration are documented. Select and verify a release-version deployment/navigation strategy separately. [Internationalization](https://vitepress.dev/guide/i18n) |
| Rspress | Language configuration and per-language documents/navigation; default-theme multi-version configuration and version directories. [i18n](https://rspress.rs/guide/basic/i18n), [multi-version](https://rspress.rs/guide/basic/multi-version) |
| Mintlify | Navigation groups support version selectors and language organization. The content lifecycle and translation process still need an editorial policy. [Navigation](https://www.mintlify.com/docs/organize/navigation) |
| Quarto / MyST | Start from the publication and hosting structure, then qualify the required locale/version URLs, selectors and exports. The website/theme sources cited here do not establish an equivalent turnkey SDK-version workflow. [Quarto websites](https://quarto.org/docs/websites/), [MyST deployment](https://mystmd.org/guide/deployment) |

Translation metadata, translated interface labels, locale routing and search language handling are separate features. Likewise, a dropdown linking two builds is different from creating and maintaining release snapshots. Include old deep links, missing translations and cross-version navigation in a trial.

## Extension control, deployment and evidence cost

| Choice | What the team controls | Work to account for |
| --- | --- | --- |
| Lumen | Parser/transform APIs, corpus gates, trusted React layout and islands; static output or optional Titan services | Maintain extensions; test every export and interaction; configure authenticated hosting and live services explicitly |
| Docusaurus 3 | Node plugin lifecycle, theme and React/MDX components | Qualify plugin/theme changes and content across supported versions. [Architecture](https://docusaurus.io/docs/advanced/architecture) |
| Starlight | Astro integration, UI overrides and official/community plugins | Verify selected plugins and island/framework integrations. [Plugin model](https://starlight.astro.build/resources/plugins/), [islands](https://docs.astro.build/en/concepts/islands/) |
| Fumadocs | Core utilities, UI and content sources within a selected framework | Own framework routing/rendering, source schemas and search deployment. [Introduction](https://www.fumadocs.dev/docs), [search](https://www.fumadocs.dev/docs/headless/search/orama) |
| VitePress / Rspress | Vue or React documentation code, theme configuration and build extensions | Maintain the chosen component ecosystem and verify SSR, search and custom integrations. [VitePress](https://vitepress.dev/guide/using-vue), [Rspress](https://rspress.rs/guide/start/introduction) |
| Mintlify | Repository content, documented component extensions and managed project settings | Review platform constraints and service configuration; its quickstart uses managed deployment and Git or a web editor. This does not assert that every other export/hosting option is unavailable. [Quickstart](https://www.mintlify.com/docs/quickstart), [components](https://www.mintlify.com/docs/customize/react-components) |
| Quarto | Document sources, execution options and publication output | Reproduce language environments and generated results; static website hosting is supported. [Execution](https://quarto.org/docs/computations/execution-options.html), [publishing a website](https://quarto.org/docs/websites/) |
| MyST | Document structure, themes and static or application deployment | Verify the chosen theme and export path; the two deployment modes have different behavior and operating requirements. [Deployment](https://mystmd.org/guide/deployment) |

Owning an extension gives control over its behavior and also responsibility for upgrades, accessibility and defects. A managed service moves part of that work to a provider but introduces a service contract. A static build removes a required application server for reading, while leaving build dependencies and client assets to maintain. No option removes dependency or supply-chain risk.

## Choose with a small working corpus

For a React SDK portal with established release snapshots and translations, first examine the documented Docusaurus and Rspress workflows. For a mostly static site with explicit client islands and built-in local search, Starlight is a relevant comparison. For documentation embedded into a React application, evaluate Fumadocs's source and UI composition. VitePress is a relevant choice when the team and examples use Vue. A managed publishing workflow makes Mintlify worth evaluating against the required component and data boundaries. Quarto and MyST deserve direct trials when notebooks, citations and scientific exports drive the work.

Lumen is worth a trial when the same corpus needs graph checks, audience projection, multiple exports and controlled React demonstrations within the Omnitron stack. Its current costs include assembling locale/version workflows and proving site-specific examples, deployment and access behavior. These are engineering judgments based on the mechanisms above, not claims that any system is best in every setting.

Use one representative guide, a broken reference, an importing example, a restricted section, a translated page and a large search result set. Build and deploy them through each candidate's intended path. Record the artifacts and unresolved integration work alongside measurements. That gives a more useful decision record than a feature count.

## See also

- [Lumen architecture and verification](./architecture.md)
- [Use cases and deployment boundaries](./use-cases.md)
- [Working showcase](./showcase.md)
- [Authoring](./authoring.md)
- [This site's implementation](./this-site.md)
