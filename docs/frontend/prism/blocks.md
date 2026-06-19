---
sidebar_position: 3
title: Blocks
description: Full-page composites — drop one in, fill the slots, ship a screen.
---

# Blocks

Blocks sit one level above [layouts](./layouts.md) and components.
They're higher-level composites — auth forms + guards, a
collapsible dashboard panel, a full data-grid — that you drop
into a route, wire to your data callbacks, and ship.

Three blocks ship out of the box (`AuthBlock`, `DashboardBlock`,
`DataGridBlock`). Each is also available as its own subpath
import.

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

### The forms

| Member (namespace) | Standalone export | Submit payload |
| ------------------ | ----------------- | -------------- |
| `AuthBlock.Login` | `LoginForm` | `{ email, password, rememberMe? }` |
| `AuthBlock.Register` | `RegisterForm` | `RegisterFormData` |
| `AuthBlock.ForgotPassword` | `ForgotPasswordForm` | `{ email }` |
| `AuthBlock.ResetPassword` | `ResetPasswordForm` | `ResetPasswordFormData` |
| `AuthBlock.VerifyCode` | `VerifyCodeForm` | `{ code }` |

### Common form props

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `onSubmit` | `(data) => Promise<void> \| void` | Submit handler for the form |
| `loading` | `boolean` | Disables + shows progress while submitting |
| `disabled` | `boolean` | Disable the form |
| `schema` | `z.ZodSchema` | Override the built-in Zod validation |
| `labels` | per-field label overrides | i18n / copy customisation |
| `slotProps` | `{ wrapper, submitButton, textField }` | MUI slot overrides |

The forms use react-hook-form + Zod internally — you get email
validation and field-level errors for free.

### Route guards

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

## `<DashboardBlock>` — collapsible content panel

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
| `collapsible` / `collapsed` / `onCollapseChange` | — | Collapse behaviour |

`DashboardBlockHeader`, `DashboardBlockContent`, and
`DashboardBlockFooter` are exported for fully custom composition,
and `useDashboardBlock` drives collapse/loading state.

## `<DataGridBlock>` — filterable / sortable / paginated table

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

### Columns

Columns are standard MUI X `GridColDef`s — `field`, `headerName`,
`flex` / `width`, `sortable`, `renderCell`, `valueGetter`, etc.
(Not a bespoke `ColumnDef`.) Column visibility is controlled via
`columnVisibilityModel` / `onColumnVisibilityChange`, or the
toolbar's `columnVisibility` toggler.

### Row actions

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

### Selection & bulk operations

```tsx
<DataGridBlock
  selection={{ enabled: true, mode: 'multiple', checkboxSelection: true }}
  onSelectionChange={(model) => setSelected(model)}
  // …
/>
```

`onSelectionChange` reports the MUI `GridRowSelectionModel`; drive
your own bulk-action bar from that selection.

### Toolbar config

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

### Server-side data — `useDataGridBlock`

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

The hook also returns `refresh()` and `reset()`. For client-side
data, just pass the full `rows` array and use the default
(`'client'`) pagination mode.

## When to use a block vs compose your own

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

## Subpath imports

```tsx
import { AuthBlock      } from '@omnitron-dev/prism/blocks/auth-block';
import { DashboardBlock } from '@omnitron-dev/prism/blocks/dashboard-block';
import { DataGridBlock  } from '@omnitron-dev/prism/blocks/data-grid-block';
```

## See also

- [Components catalog](./components.md) — what blocks are
  composed of
- [Layouts](./layouts.md) — shells that hold blocks
- [Forms](./forms.md) — `<AuthBlock>` uses these primitives
