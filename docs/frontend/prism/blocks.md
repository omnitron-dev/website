---
sidebar_position: 3
title: Blocks
description: Full-page composites — drop one in, fill the slots, ship a screen.
---

# Blocks

Blocks sit one level above [layouts](./layouts.md) and components.
They're complete user-flow surfaces — sign-in screen, dashboard
overview, data-grid page — that you drop into a route, wire to
your data callbacks, and ship.

Three blocks ship out of the box. Each is also available as its
own subpath import.

## `<AuthBlock>` — full sign-in screen

```tsx
import { AuthBlock } from '@omnitron-dev/prism/blocks';

function SignInPage() {
  return (
    <AuthBlock
      mode="sign-in"
      onSignIn={async ({ email, password, totpCode }) => {
        await authService.signIn({ email, password, totpCode });
        navigate('/');
      }}
      oauth={[
        { provider: 'google',  label: 'Continue with Google',  onClick: oauthGoogle },
        { provider: 'github',  label: 'Continue with GitHub',  onClick: oauthGithub },
      ]}
      links={{
        signUp:        { label: 'Create account',  href: '/sign-up' },
        forgotPassword:{ label: 'Forgot password', href: '/recover' },
      }}
      logo={<Logo size={48} />}
      tagline="Welcome back"
    />
  );
}
```

### Modes

| Mode | Purpose |
| ---- | ------- |
| `'sign-in'` | Email + password + 2FA |
| `'sign-up'` | Registration |
| `'verify'` | Email/phone verification code entry |
| `'forgot-password'` | Initiate password reset |
| `'reset-password'` | Set new password (from email link) |
| `'2fa-setup'` | TOTP secret QR + initial code |

### Props

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `mode` | one of modes above | |
| `onSignIn` / `onSignUp` / `onVerify` / etc. | `(data) => Promise<void>` | Handler for the active mode |
| `oauth` | `Array<{provider, label, onClick}>` | Buttons above the form |
| `links` | per-mode navigation links | |
| `logo` | `ReactNode` | Top of the card |
| `tagline` | `string` | Subtitle |
| `background` | `'gradient' \| 'image' \| ReactNode` | Right-pane illustration |
| `formError` | `string \| ReactNode` | Inline error above the form |

The block uses `<Field>` + `SchemaProvider` internally — you
get email validation, password-strength meter, TOTP-code mask
free.

### 2FA flow

```tsx
const [pendingMfa, setPendingMfa] = useState(false);

<AuthBlock
  mode={pendingMfa ? 'verify' : 'sign-in'}
  onSignIn={async (data) => {
    const result = await authService.signIn(data);
    if (result.requires2fa) {
      setPendingMfa(true);
    } else {
      navigate('/');
    }
  }}
  onVerify={async ({ code }) => {
    await authService.verifyTotp({ code });
    navigate('/');
  }}
/>
```

## `<DashboardBlock>` — overview page

```tsx
import { DashboardBlock } from '@omnitron-dev/prism/blocks';

function DashboardPage() {
  return (
    <DashboardBlock
      title="Platform overview"
      tiles={[
        { label: 'Apps online',    value: 12, delta: +2, icon: 'box',  color: 'primary' },
        { label: 'Active users',   value: '4.2k', delta: +12.5, icon: 'users', color: 'success' },
        { label: 'Storage used',   value: '230GB', delta: +5.1, icon: 'hard-drive', color: 'warning' },
        { label: 'Error rate',     value: '0.12%', delta: -0.04, icon: 'alert', color: 'error' },
      ]}
      charts={[
        { title: 'Requests / min', chart: <Chart series={requestsSeries} type="area" /> },
        { title: 'Latency p95',     chart: <Chart series={latencySeries}  type="line" /> },
      ]}
      recentActivity={
        <ActivityFeed items={activity} />
      }
    />
  );
}
```

| Prop | Purpose |
| ---- | ------- |
| `title` | Page heading |
| `tiles` | Array of `<Stat>` cards |
| `charts` | Chart panels — typically 2-4 |
| `recentActivity` | Right-rail feed |
| `actions` | Top-right action buttons |
| `loading` | Boolean — shows skeleton tiles & charts |

The layout is responsive — tiles wrap, charts collapse to stack
on small screens.

## `<DataGridBlock>` — filterable / sortable / paginated table

The most-used block. Composes `<FilterToolbar>` + `<Table>` +
`<Pagination>` + per-row actions into one prop API:

```tsx
import { DataGridBlock } from '@omnitron-dev/prism/blocks';

function UsersPage() {
  const users = useService<UserService>('users');

  return (
    <DataGridBlock
      title="Users"
      columns={[
        { field: 'email',  header: 'Email', sortable: true },
        { field: 'role',   header: 'Role',  filterable: { type: 'select', options: ['admin','user','viewer'] } },
        { field: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
        { field: 'createdAt', header: 'Created', render: (row) => <DateCell value={row.createdAt} /> },
      ]}
      query={({ page, pageSize, sort, filter }) =>
        users.list.useQuery([{ page, pageSize, sort, filter }])
      }
      rowKey="id"
      onRowClick={(row) => navigate(`/users/${row.id}`)}
      rowActions={[
        { id: 'edit',    label: 'Edit',    icon: 'edit', onClick: (row) => navigate(`/users/${row.id}/edit`) },
        { id: 'remove',  label: 'Remove',  icon: 'trash', danger: true, onClick: handleRemove },
      ]}
      bulkActions={[
        { id: 'export',  label: 'Export selected', onClick: handleExport },
      ]}
      toolbar={{
        search:  { placeholder: 'Search by email', field: 'email' },
        filters: ['role', 'status'],
        export:  { formats: ['csv', 'json'] },
      }}
      pagination={{ defaultPageSize: 25, pageSizeOptions: [25, 50, 100] }}
      emptyState={
        <EmptyContent
          title="No users yet"
          description="Invite your first user."
          action={<Button onClick={onInvite}>Invite</Button>}
        />
      }
    />
  );
}
```

### Column definitions

```typescript
interface ColumnDef<TRow> {
  field:        keyof TRow | string;
  header:       string | ReactNode;
  width?:       number | string;
  align?:       'left' | 'center' | 'right';
  sortable?:    boolean;
  filterable?:  boolean | FilterConfig;
  render?:      (row: TRow) => ReactNode;
  exportValue?: (row: TRow) => string;     // for CSV/JSON export
  hidden?:      boolean;                    // user can re-show via column toggler
}
```

### Server-side vs client-side

```typescript
// Server-side (recommended — scales): query callback receives state
query={({ page, pageSize, sort, filter, search }) =>
  myService.list.useQuery([{ page, pageSize, sort, filter, search }])
}

// Client-side: provide all data upfront
data={allItems}
```

Server-side is the default; `<DataGridBlock>` debounces filter
+ search inputs before calling `query`.

### Row actions

```tsx
rowActions={[
  { id: 'edit',   label: 'Edit',  icon: 'edit',  onClick: (row) => { ... } },
  { id: 'view',   label: 'View',  icon: 'eye',   onClick: (row) => { ... } },
  { id: 'remove', label: 'Remove', icon: 'trash', danger: true,
    onClick: (row) => { ... },
    confirm: { title: 'Remove user?', confirmLabel: 'Remove' },
  },
]}
```

The `confirm` field wires `<ConfirmDialog>` automatically — no
manual state.

### Bulk actions

```tsx
bulkActions={[
  { id: 'export', label: 'Export selected', icon: 'download', onClick: (rows) => handleExport(rows) },
  { id: 'delete', label: 'Delete selected', icon: 'trash', danger: true,
    onClick: (rows) => handleDelete(rows),
    confirm: { title: 'Delete N selected?', confirmLabel: 'Delete' },
  },
]}
```

Selection appears as checkboxes; bulk-action bar shows when ≥1
row is selected.

### Toolbar config

```typescript
interface ToolbarConfig {
  search?:  { placeholder, field, debounceMs? };
  filters?: string[];                              // column ids that should appear as filter chips
  export?:  { formats: ('csv' | 'json' | 'xlsx')[] };
  refresh?: boolean;                               // refresh button
  columnVisibility?: boolean;                      // column toggler
  savedViews?: { provider: SavedViewsProvider };   // save & restore filter sets
}
```

### Saved views

```tsx
import { useSavedViews } from '@omnitron-dev/prism/hooks';

const provider = useSavedViews({
  scope:   'users',
  storage: 'localStorage',          // or pass a server-side provider
});

<DataGridBlock
  // ...
  toolbar={{ savedViews: { provider } }}
/>
```

Users can save the current filter + sort + column-visibility
combo as a named view and restore it later.

## When to use a block vs compose your own

| Reach for a block when… | Compose components when… |
| ----------------------- | ------------------------ |
| The screen matches a standard pattern | Layout differs from the template |
| You want consistency across many similar screens | The screen is unique |
| Speed of iteration matters more than control | Pixel-precision matters more than speed |
| You're building admin / operator surfaces | You're building a marketing / brochure page |

Both blocks are designed so dropping out is cheap — they're
compositions of public components + hooks. If you outgrow
`<DataGridBlock>`, replace it with `<FilterToolbar>` +
`<Table>` + `<Pagination>` without changing the rest of your
page.

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
