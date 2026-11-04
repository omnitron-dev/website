---
title: Accessibility
description: Vision simulation, keyboard interaction and accessible composition with Prism.
---

# Accessibility

Prism's accessibility subpath exports **vision simulation** tools:
`VisionModeProvider`, `useVisionMode`, `getVisionModeStyles` and
`VISION_MODE_OPTIONS`. It does not export a general ARIA utility library.
Component accessibility also depends on the labels, semantics and focus
behaviour supplied by the application.

## Simulate colour perception

```tsx
import {
  VisionModeProvider, useVisionMode, VISION_MODE_OPTIONS,
  type VisionMode,
} from '@omnitron-dev/prism/accessibility';

function VisionSelector() {
  const { mode, setMode } = useVisionMode();
  return (
    <label>
      Vision simulation
      <select value={mode} onChange={(event) => setMode(event.target.value as VisionMode)}>
        {VISION_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Preview() {
  return (
    <VisionModeProvider defaultMode="normal" disablePersistence>
      <VisionSelector />
      <p>Review your application controls in each mode.</p>
    </VisionModeProvider>
  );
}
```

The modes are `normal`, `protanopia`, `deuteranopia`, `tritanopia` and
`achromatopsia`. The hook also exposes `toggle`, `reset` and `isFiltered`.
The provider installs SVG filters and applies the selected mode globally.
Use it in a development or preview surface with a visible reset control.

| Provider option | Meaning |
| --- | --- |
| `defaultMode` | Initial mode when no persisted preference takes precedence |
| `storageKey` | Persistence key; defaults to `prism-vision-mode` |
| `disablePersistence` | Starts without reading or writing the stored preference |
| `attributeName` | Attribute used for the filter; defaults to `data-vision` |

Simulation helps find colour-dependent distinctions. It does not measure
contrast, establish conformance or replace keyboard and assistive-technology
testing.

## Compose accessible screens

| Surface | Application responsibility |
| --- | --- |
| Icon-only actions | Supply a clear accessible name such as `aria-label` |
| Inputs | Associate labels and descriptions; connect validation errors to the field |
| Dialogs and drawers | Verify initial focus, Escape behaviour and focus restoration |
| Tables | Preserve headings; expose sort state and label row actions |
| Async results | Provide loading, empty and failure states; announce meaningful changes |
| Status colours | Include text or an icon shape in addition to colour |
| Motion | Respect reduced-motion preferences |

Start with the semantics of the underlying control. Avoid replacing a
button with a clickable `div`. Custom renderers and slots can remove
semantics that a default component supplies, so test the final composition.

## Menus and popovers

Under `createPrismTheme` or `PrismProvider`, menus, Select dropdowns and
popovers release pointer input when `open` becomes `false`. Their exit
animation may finish in the DOM, but the next click on a neighbouring control
works immediately. Open overlays keep MUI's click-away behaviour, keyboard
navigation and focus restoration. Closing a menu inside a dialog leaves
the parent dialog modal.

Keep the trigger mounted and give it an accessible name. Use the native
Escape and focus-restoration behaviour; disabling it to compensate for
an animation can strand keyboard users. Where an interaction needs immediate
visual removal, the MUI `Menu` exported from `@omnitron-dev/prism/ui` accepts
`transitionDuration={{ exit: 0 }}` through its ordinary public API.

Test the first click after selection, immediate reopening, Escape followed
by Tab, and menus inside dialogs. A test that retries a blocked click until
an animation ends can hide a lost first click.

## Verification loop

Navigate a representative screen using only Tab, Shift+Tab, Enter, Space
and Escape. Check visible focus in both themes, then test zoom and a narrow
viewport. Run the repository's `pnpm -F @omnitron-dev/prism test:a11y`
suite for its test application and add checks for your own screens.
Read [React testing](../../testing/react.md) for component-level examples.
