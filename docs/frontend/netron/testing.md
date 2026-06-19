---
sidebar_position: 10
title: Testing
description: TestNetronProvider, integration patterns, deterministic fixtures.
---

# Testing

netron-react ships testing utilities (under
`@omnitron-dev/netron-react/test`) that let you drive components
without a real backend.

## `TestNetronProvider`

```tsx
import { TestNetronProvider } from '@omnitron-dev/netron-react/test';

render(
  <TestNetronProvider
    testConfig={{
      mocks: [
        { service: 'users', method: 'getUser', response: { id: '1', email: 'a@b.c' } },
        { service: 'users', method: 'list',    response: [{ id: '1', email: 'a@b.c' }] },
      ],
    }}
  >
    <UserCard userId="1" />
  </TestNetronProvider>
);

await screen.findByText('a@b.c');
```

No real transport — `TestNetronProvider` builds a test client
(via `createTestClient`) whose `invoke` is intercepted by the
`mocks` array. Hooks behave identically (`useQuery`,
`useMutation`, `useService`).

Each mock entry is a `MockResponse`: `{ service, method, response?,
error?, delay? }`. Provide `error` to make the matching call
reject, and `delay` to simulate latency.

## Custom mock responses

Each entry in `mocks` returns a **static** `response` for one
`service.method`. To branch on arguments, override the client's
`invoke` — it's a plain method. `createMockService` builds an
object of async method implementations you can dispatch to:

```tsx
import { createTestClient, createMockService, TestNetronProvider }
  from '@omnitron-dev/netron-react/test';

const usersMock = createMockService<UserService>({
  getUser: async (id: string) => {
    if (id === 'missing') {
      throw new TitanError({ code: ErrorCode.NOT_FOUND, message: 'not found' });
    }
    return { id, email: `${id}@example.com` };
  },
});

const client = createTestClient();
// Dispatch every call to the mock service object:
client.invoke = (async (_service, method, args) =>
  (usersMock as Record<string, (...a: unknown[]) => Promise<unknown>>)[method](...args)
) as typeof client.invoke;

render(
  <TestNetronProvider client={client}>
    <UserCard userId="missing" />
  </TestNetronProvider>
);
```

`createMockService(implementations)` returns a plain object of
async methods. It is **not** auto-wired into the provider —
dispatch to it via `invoke` as above (or pass `vi.fn()`
implementations so you can assert calls).

## Mock latency

```tsx
render(
  <TestNetronProvider
    testConfig={{
      mocks: [
        { service: 'orders', method: 'getOrder', response: order, delay: 100 },
      ],
    }}
  >
    <OrderCard orderId="1" />
  </TestNetronProvider>
);
```

A per-mock `delay` (or `testConfig.defaultDelay`) lets you assert
intermediate loading states before the response settles.

## Multi-backend tests

For multi-backend apps, build a `MultiBackendProvider` around a
mock multi-backend client in your test setup — the test utils
focus on the single-client path; the multi-backend hooks
(`useBackendService`, …) read from whatever
`<MultiBackendProvider>` you supply.

```tsx
import { MultiBackendProvider } from '@omnitron-dev/netron-react';

render(
  <MultiBackendProvider client={mockMultiBackendClient} autoConnect={false}>
    <Dashboard />
  </MultiBackendProvider>
);
```

See [Multi-backend](./multi-backend.md) for the production
`MultiBackendProvider` API the mock client must satisfy.

## Cache control in tests

```tsx
import { createTestClient, TestNetronProvider }
  from '@omnitron-dev/netron-react/test';

const client = createTestClient({
  mocks:  [{ service: 'users', method: 'getUser', response: user }],
  config: { cache: { staleTime: 0, cacheTime: 0 } },   // disable cache for predictability
});

render(<TestNetronProvider client={client}><App /></TestNetronProvider>);
```

`createTestClient(config?)` builds the client; pass cache tuning
through `config`. With `staleTime: 0`, every mount re-fetches —
useful for asserting "fetched N times" without caching surprises.

## Loading + error states

```tsx
it('shows skeleton while loading', async () => {
  render(
    <TestNetronProvider
      testConfig={{
        mocks: [{ service: 'users', method: 'getUser', response: user, delay: 100 }],
      }}
    >
      <UserCard userId="1" />
    </TestNetronProvider>
  );

  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  await screen.findByText('a@b.c');
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
});

it('shows error on failure', async () => {
  render(
    <TestNetronProvider
      testConfig={{
        mocks: [{
          service: 'users',
          method:  'getUser',
          error:   new TitanError({ code: ErrorCode.NOT_FOUND }),
        }],
      }}
    >
      <UserCard userId="1" />
    </TestNetronProvider>
  );

  await screen.findByText(/not found/i);
});
```

## Mutation assertions

Spy on the client's `invoke` to assert a mutation fired with the
right arguments — the proxy calls `invoke(service, method, args)`:

```tsx
it('calls invite on submit', async () => {
  const user   = userEvent.setup();
  const client = createTestClient({
    mocks: [{ service: 'users', method: 'invite', response: { id: 'new', email: 'x@y.z' } }],
  });
  const invokeSpy = vi.spyOn(client, 'invoke');

  render(
    <TestNetronProvider client={client}>
      <InviteForm />
    </TestNetronProvider>
  );

  await user.type(screen.getByLabelText('Email'), 'x@y.z');
  await user.click(screen.getByRole('button', { name: 'Invite' }));

  await waitFor(() => {
    expect(invokeSpy).toHaveBeenCalledWith('users', 'invite', ['x@y.z'], expect.anything());
  });
});
```

`useMutation` exposes `isLoading` while the mutation is in flight
(plus `isSuccess` / `isError` / `data`).

## Suspense + error boundary tests

Suspense is the `suspense: true` option on `useQuery` — it makes
the hook throw the in-flight fetch to the nearest `<Suspense>`,
and escalates errors to the nearest error boundary:

```tsx
it('falls back to error boundary on render error', () => {
  render(
    <TestNetronProvider
      testConfig={{
        mocks: [{ service: 'users', method: 'getUser', error: new Error('boom') }],
      }}
    >
      <ErrorBoundary fallback={() => <div>caught</div>}>
        <Suspense fallback={<div>loading</div>}>
          {/* SuspenseUserCard calls useQuery([...], { suspense: true }) */}
          <SuspenseUserCard userId="1" />
        </Suspense>
      </ErrorBoundary>
    </TestNetronProvider>
  );

  return waitFor(() => expect(screen.getByText('caught')).toBeInTheDocument());
});
```

## Integration tests against a real backend

For higher confidence, point tests at a running Titan dev
server:

```tsx
import { NetronReactClient, NetronProvider } from '@omnitron-dev/netron-react';

const realClient = new NetronReactClient({
  url:       process.env.TEST_API_URL ?? 'http://localhost:3001',
  transport: 'http',
});

beforeAll(async () => {
  await realClient.connect();
  // Seed test data via direct RPC
  await realClient.invoke('test-utils', 'reset', []);
});

afterAll(() => realClient.disconnect());

it('full flow', async () => {
  render(<NetronProvider client={realClient}><SignInForm /></NetronProvider>);
  // ...
});
```

Run alongside the omnitron daemon's `test` stack:

```bash
omnitron stack start my-project test
pnpm test:integration
omnitron stack stop my-project test
```

## Deterministic clock

For time-sensitive behaviour (`refetchInterval`, retries,
debounce):

```tsx
import { createTestClient, advanceTimersAndFlush }
  from '@omnitron-dev/netron-react/test';

vi.useFakeTimers();

const client = createTestClient({ /* ... */ });
render(<NetronProvider client={client}><Polling /></NetronProvider>);

await screen.findByText('initial');

await advanceTimersAndFlush(30_000);    // trigger refetch interval + flush microtasks

await screen.findByText('refreshed');

vi.useRealTimers();
```

`advanceTimersAndFlush(ms)` advances vitest fake timers and
flushes pending microtasks; `nextTick()` awaits a single tick.

## Best practices

- **Mock per test file**, not globally. Sharing mocks across
  tests causes order dependencies.
- **Reset mocks** (`vi.clearAllMocks()`) in `beforeEach` if you
  share across `it` blocks.
- **Assert calls + UI**. Calling-the-mock isn't proof; the
  user-visible result is.
- **`staleTime: 0`** in tests for predictability.
- **One test per behaviour**, not per method. "Shows loading,
  then data" + "shows error on failure" are two tests.
- **Integration tests** for the critical happy path; unit
  tests with mocks for edge cases.

## Anti-patterns

- **Mocking `fetch` directly.** Bypasses the client logic;
  use `TestNetronProvider`.
- **Stale mocks shared across tests.** State leaks; mysterious
  failures.
- **Testing implementation details.** "Calls `cache.set`"
  is fragile; "shows the updated value" is robust.
- **Real backend in unit tests.** Slow, flaky, hard to seed —
  reserve for integration suite.

## See also

- [netron-react](./react.md) — hooks under test
- [Multi-backend](./multi-backend.md) — `MultiBackendProvider`
- [Caching](./caching.md) — `staleTime` tuning for tests
