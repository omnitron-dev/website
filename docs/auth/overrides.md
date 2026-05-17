---
title: Per-User Overrides
sidebar_position: 2
---

# Per-User Overrides

:::caution Design RFC
Per-user permission overrides on top of role defaults are part of the planned authorisation stack. Today's Omnitron stores `(user, role)` only; the override table and merge rules below are the target design.
:::

A user's **effective permission set** is the union of:

1. The default permissions of every role they hold, AND
2. Any **custom permissions** granted directly to them.

The override layer is strictly additive — overrides can only
ADD; to remove a role-derived permission, change the user's
role rather than negating an individual entry. This keeps the
"resolve" path a single set-union with no surprise subtraction
semantics.

## Why overrides exist

Without overrides, the only way to grant one moderator a
single extra capability — say `admin.security.alerts` — would
be to promote them to the `security` tier, which carries the
full `admin.security.*` bag. Overrides express the narrower
intent without the side effects.

## Two scopes, identical shape

| Scope    | Storage column                              | Service                                  |
|----------|---------------------------------------------|------------------------------------------|
| Platform | `users.customPermissions: string[]`          | `UserPermissionService`                  |
| Org      | `employees.customPermissions: string[]`      | `EmployeePermissionService`              |

Each service exposes the same three operations:

```ts
service.grant(targetId, permission, actorId)
service.revoke(targetId, permission, actorId)
service.replaceAll(targetId, permissions, actorId)
```

Every mutation does three things atomically:

1. **Validate** the permission key against the canonical
   registry (`isValidPlatformPermission` /
   `isValidOrgPermission`). Typos refused.
2. **Write an audit-log row** (`actorType: 'admin'`,
   `targetType: 'user'|'employee'`, `details: { permission }`).
3. **Bump the target's permission version** so every live
   access token they hold becomes stale on the next request
   and the refresh flow re-mints with the updated set.

## Resolution

`auth.service.signin` / `refresh` reads both the role-derived
set and the overrides and bakes the union into the JWT:

```ts
const rolePerms = await rbacService.resolvePermissions(user.platformRole);
const overrides = parseUserOverrides(user.customPermissions);
const effective = rbacService.resolveEffectivePermissions(
  user.platformRole,
  overrides,
  rolePerms,
);
const accessToken = await createAccessToken(user.id, user.platformRole, effective, …);
```

The same shape applies in the org scope via
`DynamicPolicyService.loadPermissions`.

## Live propagation

A grant or revoke fires `AuthService.bumpPermissionVersion(userId)`
which increments the `omni:perm-v:{userId}` counter in Redis.
On every authenticated call the invocation wrapper
([RLS bridge → permVer enforcement](./rls-bridge.md)) compares
the JWT's `pv` claim against the live counter:

- Equal → request proceeds.
- Token snapshot older → `PERMISSION_VERSION_STALE` (401).
  The client refresh-token flow mints a new JWT with the
  up-to-date set; the original request retries automatically.
  No re-sign-in.

The propagation window is bounded by one RPC round-trip.

## Admin RPC surface

The platform-side endpoints live on `UsersService` and are
gated on `admin.users.permissions` (declared `critical` in the
registry — a generic `admin` role does NOT pick it up by
default, the operator grants it explicitly):

```
adminListUserPermissions({ userId }): { permissions: string[] }
adminGrantUserPermission({ userId, permission })
adminRevokeUserPermission({ userId, permission })
adminSetUserPermissions({ userId, permissions: string[] })
```

The org-side endpoints live on `Organizations` and use the
same `org.roles.assign` permission that role assignment uses
(per-employee overrides are the same authority surface as
role assignment within an org):

```
grantEmployeePermission({ employeeId, permission })
revokeEmployeePermission({ employeeId, permission })
setEmployeePermissions({ employeeId, permissions: string[] })
```

## See also

- [Permissions](./permissions.md) — registry, grammar, matcher.
- [RLS bridge](./rls-bridge.md) — permVer counter + invocation
  wrapper.
- [Audit trail](./audit-trail.md) — what each mutation writes.
