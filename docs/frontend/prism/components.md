---
sidebar_position: 2
title: Components catalog
description: Per-component reference for the widgets in Prism.
---

# Components catalog

This page is the per-component reference. Each component links
to its subpath import, lists its props (where non-trivial),
shows a representative example, and notes accessibility &
integration concerns.

For full-page composites see [Blocks](./blocks.md); for layouts
see [Layouts](./layouts.md). For scientific documents, block editing and typed knowledge graphs, see [Research workspaces](./research.md).

## Status & feedback

### `<Alert>` / `<FormAlert>`

```tsx
import { Alert, FormAlert } from '@omnitron-dev/prism';

<Alert severity="warning" title="Storage low">
  90% of the bucket quota is in use.
</Alert>

<FormAlert title="Invalid email">
  Please enter a valid email address.
</FormAlert>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Drives icon + colour |
| `title` | `ReactNode` | — | Bold leading line |
| `onClose` | `() => void` | — | Renders dismiss button |
| `variant` | `'standard' \| 'filled' \| 'outlined'` | `'standard'` | Visual weight |
| `icon` | `ReactNode \| false` | (derived) | Override (or `false` to hide) |
| `closable` | `boolean` | `false` | Show the dismiss button |

**`<FormAlert>`** is the canonical surface for **inline** form
errors — toast/snackbar is reserved for transient background
events. It defaults to `severity="error"`; pass the message as
**children** (there is no `error` prop). Pair with
`react-hook-form`:

```tsx
const { formState, register } = useForm();

<form>
  {formState.errors.root && (
    <FormAlert>{formState.errors.root.message}</FormAlert>
  )}
  <input {...register('email')} />
</form>
```

### `<Snackbar>`

Transient global notifications. Mounted once by `<PrismProvider>`;
fire from anywhere:

```tsx
import { useSnackbar } from '@omnitron-dev/prism';

function CopyButton({ text }: { text: string }) {
  const { show } = useSnackbar();
  return (
    <Button onClick={() => {
      navigator.clipboard.writeText(text);
      show({ message: 'Copied', severity: 'success', duration: 2_000 });
    }}>
      Copy
    </Button>
  );
}
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `message` | `string` | — |
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` |
| `duration` | `number` (ms) | — |
| `action` | `ReactNode` | — |
| `position` | `{ vertical, horizontal }` (MUI `SnackbarOrigin`) | — |
| `key` | `string \| number` | — |

`useSnackbar()` also exposes `success` / `error` / `warning` /
`info` / `close` shortcuts. Max-stack is configured at the
provider level (`maxSnackbars`).

### `<ConfirmDialog>`

`<ConfirmDialog>` is a controlled component — thread `open` /
`onClose` / `onConfirm` (there is no `useConfirmDialog` hook):

```tsx
import { ConfirmDialog } from '@omnitron-dev/prism';

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button color="error" onClick={() => setOpen(true)}>Delete</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        title="Delete project?"
        content="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        confirmColor="error"
      />
    </>
  );
}
```

`onConfirm` may be async — pass `loading` to show a spinner
while it resolves. A `<DeleteDialog>` preset is also exported.

### `<Tooltip>`

```tsx
import { Tooltip } from '@omnitron-dev/prism';

<Tooltip title="Restart this app" placement="top">
  <IconButton onClick={restart}>
    <RefreshIcon />
  </IconButton>
</Tooltip>
```

Standard MUI tooltip with Prism theme integration. Wrap a
single child element (not a fragment).

### `<LoadingScreen>`

Full-viewport loading bar — typical use is the Suspense fallback:

```tsx
import { LoadingScreen } from '@omnitron-dev/prism';

<Suspense fallback={<LoadingScreen />}>
  <Outlet />
</Suspense>
```

Pass `portal` to render through a portal, or override the
progress indicator via `slots.progress` / `slotProps.progress`.
`SplashScreen` (branded full-screen) and `Spinner` (inline) are
also exported.

### `<Skeleton>`

Animated placeholder while data loads.

```tsx
import { Skeleton, CardSkeleton, TableSkeleton }
  from '@omnitron-dev/prism';

{isLoading ? <Skeleton variant="rectangular" height={200} /> : <Chart type="line" series={series} />}
```

`<Skeleton>` wraps MUI's Skeleton (`variant`: `text` /
`circular` / `rectangular`). For composite placeholders use the
dedicated `<CardSkeleton>` and `<TableSkeleton>` exports.

### `<EmptyContent>`

Friendly empty-state card. Use on every list that may be empty.

```tsx
import { EmptyContent } from '@omnitron-dev/prism';

{items.length === 0 ? (
  <EmptyContent
    title="No projects yet"
    description="Create your first project to get started."
    action={<Button onClick={onCreate}>Create project</Button>}
    icon={<FolderIcon />}
  />
) : (
  <ItemList items={items} />
)}
```

`illustration` and `icon` both take a `ReactNode` (there are no
built-in named illustrations). `icon` is rendered inside a
circular coloured wrapper; `illustration` is rendered as-is.
`SearchEmptyContent` and `LoadingEmptyContent` are preset
variants.

### `<ErrorBoundary>`

`fallback` receives a single `FallbackProps` object
(`{ error, errorInfo, parsedStack, resetErrorBoundary }`):

```tsx
import { ErrorBoundary } from '@omnitron-dev/prism';

<ErrorBoundary
  fallback={({ error, resetErrorBoundary }) =>
    <ErrorScreen error={error} onReset={resetErrorBoundary} />}
  onError={(error, errorInfo) => reportToSentry(error, errorInfo)}
  resetKeys={[location.pathname]}
>
  <Outlet />
</ErrorBoundary>
```

Catches synchronous render errors. Doesn't catch async / event-
handler errors — those go through global window error handlers.
Omit `fallback` to use the built-in error screen (with dev-mode
stack details).

### `<LinearProgress>` / `<CircularProgress>` / `<ProgressBar>` / `<CountdownRing>`

```tsx
import { LinearProgress, CircularProgress, ProgressBar, CountdownRing }
  from '@omnitron-dev/prism';

<ProgressBar value={75} />                {/* labelled linear bar */}
<LinearProgress />                         {/* indeterminate */}
<CircularProgress value={50} />            {/* determinate ring */}
<CountdownRing deadline={expiresAt} totalMs={30_000} />  {/* timed ring */}
```

Linear and circular variants; determinate and indeterminate
modes. (There is no single `<Progress>` export — pick the
specific component.)

`CountdownRing` counts down to a **deadline** (`Date` or ISO
string), not for a duration: it survives a remount and a
backgrounded tab, both of which a duration timer gets wrong.
`totalMs` is only the denominator for the filled fraction — omit
it and the ring starts full. It switches to `warningColor` below
`warningThresholdMs` and to `expiredColor` past the deadline.

## Data display

### `<Card>`

```tsx
import { Card, StatCard } from '@omnitron-dev/prism';

<Card title="Active users" subheader="last 30 days">
  <Typography variant="h3">1,234</Typography>
</Card>

<Card
  variant="outlined"
  title="Project Alpha"
  headerAction={<IconButton><MoreIcon /></IconButton>}
  actions={<Button>Open</Button>}
>
  <Typography variant="body2">Last updated 2 hours ago</Typography>
</Card>

{/* Pre-composed stat tile: */}
<StatCard label="Revenue" value="$48,200" change={12.5} />
```

`StatCard` takes `label` and `value` (both required), plus
`change` (a percentage, rendered with direction), `icon`,
`color`, `subtitle` and `loading`. It extends
`Omit<CardProps, 'children'>`, so `title` is a valid prop —
inherited from `Card` — but it is the *card header*, not the
stat. A tile given `title` and `total` renders a header with an
empty stat below it, which is why the wrong pair does not look
broken at a glance.

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `variant` | `'elevation' \| 'outlined' \| 'soft'` | `'elevation'` | Visual weight |
| `title` | `ReactNode` | — | Card header title |
| `subheader` | `ReactNode` | — | Card header subtitle |
| `headerAction` | `ReactNode` | — | Top-right header slot |
| `actions` | `ReactNode` | — | Footer actions row |
| `disablePadding` | `boolean` | `false` | Drop content padding |

Card extends MUI's `Card`, so MUI props (`onClick`, `elevation`,
`sx`, …) pass through. `CardSection` and `StatCard` are also
exported. Cards are typically arranged in a `<Grid>` — `<Card>`
itself doesn't handle layout.

### `<Avatar>`

```tsx
import { Avatar, CustomAvatarGroup } from '@omnitron-dev/prism';

<Avatar src={user.avatarUrl} name={user.name} size="md" />
<Avatar name="Alice" online />
<CustomAvatarGroup
  max={3}
  avatars={team.map(u => ({ name: u.name, src: u.avatarUrl }))}
/>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `src` | `string` | — | Image URL; falls back to initials |
| `name` | `string` | — | Used for initials + alt text |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | |
| `online` / `offline` | `boolean` | — | Status indicator dot |
| `badge` | `ReactNode` | — | Corner badge (e.g. count) |
| `badgeColor` | `'primary' \| 'secondary' \| 'success' \| 'warning' \| 'error' \| 'info'` | — | |
| `shape` | `'circular' \| 'rounded' \| 'square'` | `'circular'` | |

The fallback is **deterministic** — same name always produces
the same colour + initials, so users are visually identifiable
even without photos.

### `<Badge>`

`<Badge>` wraps MUI Badge (use `badgeContent` / `variant="dot"`).
For a count overlay, the `<CountBadge>` helper (with `count` /
`max`) is more ergonomic; `<StatusDot>` renders a standalone
status dot:

```tsx
import { Badge, CountBadge, StatusDot }
  from '@omnitron-dev/prism';

<Badge badgeContent={5}>
  <NotificationsIcon />
</Badge>

<Badge variant="dot" color="error">
  <Avatar src={src} />
</Badge>

<CountBadge count={150} max={99}>
  <ShoppingCartIcon />
</CountBadge>

<StatusDot status="online" pulse />
```

`max` caps the display value with a `+` suffix (`99+`);
`variant="dot"` shows a colour dot without a number.

### `<Table>`

The low-level table. For most app tables, prefer
[`<DataGridBlock>`](./blocks.md#datagridblock--filterable--sortable--paginated-table) or
`<AdminDataTable>` (re-exported from `components/admin-filters`)
which add filtering, sorting, pagination, row actions.

`<Table>` is config-driven — pass `columns` + `data` (it is not
a MUI-style composition of `<TableRow>` / `<TableCell>`):

```tsx
import { Table } from '@omnitron-dev/prism';

<Table
  rowKey="id"
  data={users}
  columns={[
    { id: 'name',  label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'karma', label: 'Karma', align: 'right',
      render: (u) => u.karma },
  ]}
/>
```

Columns are `{ id, label, align?, sortable?, render?, format? }`.
The component also supports `selectable`, `sortable`, `paginated`,
and `loading` props (see `TableProps`). Both `Table` and `AdminDataTable` use a
bounded, keyboard-focusable `TableViewport` with a localisable `scrollLabel`.
Pagination remains outside the scroll region and adapts to the container width;
`maxHeight` limits the rows. Sticky header cells use an opaque theme surface.
Rows with `onRowClick` accept Enter and Space when the row itself is focused;
keyboard events from nested controls retain their original behavior.

Use `TableColumn.minWidth` or the table’s `sx` for readable columns.
`AdminDataTable` accepts `minWidth` for the table and `ColumnDef.minWidth` for
individual columns. For a composed MUI table, reuse the same viewport directly:

```tsx
import { TableViewport } from '@omnitron-dev/prism/components/table';
import MuiTable from '@mui/material/Table';

<TableViewport label="Deployment history" maxHeight={480}>
  <MuiTable stickyHeader sx={{ minWidth: 640 }}>{/* table sections */}</MuiTable>
</TableViewport>
```

Keep pagination outside `TableViewport`. It supplies the scroll region, not row
data, sorting or a second pagination implementation.

### `<Chart>`

ApexCharts wrapper with theme-aware defaults.

```tsx
import { Chart, useChart } from '@omnitron-dev/prism/components/chart';

function CpuChart({ series }: { series: TimeSeries[] }) {
  const options = useChart({
    chart:   { type: 'area', stacked: true },
    xaxis:   { type: 'datetime' },
    yaxis:   { labels: { formatter: (v) => `${v}%` } },
    legend:  { position: 'top' },
  });

  return <Chart options={options} series={series} type="area" height={320} />;
}
```

`useChart` merges your overrides into Prism-themed defaults
(colours, gridlines, tooltips, fonts). Always go through it
rather than passing raw ApexCharts options — keeps theming
consistent.

The standalone `components/chart` entry keeps charts out of an application's main
component barrel. The plotting library loads lazily. Numeric heights reserve the
plot's space during loading; the wrapper can shrink inside flex/grid workspaces.
Tooltips and legends inherit the active theme, including custom CSS-variable
prefixes. `prefers-reduced-motion` disables animations even if a caller enables them.

For operational time series, use straight lines, explicit units and local/UTC time
labels. `{ x, y: null }` represents missing samples; do not substitute zero or connect
long gaps. Provide an accessible name (`role="img"`, `aria-label`) and a tabular
alternative when exact values matter. Selection controls should be ordinary
keyboard-operable buttons outside the image. `ChartLegends` wraps long labels.

Supported `type` values: `line`, `area`, `bar`, `pie`, `donut`,
`radialBar`, `scatter`, `bubble`, `heatmap`, `candlestick`,
`boxPlot`, `radar`, `polarArea`, `rangeBar`, `rangeArea`,
`treemap`. (There is no `column` type — use `bar`.)

### `<Carousel>`

Slides are passed as **children** (not a `slides` array prop):

```tsx
import { Carousel } from '@omnitron-dev/prism';

<Carousel autoplay autoplayInterval={5000} dots arrows>
  {images.map((src) => <img key={src} src={src} />)}
</Carousel>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `children` | `ReactNode` (slides) | — |
| `autoplay` | `boolean` | `false` |
| `autoplayInterval` | `number` (ms) | — |
| `pauseOnHover` | `boolean` | — |
| `loop` | `boolean` | — |
| `dots` | `boolean` | — |
| `arrows` | `boolean` | — |
| `slidesToShow` | `number` | `1` |
| `spacing` | `number` (px) | — |
| `responsive` | `CarouselBreakpoint[]` | — |

### `<Lightbox>`

Drive open/index state with `useLightbox`, then spread
`getLightboxProps()` onto `<Lightbox>` (which takes a `slides`
array). There is no `controller` prop:

```tsx
import { Lightbox, useLightbox } from '@omnitron-dev/prism';

function Gallery({ images }: { images: string[] }) {
  const lightbox = useLightbox({ totalSlides: images.length });
  const slides = images.map((src) => ({ src }));
  return (
    <>
      {images.map((src, i) => (
        <img key={src} src={src} onClick={() => lightbox.onOpen(i)} />
      ))}
      <Lightbox slides={slides} {...lightbox.getLightboxProps()} />
    </>
  );
}
```

Keyboard navigation (arrows, Esc), zoom controls, thumbnails,
counter, optional download/share buttons.

### `<Image>`

```tsx
import { Image } from '@omnitron-dev/prism';

<Image
  src={user.avatarUrl}
  alt={user.name}
  ratio="1/1"
  fallbackSrc="/default-avatar.png"
  placeholder
/>
```

Adds: aspect-ratio container via `ratio` (no layout shift),
fallback on error (`fallbackSrc` URL or a `fallback` ReactNode),
lazy-load by default (disable with `disableLazy`), and an
optional loading `placeholder`. (`ratio` is the prop name — not
`aspectRatio`.)

### `<TagCloud>`

```tsx
import { TagCloud } from '@omnitron-dev/prism';

<TagCloud
  tags={[
    { id: '1', name: 'react',      slug: 'react',      postCount: 142 },
    { id: '2', name: 'typescript', slug: 'typescript', postCount: 98 },
    { id: '3', name: 'rpc',        slug: 'rpc',        postCount: 31 },
  ]}
  variant="cloud"
  onTagClick={(tag) => navigate(`/search?q=${tag.slug}`)}
/>
```

Each tag is `{ id, name, slug, postCount, … }`; the cloud sizes
tags proportional to `postCount`. `variant="list"` renders a
ranked list instead. `onTagClick` receives the full tag object.

## Navigation

### `<Breadcrumbs>`

```tsx
import { Breadcrumbs } from '@omnitron-dev/prism';

<Breadcrumbs
  heading="Alpha"
  links={[
    { name: 'Home',     href: '/' },
    { name: 'Projects', href: '/projects' },
    { name: 'Alpha' },               // current page — no href
  ]}
/>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `links` | `BreadcrumbLinkProps[]` (`{ name, href?, icon? }`) | — | The crumb trail |
| `heading` | `string` | — | Page heading above the crumbs |
| `activeLast` | `boolean` | `false` | Keep the last crumb clickable |
| `backHref` | `string` | — | Shows a back arrow before the heading |
| `action` | `ReactNode` | — | Right-side action slot |
| `linkComponent` | `ElementType` | — | Router `Link` for client-side nav |

Pass `linkComponent` (e.g. react-router's `Link`) to keep
breadcrumb links client-side.

### `<Menu>`

Dropdown menu. Pairs with `<IconButton>` or any trigger:

`<Menu>` is config-driven — pass `items` (a `MenuItemDef[]`), and
drive open/anchor state with the `useMenu` hook. There are no
`<MenuItem>` / `<MenuDivider>` child components:

```tsx
import { Menu, useMenu } from '@omnitron-dev/prism';

function UserMenu() {
  const menu = useMenu();
  return (
    <>
      <IconButton onClick={menu.handleOpen}><MoreIcon /></IconButton>
      <Menu
        {...menu.menuProps}
        items={[
          { key: 'profile',  label: 'Profile',  icon: <ProfileIcon />,  onClick: () => navigate('/me') },
          { key: 'settings', label: 'Settings', icon: <SettingsIcon />, onClick: () => navigate('/settings') },
          { type: 'divider', key: 'd1' },
          { key: 'signout',  label: 'Sign out', icon: <LogoutIcon />,   danger: true, onClick: signOut },
        ]}
      />
    </>
  );
}
```

Item shape: `{ key, label, icon?, onClick?, danger?, shortcut?, type? }`.
A `<ContextMenu>` variant is also exported for right-click menus.

### `<MegaMenu>`

Multi-column dropdown for sites with deep navigation. It is
config-driven — pass a `data` array (there is no `<MegaMenuColumn>`
child component). Use `MegaMenu` (auto), or the explicit
`MegaMenuHorizontal` / `MegaMenuVertical` / `MegaMenuMobile`
variants:

```tsx
import { MegaMenu } from '@omnitron-dev/prism';

<MegaMenu
  data={[
    {
      title: 'Products',
      path:  '/products',
      children: [
        { subheader: 'Backend',  items: [
          { title: 'Titan',   path: '/titan' },
          { title: 'Modules', path: '/modules' },
        ]},
        { subheader: 'Frontend', items: [
          { title: 'Prism',        path: '/prism' },
          { title: 'netron-react', path: '/netron-react' },
        ]},
      ],
    },
  ]}
/>
```

### `<NavCard>` / `<NavCardGrid>`

Compact cards for navigation hubs. `<NavCard>` navigates via
`to` + `linkComponent` (not `href`); `icon` is a `ReactNode`.
`<NavCardGrid>` auto-wraps based on `minTileWidth` (not a fixed
`columns` count):

```tsx
import { Link as RouterLink } from 'react-router-dom';

<NavCardGrid minTileWidth={260} gap={3}>
  <NavCard title="Apps"     to="/apps"     linkComponent={RouterLink} icon={<BoxIcon />}  description="Manage applications" />
  <NavCard title="Infra"    to="/infra"    linkComponent={RouterLink} icon={<GridIcon />} description="Containers + services" />
  <NavCard title="Settings" to="/settings" linkComponent={RouterLink} icon={<CogIcon />}  description="Per-user preferences" />
</NavCardGrid>
```

### `<NavSection>`

Sidebar navigation builder. The `<DashboardLayout>` uses this
internally; you can use it standalone:

Driven by a `data` prop — an array of sections, each with an
optional `subheader` and an `items` array (active state is
derived from the router automatically):

```tsx
<NavSection
  data={[
    {
      subheader: 'Main',
      items: [
        { title: 'Dashboard', path: '/', icon: 'home' },
        {
          title: 'Settings',
          path:  '/settings',
          icon:  'cog',
          children: [
            { title: 'Profile',  path: '/settings/profile' },
            { title: 'Security', path: '/settings/security' },
          ],
        },
      ],
    },
  ]}
/>
```

`NavSectionVertical` / `NavSectionHorizontal` / `NavSectionMini`
are the explicit layout variants.

### `<NavigationProgress>`

Top-of-page loading bar — shows during route transitions. Feed
it the current `pathname` (and optionally `search`) from the
router; it completes when those change:

```tsx
import { NavigationProgress } from '@omnitron-dev/prism';
import { useLocation } from 'react-router-dom';

const { pathname, search } = useLocation();

<NavigationProgress pathname={pathname} search={search} />
```

`delay` (default 100ms) avoids flashing on fast transitions.

### `<Stepper>`

`<Stepper>` is config-driven — pass a `steps` array (there is no
separate `<Step>` component):

```tsx
import { Stepper } from '@omnitron-dev/prism';

const [activeStep, setActiveStep] = useState(0);

<Stepper
  activeStep={activeStep}
  steps={[
    { label: 'Account', description: 'Email + password' },
    { label: 'Profile', description: 'Name + avatar' },
    { label: 'Plan',    description: 'Choose a tier' },
    { label: 'Confirm', description: 'Review & finish', optional: true },
  ]}
/>
```

Horizontal by default; pass `orientation="vertical"` for a side
stepper. `StepperActions` + `useStepper` cover next/back/reset
wiring.

### `<Tabs>` / `<TabPanel>`

There is no separate `<Tab>` component. Either pass a `tabs`
array of `{ value, label, content }`, or compose `<TabPanel>`
children — `<Tabs>` builds the tab strip from each panel's
`value` / `label` and renders the active one. `onChange`
receives the new value directly.

```tsx
import { Tabs, TabPanel } from '@omnitron-dev/prism';

// Config-driven:
<Tabs
  defaultValue="overview"
  onChange={(value) => console.log(value)}
  tabs={[
    { value: 'overview', label: 'Overview', content: <Overview /> },
    { value: 'logs',     label: 'Logs',     content: <Logs /> },
    { value: 'metrics',  label: 'Metrics',  content: <Metrics /> },
  ]}
/>

// Or with <TabPanel> children:
<Tabs defaultValue="overview">
  <TabPanel value="overview" label="Overview"><Overview /></TabPanel>
  <TabPanel value="logs"     label="Logs"><Logs /></TabPanel>
  <TabPanel value="metrics"  label="Metrics"><Metrics /></TabPanel>
</Tabs>
```

The `useTabs` hook manages active-value state for you when you
need it outside the component.

For individually closable tabs, set `closable: true` on each item and supply
`onClose(value)`. The close icon is part of that tab, and **Delete** requests
closure when the tab has focus. Clicking close does not select an inactive tab.
`closeDisabled` suspends closure while leaving selection available;
`closeLabel` supplies a localized accessible name. The same options work on
`TabPanel` children. Closure is a request: the caller owns confirmation and
removal, plus selection in controlled mode. Focus moves to the next available
tab after removal, or the preceding tab when closing the last one. When all tabs
are removed, the caller should focus its creation control or another logical
next action. Default tabs remain non-closable.

```tsx
import { Tabs } from '@omnitron-dev/prism/components/tabs';

<Tabs
  value={activeId}
  onChange={setActiveId}
  onClose={setPendingCloseId}
  tabs={sessions.map(session => ({
    value: session.id,
    label: session.label,
    closable: true,
    closeDisabled: saving,
    closeLabel: `Close ${session.label}`,
  }))}
  variant="scrollable"
  aria-label="Sessions"
/>
```

### `<ScrollSpy>` / `<ScrollSpyProvider>`

Wrap content in `<ScrollSpyProvider>`, mark each tracked region
with `<ScrollSpySection id="…">`, and read the in-view section
from the `useScrollSpy()` hook (`activeId`) to drive your own
nav. There is no all-in-one `<ScrollSpy items={…}>` nav widget:

```tsx
import { ScrollSpyProvider, ScrollSpySection, useScrollSpy }
  from '@omnitron-dev/prism';

function Toc() {
  const { activeId } = useScrollSpy();
  return (
    <aside>
      {['intro', 'setup', 'api'].map((id) => (
        <a key={id} href={`#${id}`} aria-current={activeId === id}>{id}</a>
      ))}
    </aside>
  );
}

<ScrollSpyProvider>
  <article>
    <ScrollSpySection id="intro">…</ScrollSpySection>
    <ScrollSpySection id="setup">…</ScrollSpySection>
    <ScrollSpySection id="api">…</ScrollSpySection>
  </article>
  <Toc />
</ScrollSpyProvider>
```

Tracks which section is in view via `activeId`. Used by docs
pages.

### `<ScrollToTop>`

Scrolls the window back to the top whenever the route changes —
pass the current `pathname` from the router:

```tsx
import { ScrollToTop } from '@omnitron-dev/prism';
import { useLocation } from 'react-router-dom';

<ScrollToTop pathname={useLocation().pathname} />
```

(This resets scroll on navigation — it is not a floating
"scroll to top" button. For that, see the `useBackToTop` hook.)

### `<Scrollbar>`

```tsx
import { Scrollbar } from '@omnitron-dev/prism';

<Scrollbar sx={{ maxHeight: 400 }}>
  <LongContent />
</Scrollbar>
```

Cross-browser styling of native scrolling. On a fine pointer, the thumb is
transparent while idle and appears on container hover or keyboard focus inside.
Visibility does not change the scrollport's size. Touch input and forced-colors
mode keep native controls discoverable.

`autoHide` defaults to `true`; set `autoHide={false}` for a persistent thumb.
`hideScrollbar` still explicitly hides the bar while preserving scrolling.
The shared CSS baseline gives nested overflow regions the same behaviour.

## Input & form

### `Field` (namespace: `Field.Text`, `Field.Select`, …) {#field}

`Field` is a **namespace** of react-hook-form-integrated inputs —
you use `<Field.Text>`, `<Field.Select>`, `<Field.Number>`, etc.,
not a single polymorphic `<Field>` element. Each field reads from
the surrounding react-hook-form `FormProvider` by `name`:

```tsx
import { Field } from '@omnitron-dev/prism';
import { useForm, FormProvider } from 'react-hook-form';

const methods = useForm();

<FormProvider {...methods}>
  <Field.Text   name="email"    label="Email"    type="email" />
  <Field.Text   name="password" label="Password" type="password" />
  <Field.Text   name="bio"      label="Bio"      multiline rows={4} />
  <Field.Select name="role"     label="Role" options={[
    { value: 'viewer', label: 'Viewer' },
    { value: 'admin',  label: 'Admin' },
  ]} />
</FormProvider>
```

Available members include `Field.Text`, `Field.Select`,
`Field.Checkbox`, `Field.Switch`, `Field.Number`, `Field.Radio`,
`Field.Autocomplete`, `Field.MultiSelect`, `Field.Rating`,
`Field.Slider`, `Field.DatePicker`, `Field.TimePicker`,
`Field.DateTimePicker`, `Field.Code`, `Field.Upload`,
`Field.Phone`, `Field.CountrySelect`, `Field.Editor`, and more.

Each text field extends MUI's `TextField` props plus:

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `name` | `string` | Maps to the react-hook-form field (required) |
| `rules` | `RegisterOptions` | Per-field react-hook-form validation rules |
| `label` / `multiline` / `rows` / `type` / `placeholder` / `helperText` | — | Inherited from MUI `TextField` |

When you wrap the form in [`<SchemaProvider>`](./forms.md), Zod
schema messages flow into the fields (i18n-aware); `rules`
overrides per field.

### `<Label>`

A small status/category chip (not an HTML form `<label>`). Use
`color` + `variant` for status pills; `StatusLabel` and
`BooleanLabel` are presets:

```tsx
import { Label, StatusLabel, BooleanLabel }
  from '@omnitron-dev/prism';

<Label color="success" variant="soft">Active</Label>
<Label color="warning" startIcon={<ClockIcon />}>Pending</Label>
<BooleanLabel value={isEnabled} />
```

The isolated entry is `@omnitron-dev/prism/components/label`. Variants are
`soft` (default), `filled`, `outlined` and `inverted`. Soft labels choose a
contrasting palette tone for each color scheme, including Prism presets with
inverted dark-mode tonal roles. Colors remain bound to the theme's CSS variables
and custom prefix. When brand colors can only be resolved by the browser, the
foreground falls back to the theme's primary text color. Keep a written state
alongside color and use legible text sizes inside scaled visualizations.

### `<SearchInput>`

Debounced search input with a clear button:

```tsx
import { SearchInput } from '@omnitron-dev/prism/components/search-input';

<SearchInput
  value={query}
  onChange={(v) => setQuery(v)}
  debounce={300}
  placeholder="Search projects…"
  aria-label="Search projects"
/>
```

When `debounce > 0`, `onChange` fires that many ms after the
user stops typing (it receives the raw string) — saves you
wiring `useDebouncedValue` per call site. A clear button is
built in. `aria-label` names the input independently of its placeholder;
`clearTooltip` names the clear button.

### `<DateRangePicker>`

`<DateRangePicker>` is a dialog driven by the
`useDateRangePicker` hook — spread the hook's return onto it
(dates are Day.js values):

```tsx
import { DateRangePicker, useDateRangePicker }
  from '@omnitron-dev/prism';

function Filter() {
  const range = useDateRangePicker();
  return (
    <>
      <Button onClick={range.onOpen}>{range.label || 'Pick dates'}</Button>
      <DateRangePicker {...range} variant="calendar" />
    </>
  );
}
```

`variant` is `'input'` (default) or `'calendar'`; pass
`translations` to localise the dialog. A `<DateRangeInput>` (the
two-field inline form) is also exported.

### `<DurationPicker>`

For "how long" inputs (TTLs, timeouts). The value is a duration
**in seconds** (`null` = permanent/indefinite):

```tsx
<DurationPicker
  value={seconds}
  onChange={(seconds) => setDuration(seconds)}
/>
```

`onChange` receives a `number | null` (seconds). Pass `labels`
to localise the unit strings.

### `<CountrySelect>`

ISO 3166 country dropdown with flags + search. It is
**asset-free** — the consumer supplies the `options` list (and
optionally a `getFlagSrc` resolver); Prism bundles no country
data:

```tsx
<CountrySelect
  value={country}                    // lowercase iso2, or null
  onChange={setCountry}              // receives lowercase iso2 | null
  options={countries}               // ReadonlyArray<CountryOption>
  getFlagSrc={(iso2) => `/flags/${iso2}.svg`}
/>
```

Value / change are the lowercase ISO 3166-1 alpha-2 code.

### `<Editor>` + `<TipTapRenderer>`

TipTap-based rich-text editor and read-only renderer. The
`toolbar` prop takes a **preset** (`'full' | 'standard' |
'compact' | 'minimal' | 'chat' | 'inline'`) or an explicit
`{ items: [...] }` config — not a bare array:

```tsx
import { Editor } from '@omnitron-dev/prism/components/editor';
import { TipTapRenderer } from '@omnitron-dev/prism';

// Edit mode (onChange receives a string — JSON by default, or HTML
// when format="html"):
<Editor
  value={content}
  onChange={setContent}
  format="json"
  toolbar={{ items: ['bold', 'italic', 'link', 'heading', 'bulletList', 'code'] }}
/>

// Read mode (e.g., displaying a saved post):
<TipTapRenderer content={post.content} />
```

Changes are delivered synchronously on the editor transaction; debounce expensive persistence or previews in the host, not the authoritative draft.

Storage format is TipTap's JSON document — portable across
edit/view, indexable for full-text search, safer than raw HTML.
(The renderer export is `TipTapRenderer` — note the capital T.)

### `<ContentRenderer>`

Renders mixed content (TipTap JSON, markdown string, or HTML
string) with consistent typography — it auto-detects the format
from the content shape:

```tsx
<ContentRenderer content={post.body} />
```

Props: `content`, `compact`, `className`, `sx`,
`markdownComponents`, and `routerLinkComponent` (pass a
router-aware `Link` to keep internal links client-side).

### `<CommandPalette>`

`Cmd+K` style command palette. It self-manages open state via
`triggerKey` (default `'k'` + the platform meta key) — just pass
`actions`:

```tsx
import { CommandPalette }
  from '@omnitron-dev/prism';

function App() {
  return (
    <>
      <Outlet />
      <CommandPalette
        actions={[
          { id: 'new-project', title: 'New project', icon: <PlusIcon />,   onSelect: () => navigate('/projects/new') },
          { id: 'sign-out',    title: 'Sign out',    icon: <LogoutIcon />, onSelect: signOut },
        ]}
      />
    </>
  );
}
```

Each action is `{ id, title, subtitle?, group?, keywords?, icon?,
shortcut?, onSelect }`. Fuzzy-matches by title + keywords; arrow
keys + Enter; Esc closes. Pass `open` / `onOpenChange` for
controlled mode.

### `<FilterToolbar>`

Filter toolbar above admin tables — `search`, `select`,
`multi-select`, `date-range`, `boolean`, `number-range` filter
types. State is centralised: declare `filters` (a
`FilterConfig[]`), hold a single `values` object, and update via
one `onChange`:

```tsx
import { FilterToolbar } from '@omnitron-dev/prism';

const [values, setValues] = useState({});

<FilterToolbar
  filters={[
    { key: 'status', type: 'multi-select', label: 'Status',
      options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] },
    { key: 'tier', type: 'multi-select', label: 'Tier',
      options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { key: 'q', type: 'search', label: 'Search' },
  ]}
  values={values}
  onChange={setValues}
  onReset={() => setValues({})}
  total={results.length}
/>
```

Each filter is `{ key, type, label, options?, … }`. The module
also exports `AdminDataTable`, `StatusChip`, and `AmountCell` for
admin table surfaces. (There is no `<AdminFilters>` export and no
built-in save-as-view.) Controls wrap within their available width. A `search`
filter grows to use spare space; select and range controls shrink before they
can overflow. Use one debounced search field per toolbar.

Date ranges store `<key>From` and `<key>To`; numeric ranges store `<key>Min` and
`<key>Max`. Updating a date range emits both ends in one `onChange`, preserving
other filter values. A partial range, including numeric zero, counts as active
and can be reset. `onReset` lets the host restore its own defaults.

## Layout & utility

### `<Drawer>`

Side panel — left, right, top, bottom:

```tsx
import { Drawer } from '@omnitron-dev/prism';

const [open, setOpen] = useState(false);

<Drawer
  open={open}
  onClose={() => setOpen(false)}
  anchor="right"
  width={480}           // px or any CSS width (for left/right anchors)
  title="Edit user"
  footer={<><Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={save}>Save</Button></>}
>
  <UserForm user={user} />
</Drawer>
```

Use `width` for left/right anchors and `height` for top/bottom
(there is no preset `size` prop). Variants via the `variant` prop:
- `temporary` (default) — overlays, closes on backdrop click
- `persistent` — pushes content
- `permanent` — always visible

### `<PageContent>`

A vertical-stack content wrapper (consistent section `gap`,
optional `fill`). It does **not** render a title/breadcrumb
header — compose `<Breadcrumbs>` + a heading above it, or use a
layout. For breadcrumbs use the standalone `<Breadcrumbs>`
component (above):

```tsx
<PageContent gap={3}>
  <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Projects' }]} />
  <ProjectsList />
</PageContent>
```

### `<DocLayout>`

For documentation pages — collapsible sidebar + main +
on-this-page nav. The right-rail "table of contents" is
`<DocSectionNav>` (passed via the `sectionNav` prop); there is no
`<TableOfContents>` component:

```tsx
import { DocLayout, DocSidebar, DocSectionNav }
  from '@omnitron-dev/prism';

<DocLayout
  sidebar={<DocSidebar items={navItems} />}
  sectionNav={<DocSectionNav headings={headings} />}
>
  <article>{content}</article>
</DocLayout>
```

### `<Accordion>`

`<Accordion>` is config-driven — pass an `items` array (there is
no `<Accordion.Item>` child). Single-open by default; pass
`multiple` to allow several panels open:

```tsx
import { Accordion } from '@omnitron-dev/prism';

<Accordion
  multiple
  items={[
    { id: 'overview',     title: 'Overview',     content: 'What it does.' },
    { id: 'installation', title: 'Installation', content: 'How to install.' },
  ]}
/>
```

Item shape: `{ id, title, subtitle?, content, icon?, disabled? }`.
A `<SimpleAccordion>` convenience wrapper is also exported.

### `<AnimateBorder>` / `<MotionLazy>`

The `animate` module exports `AnimateBorder` — a `Box` with an
animated gradient border — and `MotionLazy`, a provider that
lazy-loads framer-motion features (there is no generic
`<Animate type="fade-up">` entrance wrapper):

```tsx
import { AnimateBorder, MotionLazy }
  from '@omnitron-dev/prism';

// Animated gradient border around any content:
<AnimateBorder duration={8}>
  <Card>…</Card>
</AnimateBorder>

// Lazy-load framer-motion once near the app root:
<MotionLazy>
  <App />
</MotionLazy>
```

### `<SvgColor>`

Inlines an SVG and applies a colour via CSS mask (uses
`currentColor` by default — pass any CSS colour, e.g. a theme
token via `sx`):

```tsx
<SvgColor src="/icons/star.svg" sx={{ color: 'primary.main' }} size={20} />
```

Lets you tint icons without exporting per-colour copies.

### Settings drawer — `<SettingsProvider>` / `<SettingsDrawer>`

In-app settings drawer (theme mode, layout, colour preset).
Wrap the app in `<SettingsProvider>`, mount `<SettingsDrawer>`
once, and open it via the `useSettingsDrawer` hook — there is no
single `<Settings>` component with `open`/`onClose` props:

```tsx
import { SettingsProvider, SettingsDrawer, useSettingsDrawer }
  from '@omnitron-dev/prism';

function Header() {
  const drawer = useSettingsDrawer();
  return <IconButton onClick={drawer.onOpen}><SettingsIcon /></IconButton>;
}

<SettingsProvider>
  <App />
  <SettingsDrawer />
</SettingsProvider>
```

State is backed by the Prism settings store (`useSettingsStore`
from `@omnitron-dev/prism/state`) — persisted to localStorage.

### Changelog — `<ChangelogTimeline>` / `<ChangelogEntry>`

Renders a feed of changes (there is no single `<Changelog>`
component — compose a `<ChangelogTimeline>` of
`<ChangelogEntry>` children):

```tsx
import { ChangelogTimeline, ChangelogEntry }
  from '@omnitron-dev/prism';

<ChangelogTimeline>
  <ChangelogEntry version="1.4.0" date="2026-05-16">
    New dashboard — added project overview.
  </ChangelogEntry>
  <ChangelogEntry version="1.3.1" date="2026-05-10">
    Fixed logs — resolved tail buffering.
  </ChangelogEntry>
</ChangelogTimeline>
```

## Accessibility — across the catalog

Every interactive component:

- **Focus management** — `useFocusTrap` in modals/drawers,
  `useReturnFocus` on close.
- **Keyboard navigation** — full-featured for menus, tabs,
  steppers, command palette, lightbox.
- **ARIA roles** — correct `role` / `aria-*` attributes.
- **Screen-reader text** — `<VisuallyHidden>` for icon-only
  buttons and stateful indicators.
- **Reduced motion** — animations respect `prefers-reduced-motion`.

Buttons / inputs / selects inherit MUI v9's accessibility
foundation, which is WCAG 2.1 AA-compliant out of the box.

## Refs (React 19)

Every prism component exposes its underlying DOM element through
the standard `ref` prop. React 19 routes `ref` through props
directly — there is **no `forwardRef` wrapper** to layer through,
and consumer call sites do not need `React.forwardRef` either.

```tsx
import { useRef, useEffect } from 'react';
import { Card } from '@omnitron-dev/prism';

function ScrollIntoViewExample() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return <Card ref={cardRef}>…</Card>;
}
```

Components that expose an imperative handle attach the handle
type via a `ref?: Ref<HandleType>` field on their props interface
— identical call-site ergonomics, no `useImperativeHandle`
ceremony on the consumer side.

## MUI v9 slot props

For slot-bearing components (`<TextField>`, `<Select>`,
`<Autocomplete>`, …) prism re-exports MUI v9's `slotProps` API.
The legacy `InputProps={…}` / `InputLabelProps={…}` / `MenuProps={…}`
forms still work for backwards compatibility but emit a deprecation
warning in MUI v9 dev mode — migrate to `slotProps={{ input: { … } }}`
etc. as you touch each consumer.

```tsx
// ❌ Legacy (deprecated in MUI v9)
<TextField
  InputProps={{ endAdornment: <PasswordToggle /> }}
  FormHelperTextProps={{ sx: { ml: 0 } }}
/>

// ✅ MUI v9 idiom
<TextField
  slotProps={{
    input: { endAdornment: <PasswordToggle /> },
    formHelperText: { sx: { ml: 0 } },
  }}
/>
```

The same migration applies to Tabs (`TabIndicatorProps` →
`slotProps.indicator`), Modal/Drawer/Popover
(`BackdropProps` → `slotProps.backdrop`), and Autocomplete
(`componentsProps` → `slotProps`).

## Per-component subpaths

Each component is also importable from its own subpath:

```tsx
// Convenience (bigger bundle):
import { Card, Table, Drawer } from '@omnitron-dev/prism';

// Tree-shaken (smaller bundle):
import { Card }   from '@omnitron-dev/prism';
import { Table }  from '@omnitron-dev/prism';
import { Drawer } from '@omnitron-dev/prism';
```

Use subpaths in production for the leanest payload.

## See also

- [Blocks](./blocks.md) — full-page composites built from components
- [Layouts](./layouts.md) — shell components
- [Forms](./forms.md) — `<Field>` + schema-driven forms
- [Hooks catalog](./hooks-catalog.md) — 25+ React hooks
- [Theme](./theme.md) — colours, typography, dark mode


## Also exported

These are exported from `@omnitron-dev/prism/components` and had no entry
here. Listed with their real signatures rather than invented examples — what
was missing is that they exist.

### Lists and layout

| Component | Signature | What it is |
| --------- | --------- | ---------- |
| `VirtualList<T>` | `{ items, getKey, children, estimateSize?, overscan?, maxHeight? }` | Windowed list over `@tanstack/react-virtual`. Measures rows as they mount, so **variable heights work** and a row may expand without breaking the scroll. `getKey` must be stable — it is what survives a reorder. Set `maxHeight` when the parent is not height-bounded, e.g. inside a Dialog |
| `CardGrid` | `{ children, columns = 2, gap, sx }` | Wraps each direct child in a grid cell |
| `ContentRoot` | styled `div` | The typographic container the content renderer paints into |
| `DocSidebar` | `{ items, activeId, onItemClick, title }` | Sidebar for a documentation-style layout |

### Content

| Component | Signature | What it is |
| --------- | --------- | ---------- |
| `Markdown` | `{ children, className, … }` | Markdown renderer used by the content pages |
| `Emoji` | `{ native, set = 'twitter', size, alt }` | One emoji from a set, without loading the picker's dataset |
| `FlagIcon` | `{ code, … }` | Country flag, as used by `Field.CountrySelect` |
| `ImageWithDefault` | `(props: ImageProps)` | `<Image>` that falls back to an icon when the source fails |

### Feedback and overlays

| Component | Signature | What it is |
| --------- | --------- | ---------- |
| `InlineAlert` | `{ severity = 'info', message, icon }` | Alert inside the flow rather than at the page edge. For form errors see the policy in [Forms](./forms.md) |
| `SimpleSnackbar` | `{ … }` | Snackbar without the provider — for a surface that has no `<PrismProvider>` above it |
| `CustomPopover` | `{ … }` | The popover `usePopover()` is built for |
| `CustomAvatarGroup` | `{ avatars, size = 'sm', max = 4, sx }` | Overlapping avatars with an overflow count |

### Charts

| Component | Signature | What it is |
| --------- | --------- | ---------- |
| `ChartLegends` | `{ … }` | Legend rows, usable apart from a chart |
| `ChartLoading` | `{ sx, className, type }` | Chart-shaped skeleton |

### Navigation internals

`NavSection`, `NavSectionVertical`, `NavSectionHorizontal` and `NavSectionMini`
are the navigation API and are documented above. The parts they are assembled
from — `Nav`, `NavList`, `NavSubList`, `NavItem`, `NavItemBase`, `NavUl`,
`NavLi`, `NavIcon`, `NavTexts`, `NavInfo`, `NavArrow`, `NavSubheader` — are
exported so a project can build a navigation shape the four presets do not
cover. Reach for them only then; the presets carry the accessibility
behaviour.

### Elsewhere

`Map`, `MapMarker`, `MapPointPicker` and `MapCoverageLayer` have their own
page: [Maps](./maps.md). The `Field.*` inputs are in [Forms](./forms.md).

## Research documents

`@omnitron-dev/prism/components/research` adds a source-preserving Markdown → typed document → React path. Import `@omnitron-dev/prism/components/research/styles.css` once. It supports GFM, stable Unicode heading anchors, admonitions, tabs, KaTeX and strict Mermaid diagrams. `parseResearchMarkdown(source, documentId)` returns the document tree, heading outline and diagnostics; node attributes retain source positions.

```tsx
import { ResearchDocument, defineResearchWidget } from '@omnitron-dev/prism/components/research';
import '@omnitron-dev/prism/components/research/styles.css';
import { z } from 'zod';

const props = z.object({ value: z.number().finite() }).strict();
const widgets = {
  quantity: defineResearchWidget(1, input => props.parse(input),
    ({ value }) => <output aria-label="Quantity">{value}</output>),
};
<ResearchDocument source={markdown} documentId="paper-overview" widgets={widgets} contents />;
```

Use `$...$` / `$$...$$` for math, a `mermaid` fence for diagrams, and a `prism` fence containing `{"type":"quantity","version":1,"props":{"value":3}}` for a registered widget. `:::note`, `:::warning`, and `:::tabs` with nested `:::tab{label="..."}` use directive syntax. Custom widgets are ordinary host-owned React components with explicit versioned prop validation. The source cannot import JavaScript, register components or grant access. Registries belong to each document, not to process-wide state. `TipTapRenderer` also exposes `nodeRenderers` and `inheritRegisteredNodes`; existing global registrations remain supported by default, while `ResearchDocument` disables inheritance.

Raw HTML and unsupported constructs remain inert with source diagnostics. Unsupported diagram engines retain their source; Pintora is not interpreted as Mermaid. TeX runs with trust disabled and expansion/size limits. Mermaid source cannot change renderer configuration; rendered SVG is sanitized and displayed as an isolated SVG image, preserving the layout styles without inserting document-controlled CSS into the page. Active elements and links are removed; the browser image boundary disables scripting and external resources. Theme changes are serialized. Source/AST/block/edge limits bound accepted input, **not execution time**: Mermaid runs on the browser main thread. Host-owned widgets must independently obey the host's accessibility, resource, network and permission policies. This renderer provides presentation, not proof checking or Noesis semantics. The host owns immutable revision identity, digest verification, authorization and publication. Unknown or failing blocks preserve source rather than masquerading as successful verification.

### `<ResearchEditor>`

A block-oriented scientific editor using Tiptap/ProseMirror and the same
Markdown, math, diagram and widget contract as `ResearchDocument`.

```tsx
import { useRef, useState } from 'react';
import {
  ResearchEditor, type ResearchEditorHandle,
} from '@omnitron-dev/prism/components/research-editor';
import '@omnitron-dev/prism/components/research-editor/styles.css';

function PaperEditor({ edition, source, save }) {
  const editor = useRef<ResearchEditorHandle>(null);
  const [dirty, setDirty] = useState(false);
  return <>
    <ResearchEditor key={edition} ref={editor} initialSource={source}
      maxSourceLength={20000}
      onChange={snapshot => setDirty(snapshot.getSource() !== source)} />
    <button disabled={!dirty} onClick={() => save(editor.current!.getSnapshot().getSource())}>
      Save edition
    </button>
  </>;
}
```

`initialSource` is intentionally initial, not a controlled string on every
keystroke. Replace the React `key` when loading another edition or explicitly
reconciling a conflict. `onChange` receives a synchronous immutable
`ResearchSnapshot` (`format`, `blocks`, `getSource()`); a save operation does not
wait for a debounced update. Persist the returned Markdown, not internal
ProseMirror JSON. The host owns revisions, authorization, save requests,
conflicts and collaboration.

| Prop | Purpose |
| ---- | ------- |
| `initialSource` | Initial Markdown. Original source is retained for unchanged blocks. |
| `onChange` | Transaction snapshot; retain the latest snapshot in a ref to avoid rerendering the whole application. |
| `ref` | `getSnapshot()` and `focus()`. |
| `readOnly` | Locks both controls and the editable surface. |
| `maxSourceLength` | Source length limit in UTF-16 code units, bounded by the research parser's global limit. |
| `labels`, `previewLabels` | Editor controls and shared scientific preview labels. |
| `widgets` | Explicit, scoped `ResearchWidgets` registry. |
| `insertions` | Additional `{ id, label, source, keywords? }` block recipes supplied by the host. |
| `blockControls` | Show one contextual block gutter (default `true`). Keyboard commands remain available when hidden. |
| `className`, `sx` | Theme-compatible presentation customization. |

Type `/` in an empty paragraph to open the insertion palette. Headings, lists,
task lists, code, inline equations and plain GFM tables have editable structure.
Block equations, diagrams, registered widgets and unsupported syntax preserve
source as atomic blocks with a scientific preview and a source dialog. The
contextual gutter offers insertion and a block menu at the hovered or selected
block. Drag the grip to reorder; use the menu on touch devices. Ctrl/Command +
Alt + Up/Down moves the current block without a pointer. All three paths share
identity-based ProseMirror transactions, reject stale identities, and preserve
the cursor inside a moved paragraph. Each discrete block operation is an
independent undo step, separated from adjacent typing. `blockMenu` and `dragBlock`
labels are localizable. Only one gutter is mounted for the document; scientific
content is not copied into a second editable DOM tree. Whole-document and
block-source edits are explicit operations. Switching to `readOnly` closes open
editing dialogs and locks transaction commands. Unsupported table spans and
over-budget operations are rejected,
not silently flattened or truncated.

Untouched blocks preserve original line endings and syntax. Edited supported
blocks are serialized with Markdown escaping. This is **not** a claim of exact
byte preservation after every edit: HTML clipboard transfer can canonicalize
ordinary Markdown. Formula atoms, opaque scientific source and supported
formatting are retained. Reference-style links, aligned tables and unknown
constructs remain source blocks rather than being destructively approximated.
Session block IDs are not stable publication or citation IDs; keep immutable
edition identity and source locators in the application's model.

Scientific previews are activated near the viewport. React does not rerender
the parent document for each transaction; unchanged block serialization is
cached by immutable ProseMirror node. Serialization and structural validation
still have costs proportional to the document, and React node views have a
cost. Measure browser input latency separately from parsing or serialization;
no constant-time editing or arbitrary document-size guarantee is made.

### `<KnowledgeGraph>`

A configurable React Flow surface for typed knowledge relations. The data
model is independent of React Flow node coordinates. A relation is a first-class
node with ordered, named input and output occurrences; it is not flattened into
unrelated pairwise edges.

```tsx
import { KnowledgeGraph } from '@omnitron-dev/prism/components/knowledge-graph';
import '@omnitron-dev/prism/components/knowledge-graph/styles.css';

const knowledge = {
  entities: [
    { id: 'premise-a', kind: 'assumption', label: 'A' },
    { id: 'premise-b', kind: 'assumption', label: 'B' },
    { id: 'claim', kind: 'claim', label: 'C' },
  ],
  relations: [{
    id: 'derivation', kind: 'candidate derivation', label: 'Joint premises',
    inputs: [{ entity: 'premise-a', role: 'first' }, { entity: 'premise-b', role: 'second' }],
    outputs: [{ entity: 'claim', role: 'conclusion' }],
  }],
};
<KnowledgeGraph data={knowledge} visibleBudget={300}
  onSelect={selection => inspect(selection)}
  renderDetails={selection => <ObjectDetails selection={selection} />} />;
```

The component does not certify the relation. The host determines whether it
represents citation, hypothesis, derivation or another relation. Repeated
participants in different roles are preserved, and cycles are allowed. Input
validation rejects duplicate identities and dangling references. Entity and
relation IDs have independent namespaces.

| Prop | Purpose |
| ---- | ------- |
| `data` | `KnowledgeGraphData` with entities and relations. |
| `visibleBudget` | Maximum visible entity + relation nodes; default 300. |
| `labels` | Localized controls, instructions and diagnostics. |
| `onSelect` | Entity or relation selection, including clearing. |
| `layout` | Host-supplied coordinates for a `KnowledgeProjection`. |
| `onLayoutChange` | Visual coordinates after a drag; not a semantic graph mutation. |
| `renderDetails` | Host inspector for the selected object. |
| `height` | Map height, default 560px. |
| `edgeLabelGap` | Minimum canvas-space gap between measured role labels and nodes; default 8. |
| `edgeLabelMaxWidth` | Maximum label width before wrapping, in canvas units; default 240. |
| `className`, `sx` | Styling and theme integration. |

The searchable index and map share selection. The expand control opens an accessible full-screen workspace while retaining selection and layout; Escape closes it. Keyboard-accessible index
controls and a list view provide alternatives to spatial navigation. A bounded
neighbourhood admits a relation only together with all its endpoints. The UI
reports omitted relations explicitly. A large graph starts with an index from
which the user chooses a neighbourhood; an absent edge on that view does not
mean an absent relationship. Pass only authorized data: this presentation
budget is not access control, a storage limit or a substitute for server-side
pagination. The default grid is a deterministic starting layout, not a causal
ordering. Use `entityNodeId` and `relationNodeId` when supplying coordinates.

Role labels share one measured placement layer. Every ordered occurrence keeps
its full text and identity, including repeated participants. Prism measures the
rendered label box, wraps long roles, and places boxes clear of other labels and
nodes. Shifted labels have a dotted leader to their own path midpoint. The
placement is deterministic for the measured geometry; it does not assert a
globally minimal layout or encode semantic priority through position.

The component recomputes placement when paths, text, fonts or node dimensions
change. Pan and zoom transform the same world geometry. The fit control includes
labels outside the node bounds; subsequent edits preserve the user's viewport.
All admitted edges remain mounted so viewport culling cannot silently discard
roles or change their placement. `visibleBudget` still limits the admitted
incidence projection. Select a line to inspect its relation and its complete
ordered port list; the searchable index remains a keyboard alternative.

### Engine choices and scope

The scientific editor extends the existing Tiptap/ProseMirror stack, avoiding
a second incompatible document model. BlockNote provides a ready-made block
experience on ProseMirror; Lexical provides another editor state and plugin
system; Slate/Plate, Milkdown, Editor.js and Quill offer different integration
contracts. None is automatically faster for this workload. The selected path
keeps Prism's host-owned MUI design, Markdown preservation and scientific
rendering under one contract. Tiptap's
[performance guidance](https://tiptap.dev/docs/guides/performance) informed
transaction subscriptions and isolated React rendering.

React Flow is used for inspectable interactive relation diagrams. Its
[performance guidance](https://reactflow.dev/learn/advanced-use/performance)
informs stable node components, memoized projections and bounded views.
Canvas or WebGL renderers such as Cytoscape or Sigma remain possible host-level
choices for aggregate overviews after measuring actual scale. The current
component is not an unrestricted million-node canvas or a semantic reasoning
engine. Both components support application-owned labels, data, policies and
extension registries; neither requires a particular domain backend.

The Prism research editor is an independently implemented interface on the open
Tiptap/ProseMirror core. It does not include the paid Tiptap Notion template.
Block interaction style is not a storage format or a proof model. Real-time
collaboration, durable block identities, offline drafts, Noesis semantic commands
and proof checking require explicit host protocols and are not implied by the
block controls. The browser acceptance suite covers actual dragging, keyboard
movement, narrow dark layouts, accessibility and exact serialized source snapshots.
A separate 2000-block typing sample records beforeinput-to-animation-frame timings;
these are local diagnostic measurements, not field INP or a fastest-editor claim.

## Opt-in component imports

Console imports its components through dedicated package entry points. Each entry has both JavaScript and declarations in the published build, so applications can use navigation, feedback and data tables without loading maps or rich-text editors.

```tsx
import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';
import { SnackbarProvider, useSnackbar } from '@omnitron-dev/prism/components/snackbar';
import { LoadingScreen } from '@omnitron-dev/prism/components/loading-screen';
import { AdminDataTable } from '@omnitron-dev/prism/components/admin-filters';
```

The following component groups are independently importable:

`@omnitron-dev/prism/components/admin-filters`, `@omnitron-dev/prism/components/alert`, `@omnitron-dev/prism/components/animate`, `@omnitron-dev/prism/components/breadcrumbs`, `@omnitron-dev/prism/components/card`, `@omnitron-dev/prism/components/chart`, `@omnitron-dev/prism/components/command-palette`, `@omnitron-dev/prism/components/confirm-dialog`, `@omnitron-dev/prism/components/empty-content`, `@omnitron-dev/prism/components/error-boundary`, `@omnitron-dev/prism/components/label`, `@omnitron-dev/prism/components/loading-screen`, `@omnitron-dev/prism/components/navigation-progress`, `@omnitron-dev/prism/components/page-content`, `@omnitron-dev/prism/components/popover`, `@omnitron-dev/prism/components/search-input`, `@omnitron-dev/prism/components/scroll-to-top`, `@omnitron-dev/prism/components/skeleton`, `@omnitron-dev/prism/components/snackbar`, `@omnitron-dev/prism/components/stepper`, `@omnitron-dev/prism/components/table`, `@omnitron-dev/prism/components/tabs`.

Use `@omnitron-dev/prism/core` for `PrismProvider` and its core hooks, `@omnitron-dev/prism/layouts` for layout composition, `@omnitron-dev/prism/state` for stores and `@omnitron-dev/prism/auth` for guards. Maps and editors retain their existing explicit subpaths and can be loaded only on the routes that need them. The root barrel remains compatible, but opt-in imports give a consumer tighter control of its dependency graph.
