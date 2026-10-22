---
sidebar_position: 12
title: Research workspaces
description: Scientific documents, block editing and typed knowledge graphs with a shared MUI theme.
---

# Research workspaces

Prism supplies three independent components for research applications:

| Component | Import | Responsibility |
| --- | --- | --- |
| `ResearchDocument` | `@omnitron-dev/prism/components/research` | Render Markdown, equations, diagrams, source metadata and registered interactive blocks |
| `ResearchEditor` | `@omnitron-dev/prism/components/research-editor` | Edit scientific blocks and deliver an exact source snapshot |
| `KnowledgeGraph` | `@omnitron-dev/prism/components/knowledge-graph` | Inspect entities and typed relations through a graph or searchable index |

Import the corresponding `styles.css` subpath for each component. Render them
under the application's Prism theme. Buttons, search fields, insertion dialogs
and block menus use MUI, so application component overrides and locale settings
apply inside the workspace too.

## One visual system

Colours come from `theme.palette`; editor and graph radii come from
`theme.shape.borderRadius`. Override these through the
[Prism theme](./theme.md), rather than adding global `button` or `input` CSS.
The scientific components also expose two inherited CSS variables:

```css
.research-workspace {
  --prism-border-width: 1px;
  --prism-focus-width: 2px;
}
```

The first controls structural boundaries. The second controls keyboard focus
and the editor's insertion indicator. Selection changes colour without moving
the layout. React Flow nodes, controls, edges and the searchable index inherit
the same palette. Native canvas controls remain scoped to the graph.

`className` and `sx` allow per-instance composition. Graph and editor labels are
configurable; pass a `labels` object to localize their controls. A graph's
`renderDetails` slot can contain application-specific revision and verification
information without coupling Prism to that application's backend.

## Keep document and knowledge semantics separate

`ResearchEditor` accepts `initialSource`. Its `onChange` callback delivers a
`ResearchSnapshot`; call `getSource()` to obtain the exact current source.
The imperative `ResearchEditorHandle.getSnapshot()` reads the same state,
including the last delivered transaction. Replace the React key when loading
a different edition, or explicitly reconcile an existing draft before replacing
it. `readOnly` disables editing on the contenteditable surface itself.

Registered scientific widgets use explicit type/version entries. A document
cannot authorize new executable widgets. Unsupported source blocks remain
preserved, and changing the host's widget registry does not discard the draft.

`KnowledgeGraph` takes `KnowledgeGraphData` with stable entity and relation
identities. Relations have ordered input/output ports: they are not flattened
into arbitrary pairwise edges. The component validates references before
projection and bounds the displayed neighbourhood with `visibleBudget`.
Omitted relations are counted explicitly. Dragging changes visual coordinates
through `onLayoutChange`; it does not change the knowledge relation.

The host owns persistence, permissions, revision selection and proof checking.
A visual selection or rendered equation is not a proof certificate. Supply
verified status and diagnostics from the host through `renderDetails` and
ordinary Prism components.
