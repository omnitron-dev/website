---
sidebar_position: 10
title: Testing
description: MockProvider, integration patterns, deterministic fixtures.
---

# Testing

netron-react ships testing utilities that let you drive
components without a real backend.

## `MockProvider`

```tsx
import { MockProvider, mockService } from '@omnitron-dev/netron-react/test';

const usersMock = mockService<UserService>('users', {
  getUser: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.c' }),
  list:    vi.fn().mockResolvedValue([{ id: '1', email: 'a@b.c' }]),
});

render(
  <MockProvider services={[usersMock]}>
    <UserCard userId="1" />
  </MockProvider>
);

await screen.findByText('a@b.c');
expect(usersMock.getUser).toHaveBeenCalledWith('1');
```

No real transport — the mock fakes the entire RPC layer. Hooks
behave identically (`useQuery`, `useMutation`, `useService`).

## Custom mock responses

```tsx
const usersMock = mockService<UserService>('users', {
  getUser: vi.fn((id: string) => {
    if (id === 'missing') {
      throw new TitanError({ code: ErrorCode.NOT_FOUND, message: 'not found' });
    }
    return Promise.resolve({ id, email: `${id}@example.com` });
  }),
});
```

The mock returns / throws exactly what the matching real method
would.

## Mock subscriptions

```tsx
const ordersMock = mockService<OrderService>('orders', {
  watchAll: vi.fn(() => mockAsyncIterable([
    { type: 'created', orderId: '1' },
    { type: 'updated', orderId: '1', status: 'paid' },
  ])),
});
```

`mockAsyncIterable` yields the array contents on demand;
components using `useSubscription` see them in order.

## Multi-backend tests

```tsx
import { MockMultiBackendProvider } from '@omnitron-dev/netron-react/test';

render(
  <MockMultiBackendProvider
    backends={{
      auth: { services: [authMock] },
      media: { services: [mediaMock] },
    }}
    routes={{ 'users.*': 'auth', 'objects.*': 'media' }}
  >
    <Dashboard />
  </MockMultiBackendProvider>
);
```

Mirrors the production `MultiBackendProvider` API — switch
import + you have isolated tests.

## Cache control in tests

```tsx
import { createTestClient } from '@omnitron-dev/netron-react/test';

const client = createTestClient({
  services: [usersMock],
  cache:    { defaultStaleTime: 0, defaultGcTime: 0 },   // disable cache for predictability
});

render(<NetronProvider client={client}><App /></NetronProvider>);
```

Tests with `staleTime: 0` re-fetch on every mount — useful for
asserting "fetched N times" without caching surprises.

## Loading + error states

```tsx
it('shows skeleton while loading', async () => {
  const usersMock = mockService<UserService>('users', {
    getUser: vi.fn(() => new Promise((r) => setTimeout(() => r(user), 100))),
  });

  render(
    <MockProvider services={[usersMock]}>
      <UserCard userId="1" />
    </MockProvider>
  );

  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  await screen.findByText('a@b.c');
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
});

it('shows error on failure', async () => {
  const usersMock = mockService<UserService>('users', {
    getUser: vi.fn().mockRejectedValue(new TitanError({ code: ErrorCode.NOT_FOUND })),
  });

  render(
    <MockProvider services={[usersMock]}>
      <UserCard userId="1" />
    </MockProvider>
  );

  await screen.findByText(/not found/i);
});
```

## Mutation assertions

```tsx
it('calls invite on submit', async () => {
  const user = userEvent.setup();
  const usersMock = mockService<UserService>('users', {
    invite: vi.fn().mockResolvedValue({ id: 'new', email: 'x@y.z' }),
  });

  render(
    <MockProvider services={[usersMock]}>
      <InviteForm />
    </MockProvider>
  );

  await user.type(screen.getByLabelText('Email'), 'x@y.z');
  await user.click(screen.getByRole('button', { name: 'Invite' }));

  await waitFor(() => {
    expect(usersMock.invite).toHaveBeenCalledWith({ email: 'x@y.z' });
  });
});
```

## Suspense + error boundary tests

```tsx
it('falls back to error boundary on render error', () => {
  const usersMock = mockService<UserService>('users', {
    getUser: vi.fn().mockRejectedValue(new Error('boom')),
  });

  render(
    <MockProvider services={[usersMock]}>
      <ErrorBoundary fallback={() => <div>caught</div>}>
        <Suspense fallback={<div>loading</div>}>
          <SuspenseUserCard userId="1" />
        </Suspense>
      </ErrorBoundary>
    </MockProvider>
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
vi.useFakeTimers();

const client = createTestClient({ /* ... */ });
render(<NetronProvider client={client}><Polling /></NetronProvider>);

await screen.findByText('initial');

vi.advanceTimersByTime(30_000);    // trigger refetch interval

await screen.findByText('refreshed');

vi.useRealTimers();
```

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
  use `MockProvider`.
- **Stale mocks shared across tests.** State leaks; mysterious
  failures.
- **Testing implementation details.** "Calls `setQueryData`"
  is fragile; "shows the updated value" is robust.
- **Real backend in unit tests.** Slow, flaky, hard to seed —
  reserve for integration suite.

## See also

- [netron-react](./react.md) — hooks under test
- [Multi-backend](./multi-backend.md) — `MockMultiBackendProvider`
- [Caching](./caching.md) — `staleTime` tuning for tests
