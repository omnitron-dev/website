---
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

## Palette

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

### Semantic colour tokens

Avoid hex codes in app code — use theme tokens:

```tsx
<Box sx={{ color: 'primary.main', bgcolor: 'background.paper' }} />
<Typography color="text.secondary">…</Typography>
```

This keeps dark mode working automatically and lets you re-skin
without touching component code.

## Typography

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

## Spacing

`spacing: 8` means `theme.spacing(N) === 8 × N` pixels. The
`sx` shorthand interprets numbers in spacing units:

```tsx
<Box sx={{ p: 2, mt: 4, gap: 1 }} />
// padding: 16px, margin-top: 32px, gap: 8px
```

Convention: use the spacing unit (`p: 2`) not pixel values
(`p: '16px'`) — keeps the rhythm consistent and tunable.

## Shape & shadows

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

## Dark mode

`<PrismProvider>` reads the theme mode from the settings store, so it
takes no `mode` prop — seed the initial mode with `defaultSettings`, then
read and update it via `useSettingsStore`. There is no `useColorMode`
hook.

```tsx
import { PrismProvider } from '@omnitron-dev/prism/core';
import { useSettingsStore } from '@omnitron-dev/prism';

function App() {
  return (
    <PrismProvider defaultSettings={{ mode: 'system' }}>
      <Outlet />
    </PrismProvider>
  );
}

function ModeToggle() {
  const mode       = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  return (
    <IconButton onClick={toggleMode}>
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  );
}
```

| Mode | Effect |
| ---- | ------ |
| `'light'` | Force light |
| `'dark'` | Force dark |
| `'system'` | Track `prefers-color-scheme` |

`mode` is the stored preference; the provider resolves `'system'` against
`prefers-color-scheme` internally before building the theme. State is
persisted via the settings store; survives reload; syncs across tabs.
(`toggleMode` flips light/dark; use `setMode('system')` to re-enable
system tracking.)

### Flash-of-wrong-theme prevention (SSR)

Prism's CSS variables output (`theme/css-variables.ts`) emits
a stylesheet that applies the correct colour scheme **before**
React hydrates. Include in your HTML head:

```html
<style id="prism-css-vars">
  /* Generated by generateCssVariables(theme) at build time */
</style>
```

Or use the Vite plugin (when one is configured) to inject it
automatically.

## Presets

Pre-tuned palettes for common aesthetics. Select one by name via the
`preset` option:

```tsx
const theme = createPrismTheme({ preset: 'luxury' });
```

Available presets (`PRESET_NAMES`): `default-light`, `default-dark`,
`luxury`, `arctic`, `nature`, `ember`, `dracula`, `midnight`, `retro`,
`minimal`. Non-default presets carry an inherent light/dark mode
(e.g. `dracula`/`midnight`/`ember` are dark; `luxury`/`arctic`/`nature`
are light) — selecting them forces that mode, while the two `default-*`
presets respect the `mode` option. Pick a preset, then layer
`primaryColor` / `borderRadius` / `density` on top.

## Density

Three densities adjust spacing + typography + control sizes:

```tsx
useSettingsStore.getState().setDensity('compact');
// 'compact' | 'standard' | 'comfortable'
```

Tables, lists, forms, dialogs respond automatically. Useful for
information-dense admin surfaces.

## Mixins

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
| `scrollbarStyles(theme)` | Prism custom scrollbar |
| `hideScrollX` / `hideScrollY` | Hidden-scrollbar containers (objects) |

(Standalone scrollbar/ellipsis helpers are also exported by name:
`customScrollbarMixin`, `hideScrollbarMixin`, `textEllipsisMixin`,
`multiLineEllipsisMixin`, `glassMixin`, `focusRingMixin`.)

## Components theme overrides

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

## CSS variables export

```tsx
import { generateCssVariables } from '@omnitron-dev/prism/theme';

const css = generateCssVariables(theme);
// → :root { --palette-primary-main: #7c4dff; ... }
```

Useful for:
- Server-side colour-scheme cookie + SSR.
- Sharing theme tokens with non-MUI elements (e.g., plain
  `<svg>` strokes that should track the theme).
- Embedding in `<style>` tag at the top of `<head>` to prevent
  flash.

## Anti-patterns

- **Hard-coded hex colours in components.** Use
  `theme.palette.X` / `sx={{ color: 'primary.main' }}` so dark
  mode + theme switches work.
- **`px` everywhere.** Use spacing units; relative `rem` for
  typography.
- **Multiple `<ThemeProvider>`s in the tree.** Confused
  inheritance, duplicate snackbar hosts.
- **Per-component `styled()` for one-off colours.** Prefer `sx`
  for one-offs; `styled()` for recurring patterns.
- **Bypassing the settings store for mode persistence.**
  Custom localStorage code drifts; use `useSettingsStore`
  (`mode` / `setMode` / `toggleMode`).
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

## See also

- [Components catalog](./components.md) — components themed via these tokens
- [Layouts](./layouts.md) — `<DashboardLayout>` reads density
- [Hooks catalog](./hooks-catalog.md) — `useSettingsStore`, theme-aware hooks
- [MUI v9 theming docs](https://mui.com/material-ui/customization/theming/) — underlying foundation
