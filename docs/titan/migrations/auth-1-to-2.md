---
title: Auth v1 → v2 Migration
sidebar_position: 50
---

# Migration: Auth v1 → v2

:::caution Design RFC
This migration plan accompanies the planned authorisation stack documented under [Authentication & Authorisation](../../auth/index.md). The unified permission engine, the `pv` claim, and the RLS bridge are target shapes — not changes the current Omnitron build has actually rolled out. Treat the steps below as the upgrade contract you'd hand to a platform team adopting that stack.
:::

The Auth surface gained a unified permission engine, decorator
façades, per-user overrides, live `permVer` propagation, and a
stricter RLS tiering. The wire-level JWT shape grew one new
claim (`pv`); everything else is back-compat or codemod-able.

This page lists the call-site changes for an existing app
upgrading from the pre-unification surface.

## TL;DR

| Before                                                          | After                                                                              |
|-----------------------------------------------------------------|------------------------------------------------------------------------------------|
| `@Public({auth:{roles:['admin','superadmin'], permissions:['admin.users.ban']}})` | `@RequirePlatformPermission('admin.users.ban', { roles: ['admin','superadmin'] })` |
| `@Public({auth:{permissions:['admin.users.list']}})`             | `@RequirePlatformPermission('admin.users.list')`                                   |
| Service-method `this.requirePermission(actor, orgId, 'shops.create')` | (gradually) `@RequireOrgPermission('org.shops.create')` on the RPC; keep service-layer guard as defence in depth |
| Frontend `user.platformRole === 'admin'`                          | `usePermission('admin.x.y')` / `<PermissionGuard permission="admin.x.y">`           |
| Frontend `<RoleGuard roles={['admin','superadmin']}>`            | `<PermissionGuard anyOf={['admin.users.list', 'admin.audit.view', …]}>`             |
| Inline `ADMIN_ROLES = ['admin','superadmin']` in three files     | `import { ADMIN_ROLES, isAdminRole } from 'src/auth/admin-roles'`                   |

## Permission strings

Permission keys did not change. The set GREW (new entries:
`admin.users.permissions`, `admin.orgs.*`,
`admin.security.impersonate`, the entire `org.*` registry); old
keys still work. The matcher is now consistent across all
scopes — wildcards (`admin.*`) and hierarchical prefix grants
(`admin.users` grants `admin.users.ban`) work identically on
platform and org.

## Decorator façades

The `@RequirePlatformPermission` and `@RequireOrgPermission`
decorators compile to:

| Decorator                                     | Underlying                                                   |
|-----------------------------------------------|--------------------------------------------------------------|
| `@RequirePlatformPermission(p)`               | `@Public({auth:{permissions:[p]}})`                          |
| `@RequirePlatformPermission(p, { roles })`    | `@Public({auth:{permissions:[p], roles}})`                   |
| `@RequireOrgPermission(p)`                    | `@Public({auth:{policies:[org-permission:p:default]}})`      |
| `@RequireOrgPermission(p, { argIndex, field })` | `@Public({auth:{policies:[org-permission:p:argIdx.field]}})` |
| `@RequireAnyOrgPermission([a, b])`            | `@Public({auth:{policies:[org-permission:any:a,b:default]}})` |
| `@RequirePlatformOrOrgPermission(plat, org)`  | OR composite (platform || org)                                |

Migration is mechanical. The pre-built codemod (in
`scripts/migrate-auth-decorators.mjs`) handles both shapes —
or just grep for `@Public({ auth: { ` and rewrite by hand;
the platform variant is by far the most common.

## `permVer` JWT claim

The access token gained one claim:

```ts
{
  sub: '<userId>',
  roles: [...],
  permissions: [...],
  pv: 7,                  // ← NEW. Snapshot of user's permission-version counter at mint time.
  // ... existing claims
}
```

Verifiers that **don't** check `pv` continue to work; the
field is ignored. Verifiers that consume the
`createRlsInvocationWrapper` from `@yourorg/auth-utils` get
`pv` enforcement out of the box once they pass a `permVerRedis`
client.

A client-side handler should treat
`PERMISSION_VERSION_STALE` (401) the same as `TOKEN_EXPIRED` —
trigger the refresh flow, retry the call. The canonical
implementation adds three lines to the existing refresh-on-401
logic in your Netron RPC wrapper.

## Per-user permission overrides

New surface; existing apps have no migration to do — adopting
overrides is purely additive. The relevant pieces:

- DB: `users.customPermissions: jsonb` (migration 045).
- Service: `UserPermissionService.{grant, revoke, replaceAll, list}`.
- RPC: `adminListUserPermissions` / `adminGrantUserPermission`
  / `adminRevokeUserPermission` / `adminSetUserPermissions`
  on `UsersService`, gated on `admin.users.permissions`.
- Identical org-scope shape on `employees.customPermissions`
  via `EmployeePermissionService`.

See [Per-user overrides](../../auth/overrides.md) for the
runtime story.

## RLS plugin split

The pre-fix single `rlsPlugin({ allowUnfilteredQueries: true,
requireContext: false })` is replaced by two plugin instances:

```ts
const strict = rlsPlugin({ schema, bypassRoles: ['superadmin'], requireContext: true,  allowUnfilteredQueries: false });
const permissive = rlsPlugin({ schema, bypassRoles: ['superadmin'], requireContext: false, allowUnfilteredQueries: true });

for (const t of STRICT_RLS_TABLES) registerTablePlugins(t, [...existing, strict]);
for (const t of PERMISSIVE_RLS_TABLES) registerTablePlugins(t, [...existing, permissive]);
```

If your app has background workers or scripts that hit STRICT
tables (`audit_logs`, `platform_roles`, `users`, `user_sessions`,
`organization_roles`) without an authenticated context, they
MUST enter a `'system'` role context — the previous silent
bypass via missing context is gone.

See [RLS bridge](../../auth/rls-bridge.md) for the bridge
contract and the `'system'` escape hatch.

## Frontend

The presentational gates split into two primitives:

```tsx
// Capability-based (preferred for new surfaces)
<PermissionGuard permission="admin.users.ban">…</PermissionGuard>

// Any-of (for routes accessible to multiple roles via different perms)
<PermissionGuard anyOf={['admin.users.list', 'admin.audit.view']}>…</PermissionGuard>

// Role-set (kept for the rare legitimate role-set semantics)
<RoleGuard roles={['admin', 'superadmin']}>…</RoleGuard>
```

The `/admin` section gate was the most impactful migration —
previously a hard-coded `['admin','superadmin']` role-set that
locked out `moderator` and `security`; now `PermissionGuard`
with the common admin-perm any-of opens the section to every
tier that holds at least one admin capability.

## DTOs — removed actor fields

Every `admin*` RPC DTO had its `adminId: string` field removed.
Same for `viewerId` on `getProfile` / `getProfileByUsername` /
`getFollowers` / `getFollowing`. The server derives the actor
from the verified JWT via `actorId()` — there is no longer a
way for a client to claim to be acting as a different admin.

If your client sent these fields, the new DTOs reject them at
the zod boundary; just delete the field from the call.

## Quick sanity check

After upgrading, every backend should:

1. Boot through omnitron without errors.
2. Return `HTTP 200` on `/health`.
3. Log an entry on the FIRST authenticated call that says
   either nothing (happy path) OR `auth.session.fail_open`
   if Redis is unreachable (the MED-2 telemetry tag).

A `PERMISSION_VERSION_STALE` (401) the moment a role changes is
the new normal — the client refresh-token flow handles it
transparently.
