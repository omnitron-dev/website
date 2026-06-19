---
sidebar_position: 4
title: Layouts
description: DashboardLayout + the three auth layouts + the core layout primitives.
---

# Layouts

Layouts are page-shell components — they own the chrome (sidebar,
header, footer) and slot in your route content (typically a
react-router `<Outlet />`).

Everything lives under a **single** subpath, `@omnitron-dev/prism/layouts`.
There are **no** `/layouts/dashboard`, `/layouts/auth`, or
`/layouts/core` deep imports — the package `exports` map only declares
`./layouts`, so deep imports will not resolve.

```tsx
import {
  // Application shell
  DashboardLayout,
  // Auth shells
  AuthCenteredLayout,
  AuthSplitLayout,
  AuthSimpleLayout,
  // Context / config
  LayoutProvider,
  useLayoutContext,
  useLayoutConfig,
  useNavActive,
  // Core primitives (build-your-own)
  LayoutSection,
  MainSection,
  HeaderSection,
  UserMenu,
} from '@omnitron-dev/prism/layouts';
```

| Export | What it is |
| ------ | ---------- |
| `DashboardLayout` | Full app shell — sidenav / topnav / combo + header + content |
| `DashboardContent` | Padded content wrapper for use inside the dashboard `<main>` |
| `Sidenav` / `MobileSidenav` | The desktop / mobile sidebar (rendered by `DashboardLayout`) |
| `AuthCenteredLayout` | Card-centered auth shell (sign-in / sign-up / reset) |
| `AuthSplitLayout` | Split-screen auth shell (illustration + form) |
| `AuthSimpleLayout` | Minimal auth/error/maintenance shell |
| `LayoutProvider` | Context provider holding layout config + nav state |
| `LayoutSection` / `MainSection` | Structural primitives for custom shells |
| `HeaderSection` / `HeaderToolbar` | Slot-based sticky header |
| `UserMenu` | Avatar-trigger account dropdown for the header `rightArea` |

There is **no** single `<AuthLayout>` component (only an
`AuthLayoutProps` / `AuthLayoutVariant` _type_), and there is **no**
`<CoreLayout>` — the minimal shell is composed from `LayoutSection` +
`HeaderSection`, or you reach for `AuthSimpleLayout`.

## `<DashboardLayout>`

Admin / operator console shell. It wraps its children in a
[`LayoutProvider`](#layoutprovider) and renders a header plus a
sidenav, a topnav, or both — driven by `initialConfig.navigationMenuType`
(`'sidenav'` by default).

```tsx
import { DashboardLayout, UserMenu } from '@omnitron-dev/prism/layouts';
import type { LayoutNavData } from '@omnitron-dev/prism/layouts';
import { Outlet } from 'react-router-dom';

const navData: LayoutNavData = [
  {
    id: 'main',
    subheader: 'Overview',
    items: [
      { id: 'dashboard', title: 'Dashboard', path: '/', icon: <DashboardIcon /> },
      { id: 'apps', title: 'Apps', path: '/apps', icon: <AppsIcon /> },
    ],
  },
  {
    id: 'infra',
    subheader: 'Infrastructure',
    items: [
      {
        id: 'infrastructure',
        title: 'Infrastructure',
        icon: <GridIcon />,
        children: [
          { id: 'containers', title: 'Containers', path: '/containers' },
          { id: 'nodes', title: 'Nodes', path: '/nodes' },
        ],
      },
      {
        id: 'settings',
        title: 'Settings',
        path: '/settings',
        icon: <CogIcon />,
        allowedRoles: ['admin'],
      },
    ],
  },
];

function ConsoleShell() {
  return (
    <DashboardLayout
      logo={<Logo size={32} />}
      navData={navData}
      headerSlots={{
        centerArea: <CommandPaletteTrigger />,
        rightArea: (
          <>
            <NotificationsBell />
            <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com' }} />
          </>
        ),
      }}
      initialConfig={{ navigationMenuType: 'sidenav', sidenavVariant: 'default' }}
      persistKey="console"
    >
      <Outlet />
    </DashboardLayout>
  );
}
```

### Props

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `children` | `ReactNode` | — | Page content (your `<Outlet />`) |
| `navData` | `LayoutNavData` | — | Navigation tree — `LayoutNavSection[]` (see below) |
| `headerSlots` | `HeaderSlots` | — | Header content per slot (`leftArea` / `centerArea` / `rightArea` / `topArea` / `bottomArea`) |
| `logo` | `ReactNode` | — | Logo shown in the sidenav (and as the mobile header left slot) |
| `footer` | `ReactNode` | — | Rendered at the bottom of the main column |
| `sidenavFooter` | `ReactNode` | — | Footer content pinned inside the sidenav |
| `layoutQuery` | `Breakpoint` | `'lg'` | Breakpoint at/above which the desktop sidenav shows and the mobile drawer/menu-button hides |
| `initialConfig` | `Partial<LayoutConfig>` | — | Initial layout config (nav type, sidenav variant, nav color, …) |
| `persistKey` | `string` | — | When set, sidenav collapsed state persists to `localStorage` under this key. Use a unique key per layout (e.g. `'main'`, `'admin'`) |
| `slotProps` | `{ header?, main? }` | — | `header` forwards to `HeaderSection`; `main` accepts `{ sx, disablePadding, maxWidth }` |

There is **no** `brand` / `navItems` / `topRight` / `topLeft` /
`sidebarWidth` / `defaultCollapsed` / `persistCollapse` /
`showBreadcrumbs` / `userRoles` prop. The header is composed via
`headerSlots`; the logo goes through `logo`; nav uses `navData`; and
nav-item visibility is expressed per-item with `allowedRoles` /
`allowedPermissions` (see [`LayoutNavItem`](#layoutnavitem)).

:::note Mobile menu button is automatic
When a sidenav is active, `DashboardLayout` injects a hamburger
`<IconButton>` into the header `leftArea` below `layoutQuery` (it
toggles the mobile drawer). You don't need to add one yourself —
anything you pass in `headerSlots.leftArea` renders **after** it.
:::

### `LayoutNavData`

Navigation is a list of **sections**, each with an optional subheader
and a list of items:

```typescript
type LayoutNavData = LayoutNavSection[];

interface LayoutNavSection {
  id: string;
  subheader?: string;       // group heading
  items: LayoutNavItem[];
}
```

### `LayoutNavItem`

```typescript
interface LayoutNavItem {
  id: string;                       // unique item ID (required)
  title: string;                    // display label
  path?: string;                    // route (leaf items)
  icon?: ReactNode;                 // icon element
  info?: ReactNode;                 // trailing info/label
  caption?: string;                 // secondary description text
  disabled?: boolean;
  external?: boolean;               // external link
  children?: LayoutNavItem[];       // nested menu — expands inline
  allowedRoles?: string[];          // visibility filter (roles)
  allowedPermissions?: string[];    // visibility filter (permissions)
  deepMatch?: boolean;              // active on child routes (default: true)
  badge?: string | number;          // count / "new" indicator
  selectionPrefix?: string | string[]; // keep active across disjoint URL spaces
}
```

Active-state rules (implemented in `isNavItemActive`):

- **Exact match** — `path` equals the current pathname (query/hash and
  trailing slashes are stripped first).
- **`selectionPrefix`** — active when the path starts with any listed
  prefix. Accepts a string or an array (any prefix wins) so one entry
  can span two URL spaces, e.g.
  `selectionPrefix: ['/communities', '/c/']`.
- **`deepMatch`** (default `true`) — active when `path` is a
  segment-aligned prefix of the pathname (`/admin/orgs` stays
  highlighted on `/admin/orgs/list`, but `/product` does **not** match
  `/products`). Set `deepMatch: false` to require an exact match.

Items with `children` render as inline-expandable groups; a parent
stays highlighted when one of its descendants is active.

### Behaviour

- **Navigation type** — `initialConfig.navigationMenuType` selects
  `'sidenav'` (default), `'topnav'`, or `'combo'` (both). Sidenav and
  combo render `Sidenav` + `MobileSidenav`; topnav and combo render the
  `Topnav` bar.
- **Sidenav variants** — `initialConfig.sidenavVariant` is `'default'`,
  `'mini'`, or `'stacked'`; widths come from `DRAWER_WIDTHS`
  (`full: 280`, `mini: 73`, `stackedExpanded: 300`,
  `stackedCollapsed: 72`).
- **Responsive** — at/above `layoutQuery` the desktop `Sidenav` shows
  and the main content is offset by the drawer width; below it, the
  sidebar becomes a `MobileSidenav` drawer toggled by the injected
  header menu button.
- **Collapse persistence** — toggling collapse persists to the settings
  store under `persistKey` (and is restored on mount). Without
  `persistKey`, collapse is in-memory only.
- **Accessibility** — renders a `SkipLink` to `#main-content`, a
  `role="main"` landmark, and ARIA labels for the header / nav.

### `DashboardContent`

Optional padded wrapper for content rendered inside the dashboard
`<main>` (handy when you don't pass `slotProps.main`):

```tsx
import { DashboardContent } from '@omnitron-dev/prism/layouts';

<DashboardContent maxWidth="xl">
  <PageHeader title="Apps" />
  <AppsTable />
</DashboardContent>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` | — |
| `disablePadding` | `boolean` | `false` |
| `maxWidth` | `Breakpoint \| false` | — |
| `sx` | `SxProps<Theme>` | — |

### Layout density

Density is a setting on Prism's settings store, not a layout prop —
read/write it with `useSettingsStore`:

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

`ComponentDensity` is `'compact' | 'standard' | 'comfortable'`. Tables,
lists, and forms respond to it via theme spacing tokens.

## Auth layouts

There are three auth shells. They share a help-link header pattern but
differ in how the form is framed. None of them require a `LayoutProvider`.

### `<AuthCenteredLayout>`

Card-centered form on a subtle gradient — the default for sign-in /
sign-up / reset / verify.

```tsx
import { AuthCenteredLayout } from '@omnitron-dev/prism/layouts';

function SignInPage() {
  return (
    <AuthCenteredLayout logo={<Logo />}>
      <SignInForm />
    </AuthCenteredLayout>
  );
}
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` | — |
| `logo` | `ReactNode` | — |
| `maxWidth` | `number \| string` | `420` |
| `sx` | `SxProps<Theme>` | — |

Companion: `AuthCenteredContent` — a standalone card wrapper
(`children`, `maxWidth = 420`, `sx`) for composing your own centered shell.

### `<AuthSplitLayout>`

Split-screen: branded illustration pane on the left (hidden below `md`),
form on the right. Includes a built-in help link in the header.

```tsx
import { AuthSplitLayout } from '@omnitron-dev/prism/layouts';

function SignInPage() {
  return (
    <AuthSplitLayout
      logo={<Logo />}
      title="Welcome to Platform"
      subtitle="Sign in to continue to your dashboard"
      illustration={<img src="/auth-illustration.svg" alt="" />}
    >
      <SignInForm />
    </AuthSplitLayout>
  );
}
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` | — |
| `logo` | `ReactNode` | — |
| `title` | `string` | `'Welcome'` |
| `subtitle` | `string` | — |
| `illustration` | `ReactNode` | — |
| `showHelp` | `boolean` | `true` |
| `helpUrl` | `string` | `'/help'` |
| `helpText` | `string` | `'Need help?'` |
| `settingsButton` | `ReactNode` | — |
| `maxWidth` | `number \| string` | `480` |
| `illustrationSx` | `SxProps<Theme>` | — |
| `sx` | `SxProps<Theme>` | — |

The illustration pane is hidden below the `md` breakpoint; the form
then takes the full width. Companions `AuthSplitIllustration`
(`title` / `subtitle` / `illustration` / `sx`) and `AuthSplitContent`
(`children` / `maxWidth` / `sx`) let you assemble a custom split.

### `<AuthSimpleLayout>`

Minimal shell with just a help-link header — for error pages (404 /
500), maintenance pages, or compact auth forms.

```tsx
import { AuthSimpleLayout } from '@omnitron-dev/prism/layouts';

function NotFoundPage() {
  return (
    <AuthSimpleLayout logo={<Logo />} compact>
      <NotFoundContent />
    </AuthSimpleLayout>
  );
}
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` | — |
| `logo` | `ReactNode` | — |
| `showHelp` | `boolean` | `true` |
| `helpUrl` | `string` | `'/help'` |
| `helpText` | `string` | `'Need help?'` |
| `settingsButton` | `ReactNode` | — |
| `compact` | `boolean` | `false` |
| `maxWidth` | `Breakpoint \| false` | `'lg'` |
| `sx` | `SxProps<Theme>` | — |

With `compact`, content is centered in a `448px` column; otherwise it
fills a `<Container maxWidth={maxWidth}>`. Companion:
`SimpleCompactContent` (`children` / `sx`) for the compact wrapper alone.

## `<LayoutProvider>`

`DashboardLayout` mounts a `LayoutProvider` for you. Use it directly
only when you build a custom dashboard-style shell from the primitives
and need access to layout config + nav state.

```tsx
import { LayoutProvider, useLayoutContext } from '@omnitron-dev/prism/layouts';

<LayoutProvider initialConfig={{ navigationMenuType: 'combo' }} persistKey="admin">
  <CustomShell />
</LayoutProvider>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` | — |
| `initialConfig` | `Partial<LayoutConfig>` | — |
| `persistKey` | `string` | — |

`LayoutConfig` holds: `navigationMenuType` (`'sidenav' \| 'topnav' \| 'combo'`),
`sidenavVariant` (`'default' \| 'mini' \| 'stacked'`), `sidenavCollapsed`,
`topnavVariant`, `navColor` (`'default' \| 'vibrant' \| 'integrate'`),
`drawerOpen`, `drawerWidth`, and `compactLayout`.

### Hooks

| Hook | Returns |
| ---- | ------- |
| `useLayoutContext()` | Full context: `config`, `isMobile`, `setConfig`, `toggleDrawer`, `toggleSidenavCollapse`, `setNavigationMenuType`, `setSidenavVariant`, `setNavColor`, `openItems` / `toggleItem` / `isItemOpen`, `isNavItemActive`, `isNestedItemActive`. Throws outside a `LayoutProvider`. |
| `useLayoutConfig()` | Just the current `LayoutConfig`. |
| `useSidenavVisible()` | `true` for `'sidenav'` / `'combo'`. |
| `useTopnavVisible()` | `true` for `'topnav'` / `'combo'`. |
| `useNavActive(pathname)` | `{ isItemActive, isNestedActive }` for a given pathname (pass `useLocation().pathname` from your router). |

```tsx
import { useLayoutContext } from '@omnitron-dev/prism/layouts';

function CollapseToggle() {
  const { config, toggleSidenavCollapse } = useLayoutContext();
  return (
    <IconButton onClick={toggleSidenavCollapse}>
      {config.sidenavCollapsed ? <MenuOpenIcon /> : <MenuIcon />}
    </IconButton>
  );
}
```

## Core primitives (custom shells)

When none of the pre-built shells fit, compose your own from the core
primitives. There is no `<CoreLayout>` — `LayoutSection` is the root
container, `HeaderSection` is the slotted header, and `MainSection` is a
padded `<main>`.

```tsx
import {
  LayoutSection,
  MainSection,
  HeaderSection,
  Sidenav,
} from '@omnitron-dev/prism/layouts';

function CustomShell() {
  return (
    <LayoutSection
      headerSection={
        <HeaderSection
          slots={{ leftArea: <Logo />, rightArea: <UserMenu user={user} /> }}
        />
      }
      sidebarSection={<Sidenav navData={navData} />}
      footerSection={<Footer />}
    >
      <MainSection>
        <Outlet />
      </MainSection>
    </LayoutSection>
  );
}
```

### `LayoutSection`

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `headerSection` | `ReactNode` | Rendered at the top |
| `sidebarSection` | `ReactNode` | Renders a flex sidebar+main row when present |
| `footerSection` | `ReactNode` | Rendered at the bottom of the main column |
| `children` | `ReactNode` | Main content |
| `cssVars` | `Record<string, string \| number>` | Override layout CSS variables |
| `sx` | `SxProps<Theme>` | — |

`MainSection` takes just `children` + `sx` (padded `<main>` flex column).

### `HeaderSection`

A sticky, slot-based `AppBar` with a scroll blur/elevation effect. Used
internally by the dashboard and split/simple auth layouts; usable
standalone.

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `slots` | `HeaderSlots` | — | `topArea` / `leftArea` / `centerArea` / `rightArea` / `bottomArea` |
| `slotProps` | per-slot `SxProps` + `container` | — | Style each slot |
| `disableSticky` | `boolean` | `false` | Use `position="static"` |
| `disableOffset` | `boolean` | `false` | Disable the scroll-blur background layer |
| `disableElevation` | `boolean` | `false` | Disable the scroll shadow |
| `containerized` | `boolean` | `false` | Wrap the toolbar in a max-width `Container` |
| `maxWidth` | `Breakpoint \| false` | `'lg'` | Container width when `containerized` |
| `sx` | `SxProps<Theme>` | — | — |

Companion `HeaderToolbar` (`children` / `sx`) is the bare toolbar
without the `AppBar` wrapper.

### `UserMenu`

Avatar-trigger account dropdown, designed for the header `rightArea`.

```tsx
import { UserMenu } from '@omnitron-dev/prism/layouts';

<UserMenu
  user={{ name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' }}
  menuItems={[
    { key: 'profile', label: 'Profile', onClick: goToProfile },
    { key: 'logout', label: 'Sign out', destructive: true, onClick: signOut },
  ]}
  showEmail
/>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `user` | `UserMenuUser` (`{ name; email?; avatarUrl?; role? }`) | — (required) |
| `menuItems` | `UserMenuItem[]` | — |
| `header` / `footer` | `ReactNode` | — |
| `avatarSize` | `'small' \| 'medium' \| 'large'` | `'medium'` |
| `showEmail` | `boolean` | — |
| `showRole` | `boolean` | — |
| `sx` / `popoverSx` | `SxProps<Theme>` | — |
| `onOpen` / `onClose` | `() => void` | — |

Each `UserMenuItem` is `{ key, label, icon?, onClick?, destructive?, disabled?, dividerAfter? }`.

## Mixing layouts in one app

Layouts are just route-element wrappers — react-router 7 handles the rest:

```tsx
<Routes>
  {/* Auth flow */}
  <Route element={<GuestGuard><AuthCenteredLayout logo={<Logo />}><Outlet /></AuthCenteredLayout></GuestGuard>}>
    <Route path="/sign-in" element={<SignInForm />} />
    <Route path="/sign-up" element={<SignUpForm />} />
  </Route>

  {/* Authenticated app */}
  <Route element={<AuthGuard><ConsoleShell /></AuthGuard>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/apps" element={<AppsPage />} />
  </Route>

  {/* Error pages */}
  <Route path="*" element={<AuthSimpleLayout logo={<Logo />} compact><NotFound /></AuthSimpleLayout>} />
</Routes>
```

(`ConsoleShell` is the `DashboardLayout` wrapper shown at the top of
this page; it renders `<Outlet />` for the matched child routes.)

## See also

- [Blocks](./blocks.md) — composites that often sit inside layouts
- [Components catalog](./components.md) — components used in custom layouts
- [Theme](./theme.md) — density / spacing tokens
