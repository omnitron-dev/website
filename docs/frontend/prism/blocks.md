---
id: "frontend/prism/blocks"
slug: "/docs/frontend/prism/blocks"
sidebar_position: 3
title: Blocks
description: Full-page composites — drop one in, fill the slots, ship a screen.
---

# Blocks

Blocks sit one level above [layouts](./layouts.md) and components.
They're higher-level composites — auth forms + guards, a
collapsible dashboard panel, a full data-grid — that you drop
into a route, wire to your data callbacks, and ship.

Import `AuthBlock`, `DashboardBlock` and `DataGridBlock` from `@omnitron-dev/prism/blocks`.

## `AuthBlock` — auth forms + route guards {#authblock}

`AuthBlock` is a **namespace** of ready-made auth forms —
`AuthBlock.Login`, `AuthBlock.Register`, `AuthBlock.ForgotPassword`,
`AuthBlock.ResetPassword`, `AuthBlock.VerifyCode` (the same
components are also exported individually as `LoginForm`,
`RegisterForm`, etc.). There is no single `<AuthBlock mode="…">`
component — render the form you need and wire its `onSubmit`:

```tsx
import { AuthBlock } from '@omnitron-dev/prism/blocks';

function SignInPage() {
  return (
    <AuthBlock.Login
      onSubmit={async ({ email, password, rememberMe }) => {
        await authService.signIn({ email, password });
        navigate('/');
      }}
      showRememberMe
      showForgotPassword
      onForgotPassword={() => navigate('/recover')}
      showSocialLogin
      socialProviders={[
        { id: 'google', name: 'Google', icon: <GoogleIcon />, onClick: oauthGoogle },
        { id: 'github', name: 'GitHub', icon: <GithubIcon />, onClick: oauthGithub },
      ]}
    />
  );
}
```

<PrismExample example="auth-login" deferred="true" hydrate="visible" />

### The forms {#the-forms}

| Member (namespace) | Standalone export | Submit payload |
| ------------------ | ----------------- | -------------- |
| `AuthBlock.Login` | `LoginForm` | `{ email, password, rememberMe? }` |
| `AuthBlock.Register` | `RegisterForm` | `RegisterFormData` |
| `AuthBlock.ForgotPassword` | `ForgotPasswordForm` | `{ email }` |
| `AuthBlock.ResetPassword` | `ResetPasswordForm` | `ResetPasswordFormData` |
| `AuthBlock.VerifyCode` | `VerifyCodeForm` | `{ code }` |

### Common form props {#common-form-props}

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `onSubmit` | `(data) => Promise<void> \| void` | Submit handler for the form |
| `loading` | `boolean` | Disables + shows progress. Optional — see below |
| `disabled` | `boolean` | Disable the form |
| `schema` | `z.ZodSchema` | Override the built-in Zod validation |
| `labels` | per-field label overrides | i18n / copy customisation |
| `sx` | `SxProps<Theme>` | Styles for the form wrapper |
| `slotProps` | `{ wrapper, submitButton, textField }` | MUI slot overrides |

The forms use react-hook-form + Zod internally — you get email
validation and field-level errors for free.

**You do not have to pass `loading` to prevent a double submit.**
The form awaits your `onSubmit` and falls back to react-hook-form's
own `isSubmitting`, so every control is disabled for as long as the
promise is pending. Pass `loading` when the *parent* owns a pending
state the form cannot see — a redirect that runs after sign-in, say,
where the button should stay disabled past the resolution of
`onSubmit`.

**Error messages from `onSubmit` are shown, sanitized.** A rejection
is caught and its message rendered above the form, unless it looks
like something internal — a stack frame, an errno, a SQL fragment, a
file path, or a leaked credential value. It matches the *value*, so
"Password must contain at least 2 digits" and "Reset token expired"
reach the user; `password=hunter2` and a JWT do not.

### Per-form props {#per-form-props}

| Form | Prop | Notes |
| ---- | ---- | ----- |
| Login | `showRememberMe`, `showForgotPassword`, `onForgotPassword` | |
| Login | `showSocialLogin`, `socialProviders` | `{ id, name, icon, onClick }[]` |
| Register | `showNameFields`, `requireTerms`, `onTermsClick`, `onPrivacyClick` | |
| Register / ResetPassword | `minPasswordLength` | Feeds the built-in schema |
| ForgotPassword | `onBackToLogin` | |
| VerifyCode | `codeLength` | Default 6 |
| VerifyCode | `onResendCode`, `resendCooldown` | Seconds before Resend re-enables (default 60) |

Resend is guarded against a second click while the first request is
still open, so a double-click sends one code rather than two — which
matters on a rate-limited endpoint, where the second attempt is what
locks the user out of the flow they are finishing.

### Route guards {#route-guards}

The block also exports composable route guards (each takes a
`useAuth` hook so you can plug in your own auth store):

```tsx
import { AuthGuard, GuestGuard, RoleBasedGuard }
  from '@omnitron-dev/prism/blocks';

<AuthGuard useAuth={useAuth} onUnauthenticated={() => navigate('/sign-in')}>
  <Dashboard />
</AuthGuard>

<RoleBasedGuard
  useAuth={useAuth}
  roles={['admin', 'moderator']}
  roleMatchStrategy="any"
  accessDeniedComponent={<Forbidden />}
>
  <AdminPanel />
</RoleBasedGuard>
```

`hasRole` / `hasPermission` / `createConditionalRender` helpers
are exported for inline checks.

## `<DashboardBlock>` — collapsible content panel {#dashboardblock--collapsible-content-panel}

`<DashboardBlock>` is a flexible **panel/card** primitive — a
titled, optionally-collapsible container with header, content,
and footer slots, plus built-in loading and error states. It is
the building block you compose dashboards *from* (it does not
itself render stat tiles or charts — drop those in as children):

```tsx
import { DashboardBlock } from '@omnitron-dev/prism/blocks';

function RequestsPanel({ loading, series }) {
  return (
    <DashboardBlock
      title="Requests / min"
      subtitle="last 24h"
      icon={<ActivityIcon />}
      actions={<IconButton><RefreshIcon /></IconButton>}
      loading={loading}
      collapsible
    >
      <Chart series={series} type="area" />
    </DashboardBlock>
  );
}
```

<PrismExample example="dashboard-block" deferred="true" hydrate="visible" />

| Prop | Type | Purpose |
| ---- | ---- | ------- |
| `title` / `subtitle` | `string` | Header text |
| `icon` | `ReactNode` | Leading header icon |
| `actions` | `ReactNode` | Top-right header slot |
| `children` | `ReactNode` | Panel body |
| `footer` | `ReactNode` | Footer slot |
| `variant` / `size` | `DashboardBlockVariant` / `…Size` | Visual style |
| `loading` | `boolean` | Shows the loading skeleton |
| `error` | `boolean` | Shows the error state (`errorConfig`) |
| `collapsible` | `boolean` | Enables collapse controls; default `false` |
| `defaultCollapsed` | `boolean` | Initial state for an uncontrolled block |
| `collapsed` / `onCollapseChange` | `boolean` / callback | Controlled state and requested changes |

`DashboardBlockHeader`, `DashboardBlockContent`, and
`DashboardBlockFooter` are exported for fully custom composition,
and `useDashboardBlock` drives collapse/loading state.

Capability and state are separate: without `collapsible`, the block remains
expanded, renders no collapse button and ignores context collapse actions, even
if a collapsed state was supplied. Custom headers read the same `collapsible`
flag from `useDashboardBlockContext`. An enabled block collapses its complete
body, including loading, error and empty states; its header stays available.

Use `defaultCollapsed` for internal state, or pair `collapsed` with
`onCollapseChange` for state owned by the caller. The callback reports requested
changes in both modes. The public hook supplies state props, so enable the
capability explicitly when spreading them:

```tsx
import { DashboardBlock, useDashboardBlock } from '@omnitron-dev/prism/blocks';

function ActivityPanel() {
  const { blockProps } = useDashboardBlock({ defaultCollapsed: false });
  return (
    <DashboardBlock title="Activity" collapsible {...blockProps}>
      <ActivityFeed />
    </DashboardBlock>
  );
}
```

External controls can use the hook's `actions.expand()`, `actions.collapse()` and
`actions.toggleCollapse()` to update that same controlled state.

## `<DataGridBlock>` — filterable / sortable / paginated table {#datagridblock--filterable--sortable--paginated-table}

The most-used block. It wraps **MUI X DataGrid** and adds a
toolbar, row actions, selection, and empty/error states behind
one prop API. Columns are MUI `GridColDef`s and rows are passed
directly via the `rows` prop:

```tsx
import { DataGridBlock } from '@omnitron-dev/prism/blocks';

function UsersPage({ users, loading }) {
  return (
    <DataGridBlock
      rows={users}
      getRowId={(row) => row.id}
      loading={loading}
      columns={[
        { field: 'email',  headerName: 'Email', flex: 1, sortable: true },
        { field: 'role',   headerName: 'Role' },
        { field: 'status', headerName: 'Status',
          renderCell: (p) => <StatusChip status={p.value} /> },
        { field: 'createdAt', headerName: 'Created',
          renderCell: (p) => <DateCell value={p.value} /> },
      ]}
      onRowClick={(params) => navigate(`/users/${params.id}`)}
      rowActions={[
        { key: 'edit',   label: 'Edit',   icon: <EditIcon />,  onClick: (row) => navigate(`/users/${row.id}/edit`) },
        { key: 'remove', label: 'Remove', icon: <TrashIcon />, color: 'error', onClick: handleRemove },
      ]}
      selection={{ enabled: true, checkboxSelection: true }}
      onSelectionChange={(model) => setSelected(model)}
      toolbar={{
        quickFilter:      { enabled: true, placeholder: 'Search by email' },
        export:           { csv: true },
        columnVisibility: { enabled: true },
        densitySelector:  true,
      }}
      pagination={{ defaultPageSize: 25, pageSizeOptions: [25, 50, 100] }}
      empty={{
        title:       'No users yet',
        description: 'Invite your first user.',
        action:      { label: 'Invite', onClick: onInvite },
      }}
    />
  );
}
```

<PrismExample example="data-grid-block" deferred="true" hydrate="visible" />

### Columns {#columns}

Columns are standard MUI X `GridColDef`s — `field`, `headerName`,
`flex` / `width`, `sortable`, `renderCell`, `valueGetter`, etc.
(Not a bespoke `ColumnDef`.) Column visibility is controlled via
`columnVisibilityModel` / `onColumnVisibilityChange`, or the
toolbar's `columnVisibility` toggler.

### Row actions {#row-actions}

`rowActions` render in a per-row menu — each is keyed and gets
the row + event:

```tsx
rowActions={[
  { key: 'edit',   label: 'Edit',   icon: <EditIcon />,  onClick: (row, e) => { /* … */ } },
  { key: 'view',   label: 'View',   icon: <EyeIcon />,   onClick: (row, e) => { /* … */ } },
  { key: 'remove', label: 'Remove', icon: <TrashIcon />, color: 'error',
    disabled: (row) => row.locked,
    divider: true,
    onClick: (row, e) => { /* … */ },
  },
]}
```

Actions support `disabled` / `hidden` (boolean or `(row) =>
boolean`), `color`, and a `divider`. (There is no built-in
`confirm` field — open your own `<ConfirmDialog>` from `onClick`.)

### Selection & bulk operations {#selection--bulk-operations}

```tsx
<DataGridBlock
  selection={{ enabled: true, mode: 'multiple', checkboxSelection: true }}
  onSelectionChange={(model) => setSelected(model)}
  // …
/>
```

`onSelectionChange` reports the MUI `GridRowSelectionModel`; drive
your own bulk-action bar from that selection.

### Toolbar config {#toolbar-config}

```typescript
interface DataGridToolbarConfig {
  show?:             boolean;
  quickFilter?:      { enabled?, placeholder?, debounceMs? };
  export?:           { csv?, excel?, print?, fileName? };
  columnVisibility?: { enabled?, defaultModel? };
  densitySelector?:  boolean;
  actions?:          ReactNode;          // custom toolbar actions
  startContent?:     ReactNode;          // left-aligned custom content
  endContent?:       ReactNode;          // right-aligned custom content
}
```

### Server-side data — `useDataGridBlock` {#server-side-data--usedatagridblock}

For server-driven paging/sorting/filtering, use the
`useDataGridBlock` hook: pass a `fetcher` and spread its return
onto the block (server pagination mode):

```tsx
import { DataGridBlock, useDataGridBlock } from '@omnitron-dev/prism/blocks';

function UsersPage() {
  const grid = useDataGridBlock({
    fetcher: async ({ page, pageSize, sortModel, filterModel, quickFilterValue }) => {
      const res = await usersService.list({ page, pageSize, sortModel, filterModel, q: quickFilterValue });
      return { rows: res.items, total: res.total };   // DataGridFetchResult
    },
    initialPageSize: 25,
  });

  return (
    <DataGridBlock
      columns={columns}
      rows={grid.rows}
      loading={grid.loading}
      pagination={{ mode: 'server', rowCount: grid.total }}
      paginationModel={grid.paginationModel}
      onPaginationChange={grid.onPaginationChange}
      sortModel={grid.sortModel}
      onSortChange={grid.onSortChange}
      filterModel={grid.filterModel}
      onFilterChange={grid.onFilterChange}
    />
  );
}
```

The toolbar applies space-separated search terms to
`filterModel.quickFilterValues`. Client grids filter their rows immediately
after the debounce window. Server grids pass the same terms to the fetcher,
with `quickFilterValue` available as joined text. Forward the request's
`signal` to your HTTP client to cancel superseded work. The grid displays
only the latest response, even when the server completes an older request
later. Escape clears search. Pass `toolbar={{ show: false }}` to omit it.

The hook also returns `refresh()` and `reset()`. For client-side
data, just pass the full `rows` array and use the default
(`'client'`) pagination mode.

## When to use a block vs compose your own {#when-to-use-a-block-vs-compose-your-own}

| Reach for a block when… | Compose components when… |
| ----------------------- | ------------------------ |
| The screen matches a standard pattern | Layout differs from the template |
| You want consistency across many similar screens | The screen is unique |
| Speed of iteration matters more than control | Pixel-precision matters more than speed |
| You're building admin / operator surfaces | You're building a marketing / brochure page |

The blocks are compositions of public components + hooks, so
dropping out is cheap. If you outgrow `<DataGridBlock>`, drop to
MUI X `<DataGrid>` directly (or `<FilterToolbar>` + the Prism
`<Table>`) without changing the rest of your page.

## Subpath imports {#subpath-imports}

```tsx
import { AuthBlock, DashboardBlock, DataGridBlock } from '@omnitron-dev/prism/blocks';
```

## See also {#see-also}

- [Components catalog](./components.md) — what blocks are
  composed of
- [Layouts](./layouts.md) — shells that hold blocks
- [Forms](./forms.md) — `<AuthBlock>` uses these primitives

## Guard-only entry point {#guard-only-entry-point}

Use `@omnitron-dev/prism/auth` when you need guards without forms or layout dependencies:

```tsx
import { RoleBasedGuard, hasPermission, type AuthState } from '@omnitron-dev/prism/auth';

function TerminalArea() {
  return (
    <RoleBasedGuard useAuth={useConsoleAuthorization} permissions={['OmnitronTerminal.open']}
      loadingComponent={<p>Checking access…</p>}
      accessDeniedComponent={<p>Access unavailable</p>}>
      <TerminalWorkspace />
    </RoleBasedGuard>
  );
}
```

The entry exports `AuthGuard`, `GuestGuard`, `RoleBasedGuard`, `hasRole`, `hasPermission`, `createConditionalRender` and their types. Guards are router-independent. Supply an authentication hook backed by the application's session and current server policy. `RoleBasedGuard` evaluates grants during rendering, so revoked children cannot appear for a stale render while an effect updates state. UI guards never replace backend authorization.

Omnitron uses this entry with [RPC-derived capabilities](../../omnitron/access.md), preserving the same role policy in Console and CLI.
