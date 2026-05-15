---
sidebar_position: 2
title: Prism — Design System
---

# Prism

Prism is a **constructor of UIs**, not a component dump. It ships
theme tokens, layout primitives, semantic blocks, forms, and
accessibility scaffolding that compose into entire screens with
consistent spacing, focus, and behaviour.

## Install

```bash
pnpm add @omnitron-dev/prism
```

## Surface

| Subpath            | What lives there                                             |
| ------------------ | ------------------------------------------------------------ |
| `theme`            | Design tokens, dark/light schemes, typographic scale         |
| `core`             | Box, Stack, Grid — primitive layout building blocks          |
| `layouts`          | Page, Sidebar, Split, Drawer, Modal, Sheet                   |
| `blocks/*`         | DataTable, Form, Card, Stat, Toolbar, Dialog, Wizard         |
| `components/*`     | Atomic widgets: Button, Input, Select, Combobox, Toast       |
| `forms`            | Schema-bound form scaffolding with validation                |
| `accessibility`    | FocusTrap, RovingTabIndex, ScreenReaderOnly, aria helpers    |
| `state`            | Local UI state primitives (Field, Disclosure, Selection)     |
| `hooks`            | useTheme, useMediaQuery, useDisclosure, etc.                 |
| `netron`           | Adapters for netron-react (DataTable bound to a query, etc.) |
| `http`             | HTTP-flavoured form actions, file uploads                    |
| `cli`              | The `prism` scaffolder for new projects                      |
| `utils`            | className, cx, polymorphic refs, focus scope                 |

## A page in Prism

```tsx
import { Page, DataTable, col, Toolbar, Button } from '@omnitron-dev/prism';
import { useNetronQuery, useNetronMutation } from '@omnitron-dev/netron-react';
import type { UsersService } from '@my/contracts';

export function UsersPage() {
  const list = useNetronQuery(UsersService, 'list', []);
  const remove = useNetronMutation(UsersService, 'remove');

  return (
    <Page
      title="Users"
      toolbar={<Toolbar>
        <Button intent="primary" onClick={() => /* open dialog */}>Invite</Button>
      </Toolbar>}
    >
      <DataTable
        query={list}
        columns={[
          col('email'),
          col('createdAt', { format: 'relative' }),
          col.actions(({ row }) => (
            <Button onClick={() => remove.run(row.id)} loading={remove.isLoading}>
              Remove
            </Button>
          )),
        ]}
      />
    </Page>
  );
}
```

What's not in the source you write:

- **Spacing** — `Page` wraps the toolbar and content with the theme's
  spacing scale.
- **Focus** — `Button` integrates with the page's focus scope; `Esc`
  closes the page if it's a Drawer.
- **Loading and error states** — `DataTable` reads `isLoading` and
  `error` from the query and renders the appropriate scaffolding.
- **Accessibility** — keyboard navigation, ARIA labelling, screen
  reader announcements come from the blocks.

## Theme tokens

```tsx
import { theme } from '@omnitron-dev/prism';

// Compose styles using tokens, not literal values.
<Box p={theme.space.md} bg={theme.color.surface} radius={theme.radius.lg} />
```

Tokens drive both light and dark schemes; switching is one prop on
the root provider.

## CLI

```bash
pnpm prism create my-app
pnpm prism add block data-table
pnpm prism doctor                # Audit accessibility violations
```

## Read also

- [netron-react](./netron-react.md) — Prism blocks bind to query/mutation hooks.
- The web console at `apps/omnitron/webapp` is built entirely on Prism.
