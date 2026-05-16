---
sidebar_position: 5
title: 4. Frontend
description: Vite + React + Prism + netron-react with end-to-end types.
---

# Step 4 — Frontend

By the end: a React app that signs in and lists users using the
backend service contract — no codegen.

## Scaffold the frontend

```bash
cd apps
pnpm create vite web --template react-ts
cd web
pnpm install
```

`apps/web/package.json` — add deps:

```bash
pnpm add @omnitron-dev/netron-browser @omnitron-dev/netron-react @omnitron-dev/prism react-router-dom@7
```

## Share the service types

The frontend imports the backend's service interfaces directly.
Easiest way: a workspace package.

```bash
mkdir -p packages/api-contracts/src
```

`packages/api-contracts/package.json`:

```json
{
  "name":    "@my-platform/api-contracts",
  "type":    "module",
  "main":    "./src/index.ts",
  "types":   "./src/index.ts",
  "private": true
}
```

`packages/api-contracts/src/index.ts`:

```typescript
export interface User {
  id:    string;
  email: string;
  name:  string;
  roles: string[];
}

export interface AuthService {
  signIn(input: { email: string; password: string }): Promise<{
    token: string;
    user:  Pick<User, 'id' | 'email' | 'roles'>;
  }>;
  signOut(input: { sessionId: string }): Promise<{ success: boolean }>;
}

export interface UsersService {
  findById(id: string): Promise<User>;
  list(): Promise<User[]>;
}
```

In `apps/api/`, import these and use as the implementation type:

```typescript
// apps/api/src/users/users.service.ts
import type { UsersService as UsersServiceContract, User } from '@my-platform/api-contracts';

@Service('users@1.0.0')
export class UsersService implements UsersServiceContract {
  // ...
}
```

And in `apps/web/`:

```bash
pnpm add @my-platform/api-contracts@workspace:*
```

## The client

`apps/web/src/client.ts`:

```typescript
import { NetronReactClient } from '@omnitron-dev/netron-react';

export const client = new NetronReactClient({
  url:       import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  transport: 'http',
  auth: {
    storage: 'localStorage',
  },
});
```

## Providers

`apps/web/src/main.tsx`:

```tsx
import React           from 'react';
import ReactDOM        from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PrismProvider } from '@omnitron-dev/prism/core';
import { createTheme }   from '@omnitron-dev/prism/theme';
import { NetronProvider } from '@omnitron-dev/netron-react';
import { AuthProvider }   from '@omnitron-dev/netron-react/auth';

import { client } from './client.js';
import App        from './App.js';

const theme = createTheme({ mode: 'dark', palette: { primary: { main: '#7c4dff' } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NetronProvider client={client}>
      <AuthProvider>
        <PrismProvider theme={theme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PrismProvider>
      </AuthProvider>
    </NetronProvider>
  </React.StrictMode>,
);
```

## Sign-in page

`apps/web/src/SignInPage.tsx`:

```tsx
import { useState } from 'react';
import { useAuth }  from '@omnitron-dev/netron-react/auth';
import { useService } from '@omnitron-dev/netron-react';
import { useNavigate } from 'react-router-dom';
import type { AuthService } from '@my-platform/api-contracts';

export function SignInPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string>();
  const navigate = useNavigate();

  const auth    = useService<AuthService>('auth');
  const authMgr = useAuth();

  const signIn = auth.signIn.useMutation({
    onSuccess: async (result) => {
      await authMgr.setTokens({ accessToken: result.token, user: result.user });
      navigate('/');
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); signIn.mutate({ email, password }); }}>
      <h1>Sign in</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email"    placeholder="Email"    value={email}    onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" disabled={signIn.isPending}>
        {signIn.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
```

## Users list page

`apps/web/src/UsersPage.tsx`:

```tsx
import { useService } from '@omnitron-dev/netron-react';
import type { UsersService } from '@my-platform/api-contracts';

export function UsersPage() {
  const users = useService<UsersService>('users');
  const { data, isLoading, error } = users.list.useQuery([]);

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p style={{ color: 'red' }}>{error.message}</p>;

  return (
    <ul>
      {data?.map(u => (
        <li key={u.id}>
          {u.name} — {u.email} — [{u.roles.join(', ')}]
        </li>
      ))}
    </ul>
  );
}
```

## Routes

`apps/web/src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard, GuestGuard }   from '@omnitron-dev/netron-react/auth';
import { SignInPage } from './SignInPage.js';
import { UsersPage }  from './UsersPage.js';

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={
        <GuestGuard><SignInPage /></GuestGuard>
      } />
      <Route path="/" element={
        <AuthGuard><UsersPage /></AuthGuard>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

## Run

In two terminals:

```bash
# api:
cd apps/api && JWT_SECRET=dev-secret-do-not-use-in-prod pnpm dev

# web:
cd apps/web && pnpm dev
```

Open `http://localhost:5173/`:

1. Redirected to `/sign-in`.
2. Enter `admin@example.com` / `correct-horse-battery-staple`.
3. Redirected to `/` — users list renders.

## Note the type flow

When you call:

```tsx
const users = useService<UsersService>('users');
const { data } = users.list.useQuery([]);
//      ^? User[] | undefined
```

`data` is `User[] | undefined` — typed from the shared contract.
Change `UsersService.list` to return `User[]` instead of
`Pick<User, ...>` on the server, the frontend's `data.email`
access fails the build.

No codegen. No schema sync.

## Verify auth gating

Replace `admin@example.com` with a non-admin user; you'll see
`FORBIDDEN` from the backend, surfaced as `error` in the
`useQuery` hook. The `<AuthGuard>` redirected non-auth requests
back to `/sign-in`.

## Commit

```bash
git add .
git commit -m "step 4: React UI with end-to-end types"
```

## Next

**[Step 5 — Tests →](./05-tests.md)** — cover the stack with
unit + integration + E2E tests.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| CORS error | Add `cors: true` to api's `netron.http` config |
| `data` typed as `unknown` | Verify `@my-platform/api-contracts` is installed in `apps/web` |
| `useService` undefined | Check `<NetronProvider client={client}>` wraps `<App>` |
| Sign-in succeeds but list 401s | Auth manager not attaching token; check `AuthProvider` order in providers |
