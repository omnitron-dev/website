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

<FormAlert error={form.formState.errors.email}>
  Please enter a valid email address.
</FormAlert>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Drives icon + colour |
| `title` | `string` | — | Bold leading line |
| `onClose` | `() => void` | — | Renders dismiss button |
| `variant` | `'standard' \| 'filled' \| 'outlined'` | `'standard'` | Visual weight |
| `icon` | `ReactNode` | (derived) | Override the default icon |

**`<FormAlert>`** is the canonical surface for **inline** form
errors — toast/snackbar is reserved for transient background
events. Pair with `react-hook-form`:

```tsx
const { formState, register } = useForm();

<form>
  {formState.errors.root && (
    <FormAlert error={formState.errors.root} />
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
| `message` | `string \| ReactNode` | — |
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` |
| `duration` | `number` (ms) | `4_000` |
| `action` | `ReactNode` | — |
| `anchorOrigin` | `{ vertical, horizontal }` | `{ vertical: 'bottom', horizontal: 'right' }` |

Multiple snackbars stack; max-stack is configured at the
provider level (default 3).

### `<ConfirmDialog>`

```tsx
import { ConfirmDialog, useConfirmDialog }
  from '@omnitron-dev/prism/components/confirm-dialog';

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const confirm = useConfirmDialog();

  return (
    <Button color="error" onClick={async () => {
      const ok = await confirm({
        title:        'Delete project?',
        description:  'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel:  'Keep',
        severity:     'error',
      });
      if (ok) onDelete();
    }}>
      Delete
    </Button>
  );
}
```

The hook returns a promise — `true` on confirm, `false` on
cancel or backdrop. No manual open-state to thread through.

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

Full-viewport spinner — typical use is the Suspense fallback:

```tsx
import { LoadingScreen } from '@omnitron-dev/prism/components/loading-screen';

<Suspense fallback={<LoadingScreen />}>
  <Outlet />
</Suspense>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `message` | `string` | — |
| `variant` | `'spinner' \| 'skeleton'` | `'spinner'` |
| `fullScreen` | `boolean` | `true` |

### `<Skeleton>`

Animated placeholder while data loads.

```tsx
import { Skeleton } from '@omnitron-dev/prism/components/skeleton';

{isLoading ? <Skeleton height={200} /> : <Chart data={data} />}
```

Per-component default sizes — `<Avatar variant="circular">` →
circular skeleton, `<Card>` → card-shaped, etc.

### `<EmptyContent>`

Friendly empty-state card. Use on every list that may be empty.

```tsx
import { EmptyContent } from '@omnitron-dev/prism/components/empty-content';

{items.length === 0 ? (
  <EmptyContent
    title="No projects yet"
    description="Create your first project to get started."
    action={<Button onClick={onCreate}>Create project</Button>}
    illustration="empty-folder"
  />
) : (
  <ItemList items={items} />
)}
```

Built-in illustrations: `empty-folder`, `empty-search`,
`empty-cart`, `empty-mail`, `error-404`, `error-500`. Pass a
custom `ReactNode` for any other case.

### `<ErrorBoundary>`

```tsx
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';

<ErrorBoundary
  fallback={(error, reset) => <ErrorScreen error={error} onReset={reset} />}
  onError={(error, info) => reportToSentry(error, info)}
>
  <Outlet />
</ErrorBoundary>
```

Catches synchronous render errors. Doesn't catch async / event-
handler errors — those go through global window error handlers.

### `<Progress>`

```tsx
<Progress value={75} max={100} label="75%" />
<Progress variant="indeterminate" />
<Progress variant="circular" value={50} />
```

Linear and circular variants; determinate and indeterminate
modes.

## Data display

### `<Card>`

```tsx
import { Card } from '@omnitron-dev/prism/components/card';

<Card title="Active users" subtitle="last 30 days">
  <Stat value={1234} delta={+12.5} />
</Card>

<Card
  title="Project Alpha"
  cover={<Image src={cover} aspectRatio="16/9" />}
  actions={<Button>Open</Button>}
  onClick={() => navigate('/projects/alpha')}
  interactive
>
  <Text variant="body2">Last updated 2 hours ago</Text>
</Card>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `title` | `string \| ReactNode` | — |
| `subtitle` | `string` | — |
| `cover` | `ReactNode` | — | Top media area |
| `actions` | `ReactNode` | — | Footer actions row |
| `interactive` | `boolean` | `false` | Hover state + cursor |
| `onClick` | `() => void` | — | Card-wide click handler |
| `elevation` | `0 \| 1 \| 2 \| 3 \| 4 \| 6 \| 8` | `1` | Shadow depth |

Cards are typically arranged in `<Grid container spacing={2}>` —
`<Card>` itself doesn't handle layout.

### `<Avatar>`

```tsx
import { Avatar } from '@omnitron-dev/prism/components/avatar';

<Avatar src={user.avatarUrl} name={user.name} size="md" />
<Avatar name="Alice" presence="online" />
<Avatar.Group max={3}>
  {team.map(u => <Avatar key={u.id} src={u.avatarUrl} name={u.name} />)}
</Avatar.Group>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `src` | `string` | — | Image URL; falls back to initials |
| `name` | `string` | — | Used for initials + alt text |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | |
| `presence` | `'online' \| 'busy' \| 'away' \| 'offline'` | — | Status indicator dot |
| `shape` | `'circle' \| 'square' \| 'rounded'` | `'circle'` | |

The fallback is **deterministic** — same name always produces
the same colour + initials, so users are visually identifiable
even without photos.

### `<Badge>`

```tsx
import { Badge } from '@omnitron-dev/prism/components/badge';

<Badge count={5}>
  <NotificationsIcon />
</Badge>

<Badge dot color="error">
  <Avatar src={src} />
</Badge>

<Badge count={150} max={99}>
  <ShoppingCartIcon />
</Badge>
```

`max` caps the display value with `+` suffix (`99+`); `dot`
shows a colour dot without a number.

### `<Table>`

The low-level table. For most app tables, prefer
[`<DataGridBlock>`](./blocks.md#datagridblock--filterable--sortable--paginated-table) or
`<AdminDataTable>` (re-exported from `components/admin-filters`)
which add filtering, sorting, pagination, row actions.

```tsx
import { Table, TableHead, TableBody, TableRow, TableCell }
  from '@omnitron-dev/prism/components/table';

<Table>
  <TableHead>
    <TableRow>
      <TableCell>Name</TableCell>
      <TableCell>Email</TableCell>
      <TableCell align="right">Karma</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {users.map(u => (
      <TableRow key={u.id}>
        <TableCell>{u.name}</TableCell>
        <TableCell>{u.email}</TableCell>
        <TableCell align="right">{u.karma}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

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

Supported types: `area`, `line`, `bar`, `column`, `pie`, `donut`,
`radar`, `scatter`, `heatmap`, `treemap`, `boxPlot`,
`candlestick`, `radialBar`.

### `<Carousel>`

```tsx
import { Carousel } from '@omnitron-dev/prism/components/carousel';

<Carousel
  slides={images.map(src => <img src={src} />)}
  autoplay={{ delay: 5000 }}
  showDots
  showArrows
/>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `slides` | `ReactNode[]` | — |
| `autoplay` | `{ delay, pauseOnHover? } \| false` | `false` |
| `loop` | `boolean` | `true` |
| `showDots` | `boolean` | `true` |
| `showArrows` | `boolean` | `true` |
| `slidesPerView` | `number \| 'auto'` | `1` |
| `spaceBetween` | `number` | `0` |

### `<Lightbox>`

```tsx
import { Lightbox, useLightbox } from '@omnitron-dev/prism/components/lightbox';

function Gallery({ images }: { images: string[] }) {
  const lightbox = useLightbox();
  return (
    <>
      {images.map((src, i) => (
        <img src={src} onClick={() => lightbox.open(images, i)} />
      ))}
      <Lightbox controller={lightbox} />
    </>
  );
}
```

Keyboard navigation (arrows, Esc), pinch-zoom on touch, optional
caption + EXIF panel.

### `<Image>`

```tsx
import { Image } from '@omnitron-dev/prism/components/image';

<Image
  src={user.avatarUrl}
  fallback="/default-avatar.png"
  aspectRatio="1/1"
  loading="lazy"
  blurDataURL={user.blurHash}
/>
```

Adds: aspect-ratio container (no layout shift), fallback on
error, lazy-load via `IntersectionObserver`, optional blurhash
placeholder.

### `<TagCloud>`

```tsx
import { TagCloud } from '@omnitron-dev/prism/components/tag-cloud';

<TagCloud
  items={[
    { value: 'react', count: 142 },
    { value: 'typescript', count: 98 },
    { value: 'rpc', count: 31 },
  ]}
  maxFontSize={32}
  minFontSize={12}
  onClick={(tag) => navigate(`/search?q=${tag}`)}
/>
```

Sizes tags proportional to count using a log scale; clickable.

## Navigation

### `<Breadcrumbs>`

```tsx
import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';

<Breadcrumbs
  items={[
    { label: 'Home',    href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: 'Alpha' },               // current page — no href
  ]}
  separator="›"
/>
```

| Prop | Type | Default |
| ---- | ---- | ------- |
| `items` | `Array<{label, href?, icon?}>` | — |
| `separator` | `ReactNode` | `'/'` |
| `maxItems` | `number` | `8` |
| `itemsBeforeCollapse` | `number` | `1` |
| `itemsAfterCollapse` | `number` | `2` |

Auto-collapses to `Home / ... / Alpha` past `maxItems` — the
collapsed range expands on click.

### `<Menu>`

Dropdown menu. Pairs with `<IconButton>` or any trigger:

```tsx
import { Menu, MenuItem, MenuDivider, useMenu }
  from '@omnitron-dev/prism/components/menu';

function UserMenu() {
  const menu = useMenu();
  return (
    <>
      <IconButton {...menu.triggerProps}><MoreIcon /></IconButton>
      <Menu controller={menu}>
        <MenuItem icon={<ProfileIcon />} onClick={() => navigate('/me')}>
          Profile
        </MenuItem>
        <MenuItem icon={<SettingsIcon />} onClick={() => navigate('/settings')}>
          Settings
        </MenuItem>
        <MenuDivider />
        <MenuItem icon={<LogoutIcon />} danger onClick={signOut}>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
```

### `<MegaMenu>`

Multi-column dropdown for sites with deep navigation:

```tsx
<MegaMenu trigger={<NavLink>Products</NavLink>}>
  <MegaMenuColumn title="Backend">
    <NavCard title="Titan"     href="/titan"     icon="cpu" />
    <NavCard title="Modules"   href="/modules"   icon="box" />
  </MegaMenuColumn>
  <MegaMenuColumn title="Frontend">
    <NavCard title="Prism"           href="/prism"            icon="palette" />
    <NavCard title="netron-react"    href="/netron-react"     icon="zap" />
  </MegaMenuColumn>
</MegaMenu>
```

### `<NavCard>` / `<NavCardGrid>`

Compact cards for navigation hubs:

```tsx
<NavCardGrid columns={3} spacing={2}>
  <NavCard title="Apps"     href="/apps"     icon="box"  description="Manage applications" />
  <NavCard title="Infra"    href="/infra"    icon="grid" description="Containers + services" />
  <NavCard title="Settings" href="/settings" icon="cog"  description="Per-user preferences" />
</NavCardGrid>
```

### `<NavSection>`

Sidebar navigation builder. The `<DashboardLayout>` uses this
internally; you can use it standalone:

```tsx
<NavSection
  items={[
    { title: 'Dashboard', path: '/',         icon: 'home' },
    {
      title: 'Settings',
      path:  '/settings',
      icon:  'cog',
      children: [
        { title: 'Profile',  path: '/settings/profile' },
        { title: 'Security', path: '/settings/security' },
      ],
    },
  ]}
  currentPath={location.pathname}
/>
```

### `<NavigationProgress>`

Top-of-page loading bar — shows during route transitions:

```tsx
import { NavigationProgress } from '@omnitron-dev/prism/components/navigation-progress';

<NavigationProgress color="primary" height={3} />
```

Hooks into the router (react-router 7) to start on navigation
and finish on settled.

### `<Stepper>`

```tsx
import { Stepper, Step } from '@omnitron-dev/prism/components/stepper';

const [activeStep, setActiveStep] = useState(0);

<Stepper activeStep={activeStep}>
  <Step label="Account"  description="Email + password" />
  <Step label="Profile"  description="Name + avatar" />
  <Step label="Plan"     description="Choose a tier" />
  <Step label="Confirm"  description="Review & finish" optional />
</Stepper>
```

Horizontal by default; pass `orientation="vertical"` for a side
stepper.

### `<Tabs>` / `<TabPanel>`

```tsx
import { Tabs, Tab, TabPanel } from '@omnitron-dev/prism/components/tabs';

const [value, setValue] = useState('overview');

<>
  <Tabs value={value} onChange={(_, v) => setValue(v)}>
    <Tab value="overview"  label="Overview" />
    <Tab value="logs"      label="Logs" />
    <Tab value="metrics"   label="Metrics" badge={4} />
  </Tabs>

  <TabPanel value={value} index="overview"><Overview /></TabPanel>
  <TabPanel value={value} index="logs"><Logs /></TabPanel>
  <TabPanel value={value} index="metrics"><Metrics /></TabPanel>
</>
```

`badge` prop renders a numeric badge on a tab — useful for
"unread" / "errors" counts.

### `<ScrollSpy>` / `<ScrollSpyProvider>`

```tsx
import { ScrollSpyProvider, ScrollSpy }
  from '@omnitron-dev/prism/components/scroll-spy';

<ScrollSpyProvider>
  <article>
    <section id="intro">...</section>
    <section id="setup">...</section>
    <section id="api">...</section>
  </article>
  <aside>
    <ScrollSpy
      items={[
        { id: 'intro', label: 'Introduction' },
        { id: 'setup', label: 'Setup' },
        { id: 'api',   label: 'API' },
      ]}
    />
  </aside>
</ScrollSpyProvider>
```

Tracks which section is in view; highlights the matching nav
item. Used by docs pages.

### `<ScrollToTop>`

```tsx
<ScrollToTop threshold={400} />
```

Shows a floating "scroll to top" button past `threshold` px of
scroll. Self-contained.

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

### `<Field>`

The canonical form field. Reads the active schema from
`<SchemaProvider>` (see [Forms](./forms.md)):

```tsx
import { Field } from '@omnitron-dev/prism/components/field';

<Field name="email"    label="Email"    type="email" />
<Field name="password" label="Password" type="password" />
<Field name="bio"      label="Bio"      multiline rows={4} />
<Field name="role"     label="Role" select>
  <MenuItem value="viewer">Viewer</MenuItem>
  <MenuItem value="admin">Admin</MenuItem>
</Field>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `name` | `string` | — | Maps to react-hook-form field |
| `label` | `string` | — | Shown above the input |
| `type` | `'text' \| 'email' \| 'password' \| 'number' \| 'tel' \| 'url' \| 'search'` | `'text'` | |
| `multiline` | `boolean` | `false` | Renders `<TextField multiline>` |
| `rows` | `number` | `4` | Min rows when multiline |
| `select` | `boolean` | `false` | Render as `<Select>` |
| `helperText` | `string` | — | Below input |
| `required` | `boolean` | (from schema) | Marks the field |
| `autoComplete` | `string` | — | HTML autocomplete hint |
| `placeholder` | `string` | — | |

The schema drives required / min / max / type — the prop
overrides take precedence per field.

### `<Label>`

Standalone label, useful outside `<Field>`:

```tsx
<Label required htmlFor="custom-input">Display name</Label>
<input id="custom-input" />
```

### `<SearchInput>`

Debounced search input with a clear button:

```tsx
import { SearchInput } from '@omnitron-dev/prism/components/search-input';

<SearchInput
  value={query}
  onDebouncedChange={(v) => setQuery(v)}
  debounceMs={300}
  placeholder="Search projects…"
/>
```

`onDebouncedChange` fires `debounceMs` after the user stops
typing — saves you wiring `useDebouncedValue` per call site.

### `<DateRangePicker>`

```tsx
import { DateRangePicker } from '@omnitron-dev/prism/components/date-range-picker';

<DateRangePicker
  value={{ start: from, end: to }}
  onChange={({ start, end }) => setRange({ from: start, to: end })}
  presets={[
    { label: 'Last 7 days',  value: 'last-7d' },
    { label: 'Last 30 days', value: 'last-30d' },
    { label: 'This month',   value: 'this-month' },
  ]}
  maxDate={new Date()}
/>
```

Built-in presets for the common ranges; localised; keyboard-
navigable.

### `<DurationPicker>`

For "how long" inputs (TTLs, timeouts):

```tsx
<DurationPicker
  value={{ value: 30, unit: 'minutes' }}
  onChange={(v) => setDuration(v)}
  units={['seconds', 'minutes', 'hours', 'days']}
  min={0}
/>
```

Returns `{ value, unit }`; helper `toMs(v)` for conversion.

### `<CountrySelect>`

ISO 3166 country dropdown with flags + search.

```tsx
<CountrySelect value={country} onChange={setCountry} />
```

Returns the ISO alpha-2 code.

### `<Editor>` + `<TiptapRenderer>`

Tiptap-based rich-text editor and read-only renderer:

```tsx
import { Editor } from '@omnitron-dev/prism/components/editor';
import { TiptapRenderer } from '@omnitron-dev/prism/components/tiptap-renderer';

// Edit mode:
<Editor
  value={content}
  onChange={setContent}
  toolbar={['bold', 'italic', 'link', 'heading', 'list', 'code', 'image']}
  uploadImage={async (file) => (await uploadService.put(file)).url}
/>

// Read mode (e.g., displaying a saved post):
<TiptapRenderer content={post.content} />
```

Storage format is Tiptap's JSON document — portable across
edit/view, indexable for full-text search, safer than raw HTML.

### `<ContentRenderer>`

Renders a payload of mixed content (Tiptap JSON, markdown, plain
text, OEmbed cards) with consistent typography:

```tsx
<ContentRenderer content={post.body} format="auto" />
```

Auto-detects the format from the content shape; explicit format
override available.

### `<CommandPalette>`

`Cmd+K` style command palette:

```tsx
import { CommandPalette, useCommandPalette }
  from '@omnitron-dev/prism/components/command-palette';

function App() {
  const palette = useCommandPalette({
    shortcuts: ['cmd+k', 'ctrl+k'],
    actions: [
      { id: 'new-project', label: 'New project', icon: 'plus', onSelect: () => navigate('/projects/new') },
      { id: 'sign-out',    label: 'Sign out',    icon: 'logout', danger: true, onSelect: signOut },
    ],
  });
  return (
    <>
      <Outlet />
      <CommandPalette controller={palette} />
    </>
  );
}
```

Fuzzy-matches actions by label + tag; arrow keys + Enter; Esc
closes.

### `<AdminFilters>` / `<FilterToolbar>`

Filter toolbar above admin tables — multi-select, search, date
range, status chips, save-as-view:

```tsx
import { FilterToolbar } from '@omnitron-dev/prism/components/admin-filters';

<FilterToolbar
  filters={[
    { id: 'status', type: 'multi-select', label: 'Status',
      options: ['active', 'archived'], value: status, onChange: setStatus },
    { id: 'tier', type: 'multi-select', label: 'Tier',
      options: ['free', 'pro', 'enterprise'], value: tier, onChange: setTier },
    { id: 'q', type: 'search', label: 'Search', value: q, onChange: setQ },
  ]}
  onReset={() => { setStatus([]); setTier([]); setQ(''); }}
  onSaveView={(name) => savedViews.add(name, currentFilters)}
/>
```

Filter chips appear inline; clicking removes the filter. Pairs
naturally with `<DataGridBlock>`.

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
  size="md"             // 'sm' (320px) | 'md' (480px) | 'lg' (640px) | 'full'
  title="Edit user"
  footer={<><Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={save}>Save</Button></>}
>
  <UserForm user={user} />
</Drawer>
```

Variants:
- `temporary` (default) — overlays, closes on backdrop click
- `persistent` — pushes content
- `permanent` — always visible (used in `<DashboardLayout>`)

### `<PageContent>`

Page-wrapper with header + breadcrumbs + actions:

```tsx
<PageContent
  title="Projects"
  breadcrumbs={[
    { label: 'Home', href: '/' },
    { label: 'Projects' },
  ]}
  actions={
    <Button variant="contained" startIcon={<PlusIcon />}>
      New project
    </Button>
  }
>
  <ProjectsList />
</PageContent>
```

### `<DocLayout>`

For documentation pages — sidebar + main + table-of-contents:

```tsx
<DocLayout
  sidebar={<DocSidebar items={navItems} />}
  toc={<TableOfContents headings={headings} />}
>
  <article>{content}</article>
</DocLayout>
```

### `<Accordion>`

```tsx
import { Accordion } from '@omnitron-dev/prism/components/accordion';

<Accordion>
  <Accordion.Item value="overview" title="Overview">
    What it does.
  </Accordion.Item>
  <Accordion.Item value="installation" title="Installation">
    How to install.
  </Accordion.Item>
</Accordion>
```

Multiple/single mode (`type="multiple" | "single"`).

### `<Animate>`

Wraps content with an entrance animation:

```tsx
<Animate type="fade-up" delay={100} duration={400}>
  <Card>…</Card>
</Animate>
```

Types: `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right`,
`scale`, `bounce-in`.

### `<SvgColor>`

Inlines an SVG and applies theme colour via CSS mask:

```tsx
<SvgColor src="/icons/star.svg" color="primary" size={20} />
```

Lets you tint icons without exporting per-colour copies.

### `<Settings>`

In-app settings drawer — theme mode, layout, colour preset:

```tsx
<Settings open={open} onClose={() => setOpen(false)} />
```

Reads/writes from the Prism settings store
(`useSettingsStore`) — persisted to localStorage.

### `<Changelog>`

Renders a feed of changes:

```tsx
<Changelog
  entries={[
    { date: '2026-05-16', version: '1.4.0', title: 'New dashboard', body: 'Added project overview.' },
    { date: '2026-05-10', version: '1.3.1', title: 'Fix logs', body: 'Resolved tail buffering.' },
  ]}
/>
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

Components that expose an imperative handle (e.g. `<CaptchaInput>`
with `getData()` / `refresh()`) attach the handle type via a
`ref?: Ref<HandleType>` field on their props interface — identical
call-site ergonomics, no `useImperativeHandle` ceremony on the
consumer side.

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
