---
id: "frontend/prism/theme"
slug: "/docs/frontend/prism/theme"
sidebar_position: 7
title: Theme
description: Palette, typography, shadows, dark mode, presets.
---

# Theme

Prism's theme is MUI v9's theme + extensions (custom shadows,
density tokens, brand presets, runtime primary-color override). The
factory is `createPrismTheme` — it builds a fully-formed MUI theme from
a small set of high-level options.

```tsx
import { createPrismTheme } from '@omnitron-dev/prism/theme';

const theme = createPrismTheme({
  preset:       'luxury',   // brand palette (see Presets below)
  mode:         'dark',     // 'light' | 'dark' | 'system'
  primaryColor: '#7c4dff',  // runtime primary override (hex)
  borderRadius: 8,          // base radius in px (not `shape`)
  density:      'standard', // 'compact' | 'standard' | 'comfortable'
});
```

> Most apps never call `createPrismTheme` directly — `<PrismProvider>`
> builds the theme from the settings store for you. Reach for the factory
> when you need a theme outside React (SSR, Storybook, tests).

## Palette {#palette}

`createPrismTheme` does not take a raw MUI `palette` object. Instead you
pick a `preset` and (optionally) a `primaryColor`, and Prism builds the
full palette — including light/dark color schemes and channel variants —
for you. The resulting `theme.palette` is a standard MUI palette:

```typescript
theme.palette = {
  mode: 'light' | 'dark',
  primary:   { main, light, dark, contrastText },
  secondary: { main, light, dark, contrastText },
  error / warning / info / success: { main, light, dark, contrastText },
  text:       { primary, secondary, disabled },
  background: { default, paper, neutral },   // 'neutral' for subtle section bg
  action:     { active, hover, selected, disabled, disabledBackground, focus },
  divider,
}
```

To set the brand colour, pass `primaryColor: '#7c4dff'` — Prism derives
the light/dark shades and contrast text. For deeper customisation, pass
through raw MUI options via the `overrides` option
(`createPrismTheme({ overrides: { palette: { … } } })`).

### Semantic colour tokens {#semantic-colour-tokens}

Avoid hex codes in app code — use theme tokens:

```tsx
<Box sx={{ color: 'primary.main', bgcolor: 'background.paper' }} />
<Typography color="text.secondary">…</Typography>
```

This keeps dark mode working automatically and lets you re-skin
without touching component code.

### Readable status surfaces {#readable-status-surfaces}

Standard and soft alerts, soft chips and soft labels share one contrast
policy. Prism compares the semantic colour tones against their translucent
fill composited over `background.paper`, selecting a tone with at least
4.5:1 contrast when available. It preserves the colour token and emits both
scheme rules, so custom CSS variable prefixes and live light/dark switching
continue to work. This also covers MUI `Alert` and `Chip` used directly under
`PrismProvider` or `createPrismTheme`.

Custom palettes can use either ordinary MUI tonal roles or Prism's inverted
dark scale. When none of the supplied tones is readable, or a colour can
only be resolved by the browser, Prism uses `text.primary`. Inverted labels
use the theme's white surface and grey text fallback. Browser-resolved
colours, custom parent backgrounds and application `sx` overrides still
need contrast checks in the final UI; the calculation assumes an opaque
`background.paper` beneath the translucent fill.

An alert's `color` overrides its appearance; `severity` still selects its
meaning and icon. For example, `<Alert severity="warning" color="error">`
uses the error palette with the warning icon. Use text as well as colour
to explain the state.

## Typography {#typography}

```typescript
typography: {
  fontFamily:     '"Inter", "Roboto", sans-serif',
  fontSize:       14,            // base px
  htmlFontSize:   16,            // for rem conversion
  fontWeightLight:     300,
  fontWeightRegular:   400,
  fontWeightMedium:    500,
  fontWeightBold:      700,

  h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: '2rem',   fontWeight: 700, lineHeight: 1.25 },
  // … h3, h4, h5, h6
  subtitle1: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
  body1:     { fontSize: '1rem',     fontWeight: 400, lineHeight: 1.5 },
  body2:     { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
  caption:   { fontSize: '0.75rem',  fontWeight: 400, lineHeight: 1.4 },
  overline:  { fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' },
  button:    { fontWeight: 600, textTransform: 'none' },     // Prism default: no SHOUTY buttons
}
```

Apply via `<Typography>` or `sx`:

```tsx
<Typography variant="h3">Section title</Typography>
<Box sx={{ typography: 'body2', color: 'text.secondary' }}>Small print</Box>
```

## Spacing {#spacing}

`spacing: 8` means `theme.spacing(N) === 8 × N` pixels. The
`sx` shorthand interprets numbers in spacing units:

```tsx
<Box sx={{ p: 2, mt: 4, gap: 1 }} />
// padding: 16px, margin-top: 32px, gap: 8px
```

Convention: use the spacing unit (`p: 2`) not pixel values
(`p: '16px'`) — keeps the rhythm consistent and tunable.

## Shape & shadows {#shape--shadows}

Set the base radius via the `borderRadius` option (a number of px) —
`createPrismTheme({ borderRadius: 8 })`. It surfaces as `theme.shape.borderRadius`
on the resulting MUI theme. Shadows are generated for you:

```typescript
shadows: [
  'none',
  '0 1px 2px rgba(0,0,0,0.05)',
  '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.06)',
  // … 24 steps
]

customShadows: {
  z1:   '...',     // softer cards
  z4:   '...',     // floating panels
  z8:   '...',     // modals
  z16:  '...',     // popovers
  primary:   '...', // primary-tinted shadow
  secondary: '...',
  error: '...',
  warning: '...',
  info: '...',
  success: '...',
}
```

Use `<Paper elevation={N}>` for `shadows`; `boxShadow:
'customShadows.z4'` via `sx` for the custom variants.

## Dark mode {#dark-mode}

Prism compiles both MUI color schemes. A component uses CSS variables for
colours and `theme.applyStyles('dark', styles)` for scheme-specific rules;
it should not choose its rendered styles with `theme.palette.mode`.

`PrismProvider` supports three explicit ownership models:

| Owner | Provider configuration | Updating the preference |
| --- | --- | --- |
| Application settings | No mode props | `usePrismContext().setMode()` or the settings store |
| Parent component | `mode` and `onModeChange` | Parent updates the controlled prop |
| Website preference | `modeStorageKey` and optional `defaultMode` | `usePrismContext().setMode()`; native MUI persists and synchronizes it |

Do not combine `mode` with `modeStorageKey`. Controlled selection never writes
the global Prism settings store. The preference is `light`, `dark` or `system`;
`theme.palette.mode` is the resolved palette. `toggleMode()` chooses the opposite
resolved palette, while `setMode('system')` restores operating-system tracking.

```tsx
import { PrismProvider, usePrismContext } from '@omnitron-dev/prism/core';
import { IconButton } from '@omnitron-dev/prism/ui';
import { ThemeModeIcon } from '@omnitron-dev/prism/icons';

function ModeToggle() {
  const { settings, toggleMode } = usePrismContext();
  return (
    <IconButton aria-label="Switch colour theme" onClick={toggleMode}>
      <ThemeModeIcon mode={settings.mode} />
    </IconButton>
  );
}

export function App() {
  return <PrismProvider><ModeToggle /></PrismProvider>;
}
```

### Preview a change before saving {#preview-before-saving}

Prism 0.4.13 adds an `appearance` prop to `PrismProvider`. Use it for a
form where someone wants to see a color, contrast, preset or font-size change
before choosing **Save**. Keep the draft in the form. Pass only the fields
being previewed, and pass `mode` separately when previewing light or dark.
**Cancel** clears the draft and restores the saved appearance. Reloading the
page also discards the draft.

To save a remote preference, wait for the server to accept the draft, then
apply the confirmed values with `useSettingsStore.getState().updateSettings(values)`.
If saving fails, keep the draft available for retry. Controlled `mode` and
`appearance` are both available in the published Prism 0.4.13 package. [Provider implementation](https://github.com/omnitron-dev/omni/blob/4b113978b5f41a7a4702823cfa313930923439ee/packages/prism/src/core/provider.tsx)

### Flash-of-wrong-theme prevention (SSR) {#flash-of-wrong-theme-prevention-ssr}

The published Prism 0.4.12 package includes both `PrismThemeScript` and
`modeStorageKey`.

Use the same provider configuration in the server layout and the client tree.
Render `PrismThemeScript` before visible content. It uses MUI's
`InitColorSchemeScript` and the provider's actual selector; do not add a separate
site bootstrap, storage listener or CSS palette.

```tsx
import { PrismProvider, PrismThemeScript } from '@omnitron-dev/prism/core';
import type { ReactNode } from 'react';

export function SiteTheme({ children }: { children: ReactNode }) {
  return (
    <PrismProvider modeStorageKey="site-theme" defaultMode="system">
      <PrismThemeScript modeStorageKey="site-theme" defaultMode="system" />
      {children}
    </PrismProvider>
  );
}
```

Both palettes are present in the static HTML. The small initial script selects
the saved preference before React loads. An explicit `system` default also emits
a CSS media fallback for a reader without JavaScript or storage access. Explicit
light/dark preferences and forced modes take precedence. The script accepts a
CSP `nonce`; when rendered outside a provider, pass the matching `attribute`.

For an application palette, pass `themeOverrides={({ mode }) => ({ palette: ... })}`.
The factory evaluates that callback for **both** concrete modes, never `system`.
Keep common typography and component definitions independent of that callback's
mode. Component styles use `theme.vars` and `theme.applyStyles()` so their initial
server and client markup remains stable.

```tsx
<Box sx={theme => ({
  color: theme.vars.palette.text.primary,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  ...theme.applyStyles('dark', { boxShadow: 'none' }),
})} />
```

## Presets {#presets}

Pre-tuned palettes for common aesthetics. Select one by name via the
`preset` option:

```tsx
const theme = createPrismTheme({ preset: 'luxury' });
```

Available presets (`PRESET_NAMES`): `default-light`, `default-dark`,
`luxury`, `arctic`, `nature`, `ember`, `dracula`, `midnight`, `retro`,
`minimal`. Every preset provides paired light and dark palettes. Its visual
identity does not replace the selected mode. Pick a preset, then layer
`primaryColor`, `borderRadius` and `density` on top.

## Density {#density}

Three densities adjust spacing + typography + control sizes:

```tsx
useSettingsStore.getState().setDensity('compact');
// 'compact' | 'standard' | 'comfortable'
```

Tables, lists, forms, dialogs respond automatically. Useful for
information-dense admin surfaces.

## Mixins {#mixins}

Reusable style helpers (most are functions returning a `CSSObject` you
spread into `sx`):

```tsx
import { mixins } from '@omnitron-dev/prism/theme';

<Box sx={mixins.textGradient('to right', '#7c4dff', '#00bcd4')}>Gradient text</Box>
<Box sx={mixins.bgBlur({ blur: 6 })}>Backdrop blur card</Box>
<Box sx={(theme) => mixins.scrollbarStyles(theme)}>Custom scrollbar</Box>
```

Built-in mixins (keys on the `mixins` object):

| Mixin | Effect |
| ----- | ------ |
| `textGradient(direction, ...colors)` | Gradient text fill |
| `bgGradient({ direction, colors, ... })` | Linear gradient background |
| `bgBlur({ blur, color })` | Backdrop blur |
| `borderGradient({ color, borderWidth, borderRadius })` | Gradient border |
| `maxLine({ lines, lineHeight })` | Multi-line truncation with ellipsis |
| `scrollbarStyles(theme, { autoHide: true })` | Native themed scrollbar; hover/focus reveal on fine pointers |
| `hideScrollX` / `hideScrollY` | Hidden-scrollbar containers (objects) |

(Standalone scrollbar/ellipsis helpers are also exported by name:
`customScrollbarMixin`, `hideScrollbarMixin`, `textEllipsisMixin`,
`multiLineEllipsisMixin`, `glassMixin`, `focusRingMixin`.)

## Components theme overrides {#components-theme-overrides}

Pass raw MUI component overrides through the `overrides` option:

```typescript
createPrismTheme({
  overrides: {
    components: {
      MuiButton: {
        defaultProps:  { variant: 'contained', size: 'medium' },
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none' },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
    },
  },
});
```

Useful for enforcing project-wide conventions (e.g., "all
buttons are contained, no uppercase").

## CSS variables export {#css-variables-export}

For components and CSS around a Prism provider, use the variables emitted by
MUI, such as `var(--prism-palette-primary-main)`. They follow the active colour
scheme and the configured prefix without another theme generator.

`generateCssVariables(theme, config)` projects a single resolved palette into a
separate variable dictionary for non-MUI consumers:

```tsx
import { createPrismTheme, generateCssVariables } from '@omnitron-dev/prism/theme';

const theme = createPrismTheme({ mode: 'dark' });
const variables = generateCssVariables(theme, {
  prefix: 'embedded', colorSchemeSelector: 'data-embedded-theme', enabled: true,
});
// variables['--embedded-primary'] is the resolved primary colour.
```

The result is an object, not a stylesheet string. In a browser this API also
installs the projection into the document. It does not supply paired SSR schemes
or replace `PrismThemeScript`; do not run it as a second mode owner beside the
provider.

## Anti-patterns {#anti-patterns}

- **Hard-coded hex colours in components.** Use
  `theme.palette.X` / `sx={{ color: 'primary.main' }}` so dark
  mode + theme switches work.
- **`px` everywhere.** Use spacing units; relative `rem` for
  typography.
- **Multiple `<ThemeProvider>`s in the tree.** Confused
  inheritance, duplicate snackbar hosts.
- **Per-component `styled()` for one-off colours.** Prefer `sx`
  for one-offs; `styled()` for recurring patterns.
- **Competing mode owners.** Choose the settings store, a controlled parent
  or native website persistence; do not add per-site storage/media listeners.
- **`:not(:first-of-type)` / `:nth-of-type` sibling selectors
  in `styleOverrides`.** MUI v9 dropped the legacy of-type
  pattern in favour of explicit position classes
  (`firstButton` / `middleButton` / `lastButton` on
  `ToggleButtonGroup`, similar tags on other grouped
  components). The of-type form silently misfires once
  consumers add wrapper elements or fragments; child-position
  (`:first-child` / `:last-child` / `:nth-child`) is the
  general-purpose replacement when no position class exists.
- **`forwardRef` wrappers in component code.** React 19
  threads `ref` through props automatically — declare
  `ref?: Ref<HTMLElement>` on the props interface and use
  it directly. No `forwardRef`, no `displayName` follow-up.

## Application icon families {#application-icon-families}

`PrismIconProvider` from `@omnitron-dev/prism/icons` supplies a semantic icon set
to layouts, editors, graphs and MUI slots, including portals. Its `icons` prop
accepts a partial `PrismIconSet`; missing slots retain the parent or bundled icon.
Use `Record<PrismIconName, PrismIconComponent>` for compile-time coverage of every
slot, and `prismIconNames` to enumerate them. Supplied components accept
`SvgIconProps`, forward the SVG ref and preserve MUI accessibility semantics.

```tsx
import { PrismIconProvider, type PrismIconSet } from '@omnitron-dev/prism/icons';

const icons = { search: ApplicationSearchIcon } satisfies PrismIconSet;
<PrismIconProvider icons={icons}>
  <PrismThemeProvider theme={theme}>{children}</PrismThemeProvider>
</PrismIconProvider>;
```

The application supplies and licenses its artwork. The provider does not fetch
icons or replace rendered DOM. Component-level MUI slots and explicit icon props
take precedence; nested providers inherit the outer set.

## See also {#see-also}

- [Components catalog](./components.md) — components themed via these tokens
- [Layouts](./layouts.md) — `<DashboardLayout>` reads density
- [Hooks catalog](./hooks-catalog.md) — `useSettingsStore`, theme-aware hooks
- [MUI v9 theming docs](https://mui.com/material-ui/customization/theming/) — underlying foundation
