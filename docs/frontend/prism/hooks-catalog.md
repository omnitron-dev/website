---
sidebar_position: 6
title: Hooks catalog
description: The 48 React hooks exported from @omnitron-dev/prism/hooks.
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
const { value, push, removeAt, updateAt, clear } = useArray<Todo>([]);

<Button onClick={() => push({ id: '1', text: 'Buy milk' })}>Add</Button>
<Button onClick={() => removeAt(0)}>Remove first</Button>
<Button onClick={() => updateAt(0, { id: '1', text: 'Buy oat milk' })}>Update</Button>
<Button onClick={clear}>Clear</Button>
```

The current array is `value` (not `items`). Returns:

| Member | Effect |
| ------ | ------ |
| `value` | Current array |
| `setValue(items)` | Replace entire array |
| `push(item)` | Append |
| `pushMany(items)` | Append many |
| `remove(itemOrPredicate)` | Remove first matching value or predicate |
| `removeAt(index)` | Remove at index |
| `removeWhere(pred)` | Remove all matching predicate |
| `updateAt(index, item)` | Replace at index |
| `updateAtPartial(index, partial)` | Merge partial at index |
| `updateWhere(pred, update)` | Update all matching predicate |
| `insertAt(index, item)` | Insert at index |
| `move(from, to)` | Reorder |
| `swap(a, b)` | Swap two indices |
| `clear()` | Reset to `[]` |
| `reset()` | Reset to initial value |
| `reverse()` / `sort(cmp?)` | Reorder in place |

Plus non-mutating helpers (`filter`, `find`, `findIndex`, `includes`) and
computed reads (`length`, `isEmpty`, `first`, `last`).

### `useAsync<T>`

Lifecycle-safe async state — handles unmount-during-fetch.

```tsx
const { data, loading, error, execute, reset } = useAsync(
  async (id: string) => fetchUser(id),
  { immediate: false },
);

useEffect(() => { execute(userId); }, [userId]);

if (loading)        return <Spinner />;
if (error)          return <ErrorCard error={error} />;
return <UserCard user={data!} />;
```

Returns `{ data, loading, error, execute, reset, setData, setError }`.
Options: `{ initialData, immediate, onSuccess, onError }`. Unmount
before resolve → state never updates (no leak warnings). For a
fire-and-forget variant without data tracking, see `useAsyncFn`
(`{ execute, loading, error }`).

### `useUpdateEffect`

`useEffect` that skips the first render — useful for "react to
prop change but not initial mount":

```tsx
useUpdateEffect(() => {
  track('filter.changed', { filter });
}, [filter]);
```

### `useSessionStorage<T>` / `useCookies`

Reactive storage mirrors. Both return an object (not a `[value, setValue]`
tuple):

```tsx
const { state: draft, setState: setDraft, remove } =
  useSessionStorage<Draft | null>('post-draft', null);

// Single key; supports object values with partial/field updates.
const { state, setState, setField } = useCookies('theme', 'dark', {
  maxAge: 365 * 86400,
  path: '/',
});
```

`useSessionStorage` returns `{ state, setState, remove, hasValue }` and
survives reloads within the tab session. `useCookies(key, initialState,
options)` returns `{ state, setState, setField, resetState }` — it manages
a single cookie key, not a list. Pairs with `useLocalStorage` (re-exported
from `@omnitron-dev/prism/hooks`).

### `useConfigFromQuery`

Syncs **theme configuration** (preset / mode / primary / direction /
density / contrast) with URL query params — for shareable demo/preview
links. It is not a generic schema-driven query-state hook.

```tsx
const {
  configFromUrl,   // parsed UrlConfigValues from the current URL
  updateUrl,       // (partial) => void — writes via history.replaceState
  clearUrl,        // () => void — strips all recognised params
  generateUrl,     // (partial, baseUrl?) => string — build a share link
  hasUrlConfig,    // boolean
} = useConfigFromQuery({
  onConfigChange: (cfg) => {
    if (cfg.preset) setPreset(cfg.preset);
    if (cfg.mode)   setMode(cfg.mode);
  },
});

const shareUrl = generateUrl({ preset: 'luxury', mode: 'dark' });
```

Recognised params: `preset`, `mode`, `primary` (hex), `dir`, `density`,
`contrast` (rename via the `paramNames` option). For arbitrary typed
query-state, parse `URLSearchParams` yourself or use a router loader.

## Timers & lifecycle

### `useCountdownDate` / `useCountdownSeconds`

```tsx
// Returns formatted, zero-padded strings (no isExpired flag).
const { days, hours, minutes, seconds } = useCountdownDate(deadline);

// Returns control object; call start() to begin (does not auto-start).
const { value, start, reset, isCounting, setValue } = useCountdownSeconds(60);
```

`useCountdownDate(date, placeholder?)` counts down to a specific
timestamp, ticking every second and returning two-digit strings.
`useCountdownSeconds(n)` is a manually-started countdown (ideal for OTP
resend timers) — it stays at `n` until you call `start()`.

### `useThrottle<T>`

Throttle a fast-changing value to at most one update per `ms`:

```tsx
const throttled = useThrottle(scrollY, 100);
```

Differs from debounce — throttle emits the leading edge then at
most one per window.

### `useOnlineStatus`

Reactive `navigator.onLine`. Returns an object, not a bare boolean:

```tsx
const { isOnline, isOffline, lastChanged } = useOnlineStatus();
if (isOffline) return <OfflineBanner />;
```

Listens to `online` + `offline` events (SSR-safe via
`useSyncExternalStore`).

## Layout & sizing

### `useClientRect`

Bounding rect + scroll dimensions. The hook provides the ref:

```tsx
const { elementRef, width, height, top, left } = useClientRect<HTMLDivElement>();

<div ref={elementRef}>Width: {width}px</div>
```

Values default to `0` (never null) and update on resize / scroll.

### `useWindowSize`

```tsx
const { width, height, isMobile, isTablet, isDesktop } = useWindowSize();
```

Debounced internally (100 ms by default) to avoid render thrash, and
exposes MUI-aligned breakpoint booleans.

### `useScrollPosition` / `useScrollOffsetTop`

```tsx
const { x, y, directionY, isScrolled, isAtBottom } = useScrollPosition();
const { offsetTop } = useScrollOffsetTop(200);   // offsetTop is the boolean

<TopBar elevation={offsetTop ? 4 : 0} />
```

`useScrollPosition` returns scroll `x` / `y` (not `scrollX` / `scrollY`)
plus direction + edge flags. `useScrollOffsetTop(defaultValue)` returns
`{ offsetTop, elementRef }` — attach `elementRef` to track an element's
offset instead of a fixed pixel value.

### `useBackToTop`

Returns visibility state + a scroll-to-top handler. The threshold is a
positional arg — a `'NN%'` string (scroll progress) or a pixel number
(distance from bottom); default `'90%'`:

```tsx
const { isVisible, onBackToTop } = useBackToTop('90%');
{isVisible && <Fab onClick={onBackToTop} />}
```

### `useImageDimensions`

```tsx
const { dimensions, loading, error } = useImageDimensions(src);
// dimensions: { width, height, aspectRatio } | null
```

## Visibility & focus

### `useIntersectionObserver`

The hook returns the `ref` callback to attach (it does not take a ref arg):

```tsx
const { ref, isIntersecting } = useIntersectionObserver({
  threshold: 0.5,
  rootMargin: '100px',
  triggerOnce: true,
});

<div ref={ref}>{isIntersecting && <Image src={src} />}</div>
```

Returns `{ ref, entry, isIntersecting, disconnect }`. Foundation for
lazy-loading patterns.

### `useInfiniteScroll`

Takes a page-fetch function (not a `hasMore`/`onLoadMore` config) and
owns the paging state itself:

```tsx
const { items, isFetchingMore, hasNextPage, fetchNextPage, sentinelRef } =
  useInfiniteScroll<Row>(
    async ({ cursor, pageSize }) => {
      const res = await api.list({ cursor, limit: pageSize });
      return { items: res.rows, pageInfo: { hasNextPage: res.hasMore, endCursor: res.next } };
    },
    { pageSize: 20 },
  );

<>
  {items.map(i => <Row key={i.id} {...i} />)}
  <div ref={sentinelRef}>{isFetchingMore && <Spinner />}</div>
</>
```

The fetch fn returns `{ items, pageInfo: { hasNextPage, endCursor } }`;
the hook flattens pages into `items` and auto-loads when `sentinelRef`
intersects. Use sparingly — pagination is friendlier than infinite
scroll for most apps.

### `useFocusTrap`

The hook returns `{ ref, focusFirst, focusLast }` — destructure `ref`.
The activation option is `enabled` (not `active`):

```tsx
const { ref } = useFocusTrap<HTMLDivElement>({ enabled: open });

<div ref={ref}>
  <TextField autoFocus />
  <Button>Save</Button>
  <Button>Cancel</Button>
</div>
```

Traps Tab navigation inside the container (options: `enabled`,
`autoFocus`, `restoreFocus`, `focusableSelector`). The modal / drawer /
dialog components use this internally.

### `useKeyboardShortcut`

The shortcut is a descriptor object `{ key, ctrl?, shift?, alt?, meta? }`
(one per call), not a `'cmd+k'` string or an array:

```tsx
useKeyboardShortcut({ key: 'k', ctrl: true }, () => commandPalette.open(), {
  preventDefault: true,
  ignoreInputs: true,
});

useKeyboardShortcut({ key: '?', shift: true }, () => helpDrawer.open());
```

`ctrl: true` matches Ctrl or Cmd. Set `ignoreInputs: true` to suppress
the shortcut while focus is in an input / textarea / contenteditable
(off by default); `enabled` toggles the listener entirely.

## Interaction

### `useDoubleClick`

Distinguish single from double click (built-in delay so single
clicks fire only after the double-click window). Options are `click`,
`doubleClick`, `timeout`; the hook returns a single click handler:

```tsx
const handleClick = useDoubleClick({
  click:       () => select(item),
  doubleClick: () => navigate(`/items/${item.id}`),
  timeout:     250,
});

<div onClick={handleClick} />
```

### `useLazyQuery`

Trigger a query on demand rather than on mount. Pass a query function;
call `query(variables)` to run it:

```tsx
const { query, data, isLoading, isSuccess } = useLazyQuery(
  (q: string) => searchApi(q),
  { cacheTime: 60_000 },
);

<>
  <SearchInput value={q} onChange={setQ} debounce={300} />
  <Button onClick={() => query(q)}>Search</Button>
  {isSuccess && <Results items={data!.items} />}
</>
```

Returns `{ data, error, isLoading, isSuccess, isError, isCalled,
isFetching, isRefetching, query, refetch, reset, setData }` with optional
`cacheTime` / `staleTime` / `retry`.

### `useMutation` (Prism's)

```tsx
// useMutation(mutationFn, options) — mutationFn is the first positional arg.
const save = useMutation(
  (data) => api.save(data),
  {
    onMutate:  (data) => { setLocal(data); toast.info('Saving…'); },      // optimistic update
    onSuccess: () => toast.success('Saved'),
    onError:   (e) => { setLocal(previous); toast.error(`Save failed: ${e.message}`); }, // rollback
  },
);

<Button onClick={() => save.mutate(values)} disabled={save.isLoading}>
  Save
</Button>
```

Prism's `useMutation` returns `{ mutate, isLoading, isSuccess, isError,
isIdle, data, error, reset }` — do optimistic updates in `onMutate` and roll
back in `onError` (there are no separate `optimistic`/`rollback` options).

For RPC mutations, prefer `useMutation` from
`@omnitron-dev/netron-react` — it integrates with the cache.
The Prism version is for non-RPC operations.

### `usePopoverHover`

Hover-managed popover open state. Returns the trigger ref + open/close
handlers + anchor element (no `triggerProps` / `popoverProps` bundles):

```tsx
const { open, anchorEl, onOpen, onClose, elementRef } =
  usePopoverHover<HTMLDivElement>();

<Box ref={elementRef} onMouseEnter={onOpen} onMouseLeave={onClose}>
  <Avatar />
</Box>
<Popover open={open} anchorEl={anchorEl} onClose={onClose}>
  <UserCard />
</Popover>
```

### `usePasswordVisibility`

Returns `{ visible, toggle, show, hide, type }` (state + helpers, not a
prebuilt button). Wire `type` and `toggle` into your own adornment:

```tsx
const { type, visible, toggle } = usePasswordVisibility();

<TextField
  type={type}
  slotProps={{
    input: {
      endAdornment: (
        <IconButton onClick={toggle} aria-label="Toggle password visibility">
          {visible ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      ),
    },
  }}
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

| Hook | Component / area |
| ---- | --------- |
| `useMenu` | `<Menu>` (from `@omnitron-dev/prism`) |
| `useSnackbar` | `<Snackbar>` |
| `useLightbox` | `<Lightbox>` — open and index only; the component owns its zoom |
| `useChart` | `<Chart>` |
| `usePrismContext` | `<PrismProvider>` (from `/core`) |
| `useSettingsStore` | settings / theme mode / density (from `/state`) |
| `useLayoutContext` | layouts (from `/layouts`) |

`useCarousel` is deliberately absent from that table. It exports
carousel state — index, bounds, autoplay — for a slider you render
yourself, and it does **not** drive `<Carousel>`: that component keeps
its own copy of the same state and takes no controlled props, so nothing
you do with the hook can move it. Use one or the other.

Dark mode is driven through `useSettingsStore` (`mode`, `setMode`,
`toggleMode`) — there is no `useColorMode` hook. `<ConfirmDialog>` and
`<CommandPalette>` are component-only (no companion `use*` hook).

## Composition patterns

Hooks compose freely:

```tsx
function ProductGrid({ filters }: { filters: ProductFilters }) {
  const { items, isFetchingMore, fetchNextPage, sentinelRef } =
    useInfiniteScroll<Product>(
      async ({ cursor, pageSize }) => {
        const res = await api.list({ ...filters, cursor, limit: pageSize });
        return { items: res.items, pageInfo: { hasNextPage: res.hasMore, endCursor: res.nextCursor } };
      },
      { pageSize: 24 },
    );

  return (
    <Stack>
      <Grid>
        {items.map(p => <ProductCard key={p.id} {...p} />)}
      </Grid>
      <div ref={sentinelRef}>
        {isFetchingMore && <Spinner />}
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


## Also exported

Twenty-one further hooks are exported from `@omnitron-dev/prism/hooks` and had
no entry here. They are listed with their real signatures rather than written
up with invented examples — the point of this section is that they exist and
can be found, which is what was missing.

### State

| Hook | Signature | What it does |
| ---- | --------- | ------------ |
| `useSetState` | `<T extends Record<string, unknown>>(initial: T \| (() => T))` | `setState` with partial updates, like a class component's |
| `useMultiSelect` | `<T>(options?: UseMultiSelectOptions<T>)` | Multi-selection state — select, deselect, toggle, select-all |
| `usePrevious` | `<T>(value: T): T \| undefined` | The value from the previous render |
| `useCopyToClipboard` | `(options?: UseCopyToClipboardOptions)` | Copy with a `copied` flag that resets itself |

### Timers and lifecycle

| Hook | Signature | What it does |
| ---- | --------- | ------------ |
| `useCountdown` | `(options: UseCountdownOptions)` | Countdown from a duration; see also `useCountdownDate` / `useCountdownSeconds` above |
| `useTimeout` | `(callback: () => void, delay: number)` | `setTimeout` that survives a changing callback and clears on unmount |
| `useDebounceCallback` | `<T extends (...args: never[]) => unknown>(fn: T, delay = 500)` | Debounces the call, where `useDebounce` debounces the value |
| `useThrottleCallback` | `<T extends (...args: unknown[]) => unknown>(fn: T, delay: number)` | The callback counterpart of `useThrottle` |
| `useMounted` | `(): UseMountedReturn` | Whether the component is still mounted — for guarding async completions |
| `useUpdateLayoutEffect` | `(effect: EffectCallback, deps?: DependencyList)` | `useLayoutEffect` that skips the first render |

### Layout and sizing

| Hook | Signature | What it does |
| ---- | --------- | ------------ |
| `useBreakpoint` | `(custom?: Partial<Breakpoints>): 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | The current breakpoint as one value |
| `useBreakpointChecks` | `(custom?: Partial<Breakpoints>): BreakpointChecks` | The same, as a set of booleans to branch on |
| `useMediaQuery` | `(query: string): boolean` | One media query |
| `useResponsiveQuery` | `(query: string): UseResponsiveQueryReturn` | A media query with its match state broken out |
| `useScrollLock` | `(): { lock, unlock, isLocked }` | Locks body scroll — what a modal needs |
| `useScrollToTop` | `(options?: { threshold?: number })` | `scrollToTop` plus whether the button should show |
| `useMultipleImageDimensions` | `(urls: (string \| null \| undefined)[], options?)` | Dimensions of several images at once |

### Pointer and keyboard

| Hook | Signature | What it does |
| ---- | --------- | ------------ |
| `useClickOutside` | `<T extends HTMLElement>(handler: (e: MouseEvent \| TouchEvent) => void)` | Fires when a click lands outside the returned ref |
| `usePopover` | `<T extends HTMLElement>(): UsePopoverReturn<T>` | Anchor + open state for a popover, without a component |
| `useEnterKey` | `(callback: (e: KeyboardEvent) => void, options?)` | Enter, over `useKeyboardShortcut` |
| `useEscapeKey` | `(callback: (e: KeyboardEvent) => void, options?)` | Escape, over `useKeyboardShortcut` |

Hooks named on other pages — `useSnackbar`, `useLightbox`, `useCarousel`,
`useChart`, `useMenu`, `usePrismContext`, `useLayoutContext`,
`useSettingsStore` — are exported from `/components`, `/core`, `/layouts` and
`/state` rather than from `/hooks`, which is why they are not in this list.
