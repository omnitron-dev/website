---
sidebar_position: 6
title: Hooks catalog
description: 25+ production-ready React hooks shipped with Prism.
---

# Hooks catalog

`@omnitron-dev/prism/hooks` ships hooks used internally by the
components and exposed for your code. All SSR-safe via
`useIsomorphicLayoutEffect` where needed.

```tsx
import { useArray, useAsync, useKeyboardShortcut } from '@omnitron-dev/prism/hooks';
```

## State & data

### `useArray<T>`

Reactive array operations without manual setState:

```tsx
const { items, push, remove, replace, clear } = useArray<Todo>([]);

<Button onClick={() => push({ id: '1', text: 'Buy milk' })}>Add</Button>
<Button onClick={() => remove(0)}>Remove first</Button>
<Button onClick={() => replace(0, { id: '1', text: 'Buy oat milk' })}>Update</Button>
<Button onClick={clear}>Clear</Button>
```

Returns:

| Method | Effect |
| ------ | ------ |
| `push(item)` | Append |
| `unshift(item)` | Prepend |
| `pop()` | Remove last |
| `shift()` | Remove first |
| `remove(index)` | Remove at index |
| `removeBy(pred)` | Remove first matching predicate |
| `replace(index, item)` | Replace at index |
| `replaceBy(pred, item)` | Replace first matching |
| `move(from, to)` | Reorder |
| `clear()` | Reset to `[]` |
| `set(items)` | Replace entire array |

### `useAsync<T>`

Lifecycle-safe async state — handles unmount-during-fetch.

```tsx
const { value, error, status, run, reset } = useAsync(
  async (id: string) => fetchUser(id),
  { immediate: false },
);

useEffect(() => { run(userId); }, [userId]);

if (status === 'pending') return <Spinner />;
if (status === 'error')   return <ErrorCard error={error} />;
return <UserCard user={value!} />;
```

Statuses: `'idle' | 'pending' | 'success' | 'error'`. Unmount
before resolve → state never updates (no leak warnings).

### `useUpdateEffect`

`useEffect` that skips the first render — useful for "react to
prop change but not initial mount":

```tsx
useUpdateEffect(() => {
  track('filter.changed', { filter });
}, [filter]);
```

### `useSessionStorage<T>` / `useCookies`

Reactive storage mirrors:

```tsx
const [draft, setDraft] = useSessionStorage<Draft | null>('post-draft', null);

const cookies = useCookies(['session', 'theme']);
cookies.set('theme', 'dark', { maxAge: 365 * 86400, path: '/' });
```

`useSessionStorage` survives only the tab session; persists
through reloads. Pairs with `useLocalStorage` (in
`@omnitron-dev/prism/state` for typed stores).

### `useConfigFromQuery<T>`

Reads URL query params into a typed config object:

```tsx
const config = useConfigFromQuery({
  schema: z.object({
    tab:    z.enum(['overview', 'logs', 'metrics']).default('overview'),
    range:  z.enum(['1h', '24h', '7d']).default('24h'),
    grep:   z.string().optional(),
  }),
});

config.tab;     // 'overview' | 'logs' | 'metrics'
config.range;   // '1h' | '24h' | '7d'
config.setConfig({ tab: 'logs' });  // updates URL
```

Roundtrip URL ↔ state without manual `URLSearchParams`
parsing.

## Timers & lifecycle

### `useCountdownDate` / `useCountdownSeconds`

```tsx
const { days, hours, minutes, seconds, isExpired } = useCountdownDate(deadline);

const { remaining, isExpired } = useCountdownSeconds(60);
```

`useCountdownDate(date)` counts down to a specific timestamp;
`useCountdownSeconds(n)` counts down N seconds from mount. Both
tick every second.

### `useThrottle<T>`

Throttle a fast-changing value to at most one update per `ms`:

```tsx
const throttled = useThrottle(scrollY, 100);
```

Differs from debounce — throttle emits the leading edge then at
most one per window.

### `useOnlineStatus`

Reactive `navigator.onLine`:

```tsx
const online = useOnlineStatus();
if (!online) return <OfflineBanner />;
```

Listens to `online` + `offline` events.

## Layout & sizing

### `useClientRect`

Element rect with `ResizeObserver`:

```tsx
const ref = useRef<HTMLDivElement>(null);
const rect = useClientRect(ref);

<div ref={ref}>Width: {rect?.width}px</div>
```

Updates on resize / layout shift.

### `useWindowSize`

```tsx
const { width, height } = useWindowSize();
```

Debounced internally (16 ms) to avoid render thrash.

### `useScrollPosition` / `useScrollOffsetTop`

```tsx
const { scrollY, scrollX } = useScrollPosition();
const isScrolledPast = useScrollOffsetTop(200);   // boolean

<TopBar elevation={isScrolledPast ? 4 : 0} />
```

### `useBackToTop`

Returns `true` once deep-scrolled (default > 1.5× viewport
height):

```tsx
const show = useBackToTop({ threshold: 800 });
{show && <ScrollToTop />}
```

### `useImageDimensions`

```tsx
const { width, height } = useImageDimensions(src);
// natural dimensions; useful for aspect-ratio containers
```

## Visibility & focus

### `useIntersectionObserver`

```tsx
const ref = useRef(null);
const { isIntersecting } = useIntersectionObserver(ref, {
  threshold: 0.5,
  rootMargin: '100px',
});

{isIntersecting && <Image src={src} />}
```

Foundation for lazy-loading patterns.

### `useInfiniteScroll`

```tsx
const { sentinelRef, isFetching } = useInfiniteScroll({
  hasMore:    pages.hasNextPage,
  onLoadMore: pages.fetchNextPage,
  threshold:  '200px',
});

<>
  {items.map(i => <Row key={i.id} {...i} />)}
  <div ref={sentinelRef}>{isFetching && <Spinner />}</div>
</>
```

Wraps `useIntersectionObserver` + a load-more callback. Use
sparingly — pagination is friendlier than infinite scroll for
most apps.

### `useFocusTrap`

```tsx
const ref = useFocusTrap<HTMLDivElement>({ active: open });

<div ref={ref}>
  <Input autoFocus />
  <Button>Save</Button>
  <Button>Cancel</Button>
</div>
```

Traps Tab navigation inside the container. The modal /
drawer / dialog components use this internally.

### `useKeyboardShortcut`

```tsx
useKeyboardShortcut(['cmd+k', 'ctrl+k'], () => commandPalette.open(), {
  preventDefault: true,
  enabled: !inputFocused,
});

useKeyboardShortcut('?', () => helpDrawer.open());

useKeyboardShortcut(['shift+/'], () => helpDrawer.open());
```

Disables itself when an input is focused unless `enabled: true`.

## Interaction

### `useDoubleClick`

Distinguish single from double click (built-in delay so single
clicks fire only after the double-click window):

```tsx
const handlers = useDoubleClick({
  onSingleClick: () => select(item),
  onDoubleClick: () => navigate(`/items/${item.id}`),
  delay: 250,
});

<div {...handlers} />
```

### `useLazyQuery`

Trigger a query on demand rather than on mount:

```tsx
const { run, value, status } = useLazyQuery(() =>
  searchService.search.useQuery([{ q: query }]),
);

<>
  <Input value={query} onChange={(e) => setQuery(e.target.value)} />
  <Button onClick={run}>Search</Button>
  {status === 'success' && <Results items={value!.items} />}
</>
```

### `useMutation` (Prism's)

```tsx
const save = useMutation({
  mutationFn:   (data) => api.save(data),
  onMutate:     () => toast.info('Saving…'),
  onSuccess:    () => toast.success('Saved'),
  onError:      (e) => toast.error(`Save failed: ${e.message}`),
  optimistic:   (data) => setLocal(data),
  rollback:     () => setLocal(previous),
});

<Button onClick={() => save.run(values)} disabled={save.isPending}>
  Save
</Button>
```

For RPC mutations, prefer `useMutation` from
`@omnitron-dev/netron-react` — it integrates with the cache.
The Prism version is for non-RPC operations.

### `usePopoverHover`

Hover-managed popover open state with intent delay:

```tsx
const popover = usePopoverHover({ enterDelay: 200, leaveDelay: 200 });

<Box {...popover.triggerProps}>
  <Avatar />
</Box>
<Popover {...popover.popoverProps}>
  <UserCard />
</Popover>
```

### `usePasswordVisibility`

```tsx
const { type, visible, toggle, IconButton } = usePasswordVisibility();

<Field
  type={type}
  endAdornment={<IconButton onClick={toggle} aria-label="Toggle password visibility" />}
/>
```

## SSR & isomorphism

### `useIsomorphicLayoutEffect`

`useLayoutEffect` on client; `useEffect` on server — avoids
SSR warnings:

```tsx
useIsomorphicLayoutEffect(() => {
  // DOM measurement / sync state
}, [deps]);
```

Use whenever your effect needs synchronous post-render execution
and you SSR.

## Hooks used internally by components

These are exposed but typically consumed via the matching
component:

| Hook | Component |
| ---- | --------- |
| `useMenu` | `<Menu>` |
| `useSnackbar` | `<Snackbar>` |
| `useConfirmDialog` | `<ConfirmDialog>` |
| `useLightbox` | `<Lightbox>` |
| `useCommandPalette` | `<CommandPalette>` |
| `useChart` | `<Chart>` |
| `usePrismContext` | `<PrismProvider>` |
| `useColorMode` | theme/dark-mode |
| `useSettingsStore` | `<Settings>` |
| `useLayoutContext` | layouts |

## Composition patterns

Hooks compose freely:

```tsx
function ProductGrid() {
  const filters = useConfigFromQuery({ schema: FilterSchema });
  const products = useAsync(() => api.list(filters));
  const sentinelRef = useInfiniteScroll({
    hasMore: products.value?.hasMore ?? false,
    onLoadMore: () => products.run({ ...filters, after: products.value?.nextCursor }),
  });

  return (
    <Stack>
      <FilterToolbar value={filters} onChange={filters.setConfig} />
      <Grid>
        {products.value?.items.map(p => <ProductCard key={p.id} {...p} />)}
      </Grid>
      <div ref={sentinelRef.sentinelRef}>
        {sentinelRef.isFetching && <Spinner />}
      </div>
    </Stack>
  );
}
```

## See also

- [Components catalog](./components.md) — components paired
  with these hooks
- [Forms](./forms.md) — hooks used in form patterns
- [netron-react hooks](../netron/react.md) — RPC-specific hooks
  (use those, not these, for data fetching from a Titan backend)
