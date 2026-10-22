---
sidebar_position: 12
title: Research workspaces
description: Scientific documents, block editing and typed knowledge graphs with a shared MUI theme.
---

# Research workspaces

Prism supplies independently composable components for research applications:

| Component | Import | Responsibility |
| --- | --- | --- |
| `ResearchDocument` | `@omnitron-dev/prism/components/research` | Render Markdown, equations, diagrams, source metadata and registered interactive blocks |
| `ResearchEditor` | `@omnitron-dev/prism/components/research-editor` | Edit scientific blocks and deliver an exact source snapshot |
| `MathInput` | `@omnitron-dev/prism/components/research-editor` | Edit LaTeX visually in place, or through its source field |
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

## Equations in place

Inline and display equations open inside the document. Click an equation, or
enter an adjacent inline equation with an arrow key. `Ctrl/Command + Shift + M`
inserts an inline equation. `Escape` or `Enter` returns to the document;
`Shift + Enter` remains available to MathLive. Boundary arrows navigate out of
the formula. A display equation with no reachable text neighbour creates one
editable paragraph on exit. Formula edits participate in the document's
undo/redo history, including edits from the LaTeX source field.

```tsx
<ResearchEditor
  initialSource={source}
  onChange={(snapshot) => saveDraft(snapshot.getSource())}
  math={{
    locale: 'en',
    maxLength: 16_384,
    labels: { field: 'Equation', done: 'Return to document' },
    options: { mathVirtualKeyboardPolicy: 'manual' },
  }}
/>
```

`math.labels` localizes the host controls; `math.locale` selects MathLive's
locale. MathLive uses a document-wide locale and virtual keyboard. Editors on
one page should share the application's locale. The host may configure macros,
inline shortcuts and keybindings through `math.options`. These are initial,
trusted settings: remount the input to replace them. Imported document text
never supplies executable configuration.

`MathInput` can also be used independently. Supply controlled `value` and
`onChange`; returning `false` rejects the edit synchronously. `onExit` hands
focus back to the host, and `onHistory` delegates undo/redo to its transaction
history. `readOnly`, labels and value remain reactive. The host owns draft
storage and conflict resolution.

The visual engine is [MathLive](https://mathlive.io/mathfield/guides/integration/),
loaded on first edit. Fonts are bundled locally; the component does not load
CDN assets, sound files or a compute engine. MUI controls and keyboard colours
inherit the Prism theme. A sanitizer preserves mathematical layout, the editable
input sink and local SVG icons while removing active markup and external resource
references. If visual loading fails, the LaTeX source field remains usable.

An untouched block retains its exact source, including line endings. An edited
block is serialized as Markdown/LaTeX; neighbouring untouched blocks remain
byte-identical. Unsupported math metadata stays in the source-preserving block
editor. An empty visual slot is stored explicitly as `\placeholder{}`. Syntax
errors remain visible with their source. Input and document limits reject a
change atomically rather than saving a truncated expression.

This is notation editing. It does not establish mathematical equivalence,
validate a proof or grant a certificate; those operations belong to the host's
verification service. Length limits do not establish a time bound for arbitrary
LaTeX or trusted user-defined macros.
