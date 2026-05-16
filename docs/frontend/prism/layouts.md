---
sidebar_position: 4
title: Layouts
description: DashboardLayout, AuthLayout, CoreLayout — the three app shells.
---

# Layouts

Layouts are page-shell components — they own the chrome
(sidebar, topbar, footer, breadcrumbs) and slot in your route
content via `<Outlet />`.

Three pre-built layouts cover most app shapes. Each is also
extensible via slots.

## `<DashboardLayout>`

Admin / operator console shell: collapsible sidebar + topbar +
breadcrumbs + main content area.

```tsx
import { DashboardLayout } from '@omnitron-dev/prism/layouts';
import { Outlet } from 'react-router-dom';

const navItems = [
  { title: 'Dashboard', path: '/',         icon: 'home' },
  { title: 'Apps',      path: '/apps',     icon: 'box' },
  {
    title: 'Infrastructure',
    icon:  'grid',
    children: [
      { title: 'Containers', path: '/containers' },
      { title: 'Nodes',      path: '/nodes' },
    ],
  },
  { title: 'Settings',  path: '/settings', icon: 'cog', roles: ['admin'] },
];

function ConsoleShell() {
  return (
    <DashboardLayout
      brand="Platform"
      logo={<Logo size={32} />}
      navItems={navItems}
      topRight={
        <>
          <CommandPaletteTrigger />
          <NotificationsBell />
          <UserMenu />
        </>
      }
    >
      <Outlet />
    </DashboardLayout>
  );
}
```

### Props

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `brand` | `string` | — | Shown next to logo |
| `logo` | `ReactNode` | — | Header logo |
| `navItems` | `NavItem[]` | `[]` | Sidebar tree |
| `topRight` | `ReactNode` | — | Topbar right-side slot |
| `topLeft` | `ReactNode` | — | After breadcrumbs |
| `sidebarWidth` | `number` | `260` | px when expanded |
| `sidebarMiniWidth` | `number` | `64` | px when collapsed |
| `defaultCollapsed` | `boolean` | `false` | Initial sidebar state |
| `persistCollapse` | `boolean` | `true` | Persist via settings store |
| `showBreadcrumbs` | `boolean` | `true` | Auto-derived from route |
| `footer` | `ReactNode` | — | Sticky footer slot |
| `userRoles` | `string[]` | `[]` | Filters nav items with `roles` |

### `NavItem`

```typescript
interface NavItem {
  title:     string;
  path?:     string;
  icon?:     string | ReactNode;
  badge?:    number | string;       // e.g., '3', 'New'
  roles?:    string[];              // visibility filter
  children?: NavItem[];             // submenu — expands inline
  external?: boolean;               // opens in new tab
  divider?:  boolean;               // renders as section divider
}
```

Items with `children` render as expandable groups (chevron
toggle); current-route item gets the active style; deep
matches highlight the parent.

### Behaviour

- **Responsive** — sidebar collapses to icons-only on `md`
  breakpoint; below `sm`, becomes a `<Drawer>`.
- **Hover-expand** — when collapsed on desktop, hovering the
  sidebar expands it temporarily without committing.
- **Keyboard nav** — Tab through nav items; Enter / Space
  activates.
- **Breadcrumbs** — auto-derived from the active route, but
  pass `<Breadcrumbs>` as `topLeft` slot for custom paths.
- **Settings persistence** — collapse state, dark mode, layout
  density persist via Prism's settings store.

### Layout density

```tsx
import { useSettingsStore } from '@omnitron-dev/prism';

function DensityToggle() {
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  return (
    <select value={density} onChange={(e) => setDensity(e.target.value as any)}>
      <option value="compact">Compact</option>
      <option value="standard">Standard</option>
      <option value="comfortable">Comfortable</option>
    </select>
  );
}
```

Tables, lists, forms inside `<DashboardLayout>` respond to
density changes via theme spacing tokens.

## `<AuthLayout>`

Sign-in / sign-up / recover flow shell. Two-pane: form on
left, brand/illustration on right.

```tsx
import { AuthLayout } from '@omnitron-dev/prism/layouts';

function AuthRoutes() {
  return (
    <AuthLayout
      brand={<Logo />}
      tagline="Welcome to Platform"
      illustration={<img src="/auth-illustration.svg" />}
    >
      <Outlet />
    </AuthLayout>
  );
}
```

Pair with `<AuthBlock>` for the form content:

```tsx
<Routes>
  <Route element={<AuthLayout>...</AuthLayout>}>
    <Route path="/sign-in" element={<AuthBlock mode="sign-in" ... />} />
    <Route path="/sign-up" element={<AuthBlock mode="sign-up" ... />} />
    <Route path="/recover" element={<AuthBlock mode="forgot-password" ... />} />
  </Route>
</Routes>
```

### Props

| Prop | Type | Default |
| ---- | ---- | ------- |
| `brand` | `ReactNode` | — |
| `tagline` | `string` | — |
| `illustration` | `ReactNode` | — |
| `illustrationSide` | `'left' \| 'right'` | `'right'` |
| `backgroundColor` | `string` | (theme primary) |
| `centerForm` | `boolean` | `true` |

On mobile (`sm` and below), the illustration pane is hidden;
form takes the full width.

## `<CoreLayout>`

Minimal page shell — header + main + footer:

```tsx
import { CoreLayout } from '@omnitron-dev/prism/layouts';

function PublicPage() {
  return (
    <CoreLayout
      header={<PublicHeader />}
      footer={<PublicFooter />}
      maxWidth="lg"
    >
      <Outlet />
    </CoreLayout>
  );
}
```

Use for marketing pages, landing pages, public-facing routes
that don't need sidebar navigation.

| Prop | Type | Default |
| ---- | ---- | ------- |
| `header` | `ReactNode` | — |
| `footer` | `ReactNode` | — |
| `maxWidth` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` |
| `paddingY` | `number` | `4` |

## Custom layouts

Layouts compose components — build your own from
`<Drawer>` + `<AppBar>` + `<Container>`:

```tsx
function SplitLayout() {
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Drawer variant="permanent" sx={{ width: 320 }}>
        <CustomNav />
      </Drawer>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <PageContent>
          <Outlet />
        </PageContent>
      </Box>
    </Box>
  );
}
```

The pre-built layouts cover ~95% of needs — drop to components
only when your shell genuinely doesn't fit any of them.

## Mixing layouts in one app

```tsx
<Routes>
  {/* Public pages */}
  <Route element={<CoreLayout header={<PublicHeader />} />}>
    <Route path="/" element={<Landing />} />
    <Route path="/pricing" element={<Pricing />} />
  </Route>

  {/* Auth flow */}
  <Route element={<GuestGuard><AuthLayout>...</AuthLayout></GuestGuard>}>
    <Route path="/sign-in" element={<AuthBlock mode="sign-in" />} />
  </Route>

  {/* Authenticated app */}
  <Route element={<AuthGuard><DashboardLayout {...} /></AuthGuard>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/apps" element={<AppsPage />} />
  </Route>
</Routes>
```

Layouts are just route-element wrappers — react-router 7
handles the rest.

## Subpath imports

```tsx
import { DashboardLayout } from '@omnitron-dev/prism/layouts/dashboard';
import { AuthLayout }      from '@omnitron-dev/prism/layouts/auth';
import { CoreLayout }      from '@omnitron-dev/prism/layouts/core';
```

## See also

- [Blocks](./blocks.md) — composites that often sit inside
  layouts
- [Components catalog](./components.md) — components used in
  custom layouts
- [Theme](./theme.md) — density / spacing tokens
