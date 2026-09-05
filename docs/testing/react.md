---
sidebar_position: 5
title: React testing
description: Testing React components that call Netron — TestNetronProvider patterns.
---

# React testing

Components built on `netron-react` need RPC mocks; Prism
components need a `<PrismProvider>`. This page covers both with
patterns that scale.

## TestNetronProvider + multi-backend

| Provider | When |
| -------- | ---- |
| **`TestNetronProvider`** (from `@omnitron-dev/netron-react/test`) | Single-backend tests |
| **`MultiBackendProvider`** (from `@omnitron-dev/netron-react`, fed a mock client) | Multi-backend tests |

`TestNetronProvider` builds a `NetronReactClient` substitute
(via `createTestClient`) that intercepts RPC calls and returns
the canned data from its `mocks`.

## Single-backend mock

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestNetronProvider } from '@omnitron-dev/netron-react/test';
import { UserCard } from './UserCard.js';

describe('UserCard', () => {
  it('renders user email', async () => {
    render(
      <TestNetronProvider
        testConfig={{
          mocks: [
            { service: 'users', method: 'getUser', response: { id: '1', email: 'a@b.c' } },
          ],
        }}
      >
        <UserCard userId="1" />
      </TestNetronProvider>
    );

    await screen.findByText('a@b.c');
  });
});
```

Two pieces:

- **`testConfig.mocks`** — an array of `MockResponse` entries
  (`{ service, method, response?, error?, delay? }`). The test
  client's `invoke` matches on `service.method` and returns the
  canned `response` (or throws `error`).
- **`<TestNetronProvider testConfig={{ mocks }}>`** — wraps your
  component with a `NetronProvider` backed by the test client.

To branch on call arguments, build a service object with
**`createMockService<T>(implementations)`** (async methods, any
subset of the interface) and inject it as the client's service.

## Multi-backend mock

```tsx
import { MultiBackendProvider } from '@omnitron-dev/netron-react';

render(
  <MultiBackendProvider client={mockMultiBackendClient} autoConnect={false}>
    <Dashboard />
  </MultiBackendProvider>
);
```

Uses the production `<MultiBackendProvider>` directly — supply a
mock multi-backend client that satisfies the same routing
contract.

## With Prism components

Prism components need a `<PrismProvider>` for theme + snackbar
host. Wrap once at the test boundary:

```tsx
import { PrismProvider } from '@omnitron-dev/prism/core';

import { TestNetronProvider, type TestClientConfig }
  from '@omnitron-dev/netron-react/test';
import type { NetronReactClient } from '@omnitron-dev/netron-react';

function TestProviders({ children, testConfig, client }: {
  children: React.ReactNode;
  testConfig?: TestClientConfig;
  client?: NetronReactClient;
}) {
  return (
    <PrismProvider defaultSettings={{ mode: 'light' }}>
      <TestNetronProvider client={client} testConfig={testConfig}>
        {children}
      </TestNetronProvider>
    </PrismProvider>
  );
}

// In a test:
render(
  <TestProviders testConfig={{ mocks: [{ service: 'users', method: 'list', response: users }] }}>
    <UsersPage />
  </TestProviders>
);
```

For tests that use blocks (`<DataGridBlock>`, `<AuthBlock>`, …),
this wrapper is mandatory.

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

it('shows error on NOT_FOUND', async () => {
  render(
    <TestNetronProvider
      testConfig={{
        mocks: [{
          service: 'users',
          method:  'getUser',
          error:   new TitanError({ code: ErrorCode.NOT_FOUND, message: 'not found' }),
        }],
      }}
    >
      <UserCard userId="missing" />
    </TestNetronProvider>
  );

  await screen.findByText(/not found/i);
});
```

## Mutation assertions

```tsx
import { createTestClient, createMockService } from '@omnitron-dev/netron-react/test';

it('calls invite on submit', async () => {
  const user   = userEvent.setup();
  const invite = vi.fn(async () => ({ id: 'new', email: 'x@y.z' }));
  const usersMock = createMockService<UserService>({ invite });

  const client = createTestClient();
  client.service = (() => usersMock) as never;   // inject the mock service

  render(
    <TestProviders client={client}>
      <InviteForm />
    </TestProviders>
  );

  await user.type(screen.getByLabelText('Email'), 'x@y.z');
  await user.click(screen.getByRole('button', { name: 'Invite' }));

  await waitFor(() => {
    expect(invite).toHaveBeenCalledWith({ email: 'x@y.z' });
  });
});
```

`useMutation` exposes `isLoading` while in flight (not
`isPending`), plus `isSuccess` / `isError` / `data`.

## Subscriptions

For streaming RPCs consumed by `useSubscription`, build a
service whose method returns an async iterable with
`createMockService`, then inject it as the client's service:

```tsx
import { createTestClient, createMockService } from '@omnitron-dev/netron-react/test';

it('updates on stream events', async () => {
  const orders = createMockService<OrderService>({
    watchAll: async function* () {
      yield { type: 'created', orderId: '1' };
      yield { type: 'updated', orderId: '1', status: 'paid' };
    },
  });

  const client = createTestClient();
  client.service = (() => orders) as never;

  render(
    <TestProviders client={client}>
      <OrderStream />
    </TestProviders>
  );

  await screen.findByText('1: created');
  await screen.findByText('1: paid');
});
```

The generator yields each item in order — components using
`useSubscription` see them as they arrive.

## Suspense + error boundary

Suspense is the `suspense: true` option on `useQuery` (there is
no separate `useSuspenseQuery` hook) — it throws the in-flight
fetch to the nearest `<Suspense>` and escalates errors to the
nearest error boundary:

```tsx
it('catches render error via boundary', async () => {
  render(
    <TestProviders
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
    </TestProviders>
  );

  await waitFor(() => expect(screen.getByText('caught')).toBeInTheDocument());
});
```

Suspense + error boundary tests verify the "graceful degradation"
path that production needs.

## Cache control

```tsx
import { createTestClient } from '@omnitron-dev/netron-react/test';
import { NetronProvider } from '@omnitron-dev/netron-react';

const client = createTestClient({
  mocks:  [{ service: 'users', method: 'getUser', response: user }],
  config: { cache: { staleTime: 0, cacheTime: 0 } },   // disable cache
});

render(
  <NetronProvider client={client}>
    <App />
  </NetronProvider>
);
```

With `staleTime: 0`, every mount refetches — useful for
asserting "fetched N times" without cache surprises.

## Form testing pattern

For forms built with `<Field>` + `SchemaProvider`:

```tsx
import { userEvent } from '@testing-library/user-event';

it('validates email on blur', async () => {
  const user = userEvent.setup();

  render(<TestProviders><SignInForm /></TestProviders>);

  const email = screen.getByLabelText('Email');
  await user.type(email, 'not-an-email');
  await user.tab();                              // blur

  await screen.findByText(/invalid email/i);
});

it('submits on Enter', async () => {
  const onSubmit = vi.fn();
  render(<TestProviders><SignInForm onSubmit={onSubmit} /></TestProviders>);

  await userEvent.type(screen.getByLabelText('Email'),    'a@b.c');
  await userEvent.type(screen.getByLabelText('Password'), 'correct-horse{Enter}');

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.c', password: 'correct-horse' });
  });
});
```

`@testing-library/user-event` simulates real keyboard / mouse
input — far more reliable than `fireEvent`.

## Routing tests

For components that use `react-router-dom`:

```tsx
import { MemoryRouter } from 'react-router-dom';

render(
  <MemoryRouter initialEntries={['/users/u_42']}>
    <TestProviders testConfig={{ mocks: [{ service: 'users', method: 'getUser', response: user }] }}>
      <Routes>
        <Route path="/users/:id" element={<UserPage />} />
      </Routes>
    </TestProviders>
  </MemoryRouter>
);
```

`MemoryRouter` lets you set the initial URL and inspect the
history without a real browser.

## E2E with Playwright

For browser-driven tests:

```typescript
// e2e/sign-in.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173');
});

test('signs in', async ({ page }) => {
  await page.getByLabel('Email').fill('a@b.c');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('a@b.c')).toBeVisible();
});
```

Playwright E2E suites live at `packages/prism/tests/e2e/` and `packages/netron-browser/tests/e2e/`.

## Best practices

- **Wrap once at the top.** Build a `TestProviders` component
  with all your providers (Prism + Netron mocks + Router) and
  reuse it.
- **Assert via the DOM**, not mock internals where possible.
  `screen.getByText(...)` beats `expect(mock).toHaveBeenCalled()`
  when both are available.
- **`userEvent`, not `fireEvent`.** Real input simulation
  catches more bugs.
- **`findBy` for async**, `getBy` for sync. Don't use `getBy`
  before an async effect resolves.
- **One test per behaviour.** If a test has two `expect`s
  asserting two different intents, split it.

## Anti-patterns

- **Mocking `useService` directly.** Use `TestNetronProvider` —
  it preserves the full hook contract (loading, error, refetch,
  etc.).
- **`act()` warnings ignored.** They mean React's batching
  surprised you; fix the test.
- **Real `fetch` in unit tests.** Use `TestNetronProvider`.
- **Shared mock state across tests.** `mockClear()` in `beforeEach`
  or recreate.

## See also

- [Testing overview](./index.md)
- [Testing package](./testing-package.md)
- [Integration patterns](./integration.md)
- [Netron React testing](../frontend/netron/testing.md) — `TestNetronProvider` API
- [Prism overview](../frontend/prism/index.md) — `<PrismProvider>` wiring
