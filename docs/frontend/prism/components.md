---
sidebar_position: 2
title: Components catalog
description: Per-component reference for the 50+ widgets in Prism.
---

# Components catalog

This page is the per-component reference. Each component links
to its subpath import, lists its props (where non-trivial),
shows a representative example, and notes accessibility &
integration concerns.

For full-page composites see [Blocks](./blocks.md); for layouts
see [Layouts](./layouts.md).

## Status & feedback

### `<Alert>` / `<FormAlert>`

```tsx
import { Alert, FormAlert } from '@omnitron-dev/prism/components/alert';

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
import { useSnackbar } from '@omnitron-dev/prism/components/snackbar';

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
import { ConfirmDialog } from '@omnitron-dev/prism/components/confirm-dialog';

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
import { Tooltip } from '@omnitron-dev/prism/components/tooltip';

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
import { LoadingScreen } from '@omnitron-dev/prism/components/loading-screen';

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
  from '@omnitron-dev/prism/components/skeleton';

{isLoading ? <Skeleton variant="rectangular" height={200} /> : <Chart type="line" series={series} />}
```

`<Skeleton>` wraps MUI's Skeleton (`variant`: `text` /
`circular` / `rectangular`). For composite placeholders use the
dedicated `<CardSkeleton>` and `<TableSkeleton>` exports.

### `<EmptyContent>`

Friendly empty-state card. Use on every list that may be empty.

```tsx
import { EmptyContent } from '@omnitron-dev/prism/components/empty-content';

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
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';

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
  from '@omnitron-dev/prism/components/progress';

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
import { Card, StatCard } from '@omnitron-dev/prism/components/card';

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
import { Avatar, CustomAvatarGroup } from '@omnitron-dev/prism/components/avatar';

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
  from '@omnitron-dev/prism/components/badge';

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
import { Table } from '@omnitron-dev/prism/components/table';

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
and `loading` props (see `TableProps`).

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

Supported `type` values: `line`, `area`, `bar`, `pie`, `donut`,
`radialBar`, `scatter`, `bubble`, `heatmap`, `candlestick`,
`boxPlot`, `radar`, `polarArea`, `rangeBar`, `rangeArea`,
`treemap`. (There is no `column` type — use `bar`.)

### `<Carousel>`

Slides are passed as **children** (not a `slides` array prop):

```tsx
import { Carousel } from '@omnitron-dev/prism/components/carousel';

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
import { Lightbox, useLightbox } from '@omnitron-dev/prism/components/lightbox';

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
import { Image } from '@omnitron-dev/prism/components/image';

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
import { TagCloud } from '@omnitron-dev/prism/components/tag-cloud';

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
import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';

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
import { Menu, useMenu } from '@omnitron-dev/prism/components/menu';

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
import { MegaMenu } from '@omnitron-dev/prism/components/mega-menu';

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
import { NavigationProgress } from '@omnitron-dev/prism/components/navigation-progress';
import { useLocation } from 'react-router-dom';

const { pathname, search } = useLocation();

<NavigationProgress pathname={pathname} search={search} />
```

`delay` (default 100ms) avoids flashing on fast transitions.

### `<Stepper>`

`<Stepper>` is config-driven — pass a `steps` array (there is no
separate `<Step>` component):

```tsx
import { Stepper } from '@omnitron-dev/prism/components/stepper';

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
import { Tabs, TabPanel } from '@omnitron-dev/prism/components/tabs';

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

### `<ScrollSpy>` / `<ScrollSpyProvider>`

Wrap content in `<ScrollSpyProvider>`, mark each tracked region
with `<ScrollSpySection id="…">`, and read the in-view section
from the `useScrollSpy()` hook (`activeId`) to drive your own
nav. There is no all-in-one `<ScrollSpy items={…}>` nav widget:

```tsx
import { ScrollSpyProvider, ScrollSpySection, useScrollSpy }
  from '@omnitron-dev/prism/components/scroll-spy';

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
import { ScrollToTop } from '@omnitron-dev/prism/components/scroll-to-top';
import { useLocation } from 'react-router-dom';

<ScrollToTop pathname={useLocation().pathname} />
```

(This resets scroll on navigation — it is not a floating
"scroll to top" button. For that, see the `useBackToTop` hook.)

### `<Scrollbar>`

```tsx
import { Scrollbar } from '@omnitron-dev/prism/components/scrollbar';

<Scrollbar sx={{ maxHeight: 400 }}>
  <LongContent />
</Scrollbar>
```

Cross-browser custom scrollbar styling. Doesn't replace native
scroll — just themes the bar.

## Input & form

### `Field` (namespace: `Field.Text`, `Field.Select`, …) {#field}

`Field` is a **namespace** of react-hook-form-integrated inputs —
you use `<Field.Text>`, `<Field.Select>`, `<Field.Number>`, etc.,
not a single polymorphic `<Field>` element. Each field reads from
the surrounding react-hook-form `FormProvider` by `name`:

```tsx
import { Field } from '@omnitron-dev/prism/components/field';
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
  from '@omnitron-dev/prism/components/label';

<Label color="success" variant="soft">Active</Label>
<Label color="warning" startIcon={<ClockIcon />}>Pending</Label>
<BooleanLabel value={isEnabled} />
```

### `<SearchInput>`

Debounced search input with a clear button:

```tsx
import { SearchInput } from '@omnitron-dev/prism/components/search-input';

<SearchInput
  value={query}
  onChange={(v) => setQuery(v)}
  debounce={300}
  placeholder="Search projects…"
/>
```

When `debounce > 0`, `onChange` fires that many ms after the
user stops typing (it receives the raw string) — saves you
wiring `useDebouncedValue` per call site. A clear button is
built in.

### `<DateRangePicker>`

`<DateRangePicker>` is a dialog driven by the
`useDateRangePicker` hook — spread the hook's return onto it
(dates are Day.js values):

```tsx
import { DateRangePicker, useDateRangePicker }
  from '@omnitron-dev/prism/components/date-range-picker';

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
import { TipTapRenderer } from '@omnitron-dev/prism/components/tiptap-renderer';

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
  from '@omnitron-dev/prism/components/command-palette';

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
import { FilterToolbar } from '@omnitron-dev/prism/components/admin-filters';

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
built-in save-as-view.)

## Layout & utility

### `<Drawer>`

Side panel — left, right, top, bottom:

```tsx
import { Drawer } from '@omnitron-dev/prism/components/drawer';

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
  from '@omnitron-dev/prism/components/doc-layout';

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
import { Accordion } from '@omnitron-dev/prism/components/accordion';

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
  from '@omnitron-dev/prism/components/animate';

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
  from '@omnitron-dev/prism/components/settings';

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
  from '@omnitron-dev/prism/components/changelog';

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
import { Card }   from '@omnitron-dev/prism/components/card';
import { Table }  from '@omnitron-dev/prism/components/table';
import { Drawer } from '@omnitron-dev/prism/components/drawer';
```

Use subpaths in production for the leanest payload.

## See also

- [Blocks](./blocks.md) — full-page composites built from components
- [Layouts](./layouts.md) — shell components
- [Forms](./forms.md) — `<Field>` + schema-driven forms
- [Hooks catalog](./hooks-catalog.md) — 25+ React hooks
- [Theme](./theme.md) — colours, typography, dark mode
