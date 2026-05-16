---
sidebar_position: 5
title: React testing
description: Testing React components that call Netron — MockProvider patterns.
---

# React testing

Components built on `netron-react` need RPC mocks; Prism
components need a `<PrismProvider>`. This page covers both with
patterns that scale.

## The two MockProviders

| Mock | When |
| ---- | ---- |
| **`MockProvider`** (from `@omnitron-dev/netron-react/test`) | Single-backend tests |
| **`MockMultiBackendProvider`** (same package) | Multi-backend tests |

Both produce a `NetronClient` substitute that intercepts RPC calls
and returns canned data.

## Single-backend mock

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockProvider, mockService } from '@omnitron-dev/netron-react/test';
import { UserCard } from './UserCard.js';

describe('UserCard', () => {
  it('renders user email', async () => {
    const users = mockService<UserService>('users', {
      getUser: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.c' }),
    });

    render(
      <MockProvider services={[users]}>
        <UserCard userId="1" />
      </MockProvider>
    );

    await screen.findByText('a@b.c');
    expect(users.getUser).toHaveBeenCalledWith('1');
  });
});
```

Two pieces:

- **`mockService(name, impl)`** — builds a typed service mock.
  `impl` provides any subset of the interface; uncalled methods
  are `vi.fn()` returning `undefined`.
- **`<MockProvider services={[...]}>`** — wraps your component
  with a fake `NetronProvider`.

## Multi-backend mock

```tsx
import { MockMultiBackendProvider } from '@omnitron-dev/netron-react/test';

render(
  <MockMultiBackendProvider
    backends={{
      auth:  { services: [authMock] },
      media: { services: [mediaMock] },
    }}
    routes={{ 'users.*': 'auth', 'objects.*': 'media' }}
  >
    <Dashboard />
  </MockMultiBackendProvider>
);
```

Mirrors production `<MultiBackendProvider>` exactly — same
routing semantics.

## With Prism components

Prism components need a `<PrismProvider>` for theme + snackbar
host. Wrap once at the test boundary:

```tsx
import { PrismProvider } from '@omnitron-dev/prism/core';
import { createTheme }   from '@omnitron-dev/prism/theme';

const theme = createTheme({ mode: 'light' });

function TestProviders({ children, services }: {
  children: React.ReactNode;
  services: any[];
}) {
  return (
    <PrismProvider theme={theme}>
      <MockProvider services={services}>
        {children}
      </MockProvider>
    </PrismProvider>
  );
}

// In a test:
render(
  <TestProviders services={[usersMock]}>
    <UsersPage />
  </TestProviders>
);
```

For tests that use blocks (`<DataGridBlock>`, `<AuthBlock>`, …),
this wrapper is mandatory.

## Loading + error states

```tsx
it('shows skeleton while loading', async () => {
  const users = mockService<UserService>('users', {
    getUser: vi.fn(() => new Promise((r) => setTimeout(() => r(user), 100))),
  });

  render(
    <MockProvider services={[users]}>
      <UserCard userId="1" />
    </MockProvider>
  );

  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  await screen.findByText('a@b.c');
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
});

it('shows error on NOT_FOUND', async () => {
  const users = mockService<UserService>('users', {
    getUser: vi.fn().mockRejectedValue(
      new TitanError({ code: ErrorCode.NOT_FOUND, message: 'not found' })
    ),
  });

  render(
    <MockProvider services={[users]}>
      <UserCard userId="missing" />
    </MockProvider>
  );

  await screen.findByText(/not found/i);
});
```

## Mutation assertions

```tsx
it('calls invite on submit', async () => {
  const user = userEvent.setup();
  const users = mockService<UserService>('users', {
    invite: vi.fn().mockResolvedValue({ id: 'new', email: 'x@y.z' }),
  });

  render(
    <TestProviders services={[users]}>
      <InviteForm />
    </TestProviders>
  );

  await user.type(screen.getByLabelText('Email'), 'x@y.z');
  await user.click(screen.getByRole('button', { name: 'Invite' }));

  await waitFor(() => {
    expect(users.invite).toHaveBeenCalledWith({ email: 'x@y.z' });
  });
});
```

## Subscriptions

```tsx
import { mockAsyncIterable } from '@omnitron-dev/netron-react/test';

it('updates on stream events', async () => {
  const orders = mockService<OrderService>('orders', {
    watchAll: vi.fn(() => mockAsyncIterable([
      { type: 'created', orderId: '1' },
      { type: 'updated', orderId: '1', status: 'paid' },
    ])),
  });

  render(
    <TestProviders services={[orders]}>
      <OrderStream />
    </TestProviders>
  );

  await screen.findByText('1: created');
  await screen.findByText('1: paid');
});
```

`mockAsyncIterable(items)` yields each item with a microtask
delay between — components see them in order.

## Suspense + error boundary

```tsx
it('catches render error via boundary', async () => {
  const users = mockService<UserService>('users', {
    getUser: vi.fn().mockRejectedValue(new Error('boom')),
  });

  render(
    <TestProviders services={[users]}>
      <ErrorBoundary fallback={() => <div>caught</div>}>
        <Suspense fallback={<div>loading</div>}>
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

const client = createTestClient({
  services: [usersMock],
  cache:    { defaultStaleTime: 0, defaultGcTime: 0 },   // disable cache
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
    <TestProviders services={[usersMock]}>
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

The webapp's E2E suite lives at `apps/omnitron/webapp/e2e/`.

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

- **Mocking `useService` directly.** Use `MockProvider` — it
  preserves the full hook contract (loading, error, refetch,
  etc.).
- **`act()` warnings ignored.** They mean React's batching
  surprised you; fix the test.
- **Real `fetch` in unit tests.** Use MockProvider.
- **Shared mock state across tests.** `mockClear()` in `beforeEach`
  or recreate.

## See also

- [Testing overview](./index.md)
- [Testing package](./testing-package.md)
- [Integration patterns](./integration.md)
- [Netron React testing](../frontend/netron/testing.md) — `MockProvider` API
- [Prism overview](../frontend/prism/index.md) — `<PrismProvider>` wiring
