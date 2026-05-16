---
sidebar_position: 6
title: 5. Tests
description: Unit / module / integration / E2E coverage for the stack you built.
---

# Step 5 — Tests

By the end: the app has tests at every level of the
[testing pyramid](../testing/index.md).

## Add Vitest

```bash
# In each app:
cd apps/api
pnpm add -D vitest @omnitron-dev/testing

cd ../web
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom
```

## Unit test (api)

`apps/api/src/users/user.repo.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '@omnitron-dev/testing/titan';
import { AppModule }     from '../app.module.js';
import { UserRepo }      from './user.repo.js';

describe('UserRepo', () => {
  let app: any;
  let repo: UserRepo;

  beforeEach(async () => {
    app = await createTestApp({
      modules:  [AppModule],
      database: 'rollback',
    });
    repo = await app.resolve(UserRepo);
  });

  afterEach(() => app.dispose());

  it('creates and finds', async () => {
    const u = await repo.create({ email: 'a@b.c', name: 'Alice' });
    expect(u.email).toBe('a@b.c');

    const fetched = await repo.findById(u.id);
    expect(fetched).toEqual(u);
  });

  it('returns null on miss', async () => {
    const u = await repo.findById('missing');
    expect(u).toBeNull();
  });
});
```

`database: 'rollback'` wraps each test in `BEGIN ... ROLLBACK` —
fast, isolated, no cleanup boilerplate.

## Service test with mocks

`apps/api/src/users/users.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Container } from '@omnitron-dev/titan/nexus';
import { UsersService } from './users.service.js';
import { UserRepo, type User } from './user.repo.js';

describe('UsersService', () => {
  it('throws NOT_FOUND on miss', async () => {
    const container = new Container();
    container.register({
      provide:  UserRepo,
      useValue: { findById: vi.fn().mockResolvedValue(null) } as any,
    });
    container.register({ provide: UsersService, useClass: UsersService });

    const service = await container.resolveAsync(UsersService);

    await expect(service.findById('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
```

Pure DI test — no real DB, no real Application.

## Integration test (real api over the wire)

`apps/api/test/users.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '@omnitron-dev/testing/titan';
import { createClient }  from '@omnitron-dev/netron-browser';
import { AppModule }     from '../src/app.module.js';

describe('users service end-to-end', () => {
  let app:    any;
  let client: any;

  beforeAll(async () => {
    app = await createTestApp({
      modules:  [AppModule],
      netron:   { http: { port: 0 } },           // 0 → pick free port
      database: 'rollback',
    });
    await app.start();

    const port = app.netron.getPort('http');
    client = createClient({ url: `http://localhost:${port}` });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    await app.dispose();
  });

  it('CRUD round-trip', async () => {
    const u = await client.invoke('users', 'create', [{ email: 'i@t.c', name: 'I' }]);
    expect(u.email).toBe('i@t.c');

    const fetched = await client.invoke('users', 'findById', [u.id]);
    expect(fetched).toEqual(u);
  });

  it('rejects missing user with NOT_FOUND', async () => {
    await expect(client.invoke('users', 'findById', ['missing']))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

Real wire format, real serialisation, real error round-trip.
Catches a class of bugs unit tests miss.

## Frontend component test

`apps/web/src/UsersPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockProvider, mockService } from '@omnitron-dev/netron-react/test';
import { UsersPage } from './UsersPage.js';

describe('<UsersPage>', () => {
  it('renders user list', async () => {
    const users = mockService<any>('users', {
      list: vi.fn().mockResolvedValue([
        { id: '1', name: 'Alice', email: 'a@b.c', roles: ['user'] },
        { id: '2', name: 'Bob',   email: 'b@c.d', roles: ['admin'] },
      ]),
    });

    render(
      <MockProvider services={[users]}>
        <UsersPage />
      </MockProvider>
    );

    await screen.findByText('Alice — a@b.c — [user]');
    expect(screen.getByText('Bob — b@c.d — [admin]')).toBeInTheDocument();
  });
});
```

Vitest config for the web app:

`apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test:    {
    environment: 'jsdom',
    globals:     false,
  },
});
```

## E2E test (Playwright)

```bash
cd apps/web
pnpm add -D @playwright/test
npx playwright install --with-deps chromium
```

`apps/web/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: 'cd ../api && JWT_SECRET=test-secret pnpm dev',
      url:     'http://localhost:3001/healthz',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev',
      url:     'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

`apps/web/e2e/sign-in.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('signs in and sees users', async ({ page }) => {
  await page.goto('/');

  // Redirected to sign-in
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByPlaceholder('Email').fill('admin@example.com');
  await page.getByPlaceholder('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Lands on home
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('admin@example.com')).toBeVisible();
});
```

Run:

```bash
pnpm exec playwright test
```

## Cross-runtime test (a utility)

If you publish a utility consumed by Bun / Deno users:

`packages/api-contracts/test/cross.test.ts`:

```typescript
import { loadRuntimeAdapter } from '@omnitron-dev/testing';

const t = await loadRuntimeAdapter();

t.test('User type is structural', () => {
  const u = { id: '1', email: 'a@b.c', name: 'A', roles: ['user'] };
  t.expect(u.email).toBe('a@b.c');
});
```

Runs on Node + Bun + Deno via the adapter.

## CI workflow

`.github/workflows/test.yml`:

```yaml
name: test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: dev, POSTGRES_DB: platform_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: psql -h localhost -U postgres -d platform_test < apps/api/migrations/001_users.sql
        env: { PGPASSWORD: dev }
      - run: psql -h localhost -U postgres -d platform_test < apps/api/migrations/002_auth.sql
        env: { PGPASSWORD: dev }
      - run: pnpm test
        env:
          DATABASE_URL: postgres://postgres:dev@localhost:5432/platform_test
          REDIS_URL:    redis://localhost:6379
          JWT_SECRET:   test-secret
```

## What we covered

| Layer | What | Speed |
| ----- | ---- | ----- |
| Unit | `UsersService.findById` with mocked repo | ms |
| Module | `UserRepo` with real DB + rollback | tens of ms |
| Integration | Full app + Netron client | hundreds of ms |
| Component | `<UsersPage>` with mocked services | tens of ms |
| E2E | Real browser → real api | seconds |

Run the suite:

```bash
pnpm test                  # all packages
pnpm -F api test           # just api
pnpm -F web exec playwright test    # E2E
```

## Commit

```bash
git add .
git commit -m "step 5: tests across the pyramid"
```

## Next

**[Step 6 — Deploy →](./06-deploy.md)** — package everything
into Docker + ship to a server.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `cannot find module '@my-platform/api-contracts'` in tests | Check `pnpm install` ran after adding the workspace dep |
| Vitest hangs | Likely an unhandled promise from a real DB connection — use `database: 'rollback'` |
| Playwright fails to start servers | Check `webServer.url` matches reality |
| `act()` warnings in React tests | Use `findBy*` (async) instead of `getBy*` (sync) |
