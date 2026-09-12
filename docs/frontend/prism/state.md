---
title: State and persistence
description: Local UI stores, persisted preferences, migrations and the boundary with server state.
---

# State and persistence

Import store factories from `@omnitron-dev/prism/state`. They wrap Zustand
with Immer updates, optional persistence and DevTools integration. Use
these stores for local interface state. Keep remote query results in
[Netron's query cache](../netron/caching.md), which owns their refresh and
invalidation rules.

## Choose a store

| Factory | Use it for | Persistence |
| --- | --- | --- |
| `createUIStore(initializer, name)` | Panels, selection and transient controls | Disabled |
| `createPrismStore(initializer, options)` | A store with explicit middleware choices | Opt-in through `options.persist` |
| `createPersistedStore(initializer, name, persistOptions?)` | Preferences that survive reloads | Enabled; exposes the `persist` API |

```typescript
import { createUIStore } from '@omnitron-dev/prism/state';

interface Selection {
  selectedId: string | null;
  select: (id: string | null) => void;
}

export const useSelection = createUIStore<Selection>((set) => ({
  selectedId: null,
  select: (id) => set((state) => { state.selectedId = id; }),
}), 'selection');
```

Read the smallest slice in a component:

```tsx
function SelectionLabel() {
  const selectedId = useSelection((state) => state.selectedId);
  return <span>{selectedId ?? 'Nothing selected'}</span>;
}
```

Outside React, use the returned store's `getState()` and `subscribe()`.
Call the unsubscribe function when the consumer is disposed.

## Built-in stores

| Hook | Responsibility |
| --- | --- |
| `useSettingsStore` | Theme preferences, density, navigation and application settings |
| `useThemeStore` | The standalone theme store; do not create a second source of truth for a `PrismProvider` tree |
| `useUIStore` | Shared interface state |
| `useAuthStore` | Local authentication presentation state |

Each also exports a non-hook alias: `settingsStore`, `themeStore`,
`uiStore` and `authStore`. For a provider-backed application, follow the
[theme guide](./theme.md) and update `useSettingsStore`.
Authentication state in a browser store does not enforce server access;
use the [Netron auth provider](../netron/auth.md) for RPC sessions.

## Persist preferences deliberately

```typescript
import { createPersistedStore } from '@omnitron-dev/prism/state';

interface Preferences {
  compact: boolean;
  setCompact: (compact: boolean) => void;
}

export const usePreferences = createPersistedStore<Preferences>(
  (set) => ({
    compact: false,
    setCompact: (compact) => set((state) => { state.compact = compact; }),
  }),
  'preferences',
  { version: 1 },
);
```

The persisted factory catches unavailable-storage errors. Its default
migration retains fields whose names and basic shapes still match the
current defaults. A changed domain model needs an explicit migration:
matching primitive types does not establish semantic compatibility.

The `persist` surface includes `hasHydrated`, `rehydrate`, `clearStorage`,
`onHydrate`, `onFinishHydration`, `getOptions` and `setOptions`. Check
hydration before rendering a preference-dependent screen; dispose the
hydration listeners on unmount.

For structured migrations, the same subpath exports `runMigrations`,
`createVersionedStorage`, `createVersionedPersistOptions`,
`createMigration`, `createRenameMigration`, `createAddFieldMigration`,
`createRemoveFieldMigration` and `createTransformMigration`.
`validateMigrations` and `getMigrationInfo` help inspect a migration chain.
`exportSettings`, `importSettings`, `checkSettingsVersion`,
`clearSettings` and `createSettingsValidator` support preference import
and recovery. Consult the [API index](../../reference/api-index.mdx)
for each current signature.

## Server rendering and tests

Create request-specific stores on the server; a module-level mutable store
can otherwise share user state between requests. Browser persistence is
available only after hydration. Render a stable initial state on both
sides, then apply persisted preferences.

Test initial state, actions, reload, a version upgrade and unavailable
storage. Use isolated storage keys and reset stores between tests.
Never put passwords, private keys or an authoritative permission decision
in a persisted UI store.
