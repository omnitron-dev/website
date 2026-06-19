---
title: Permissions
sidebar_position: 1
---

# Permissions

:::caution Design RFC
Permission strings, hierarchical wildcards, and the `@Auth({permissions})` gate described here are part of the planned authorisation stack. Today's Omnitron gates RPCs by role only (`viewer` / `operator` / `admin`); permission-string evaluation is the target design.
:::

A **permission** is a dot-separated string that names a
capability. Every gate in the platform — `@Auth({permissions})`,
`@kysera/rls` policy, frontend `usePermission()` hook —
resolves the same matcher against the same set of strings.

## Grammar

```
<scope>.<resource>[.<action>][.<sub>]
```

| Token       | Examples                                  | Notes                                         |
|-------------|-------------------------------------------|-----------------------------------------------|
| `scope`     | `admin`, `site`, `commerce`, `org`        | Top-level domain                              |
| `resource`  | `users`, `shops`, `employees`             | Entity inside the scope                       |
| `action`    | `list`, `view`, `create`, `edit`, `delete`| Verb on the resource                          |
| `sub`       | `own`, `assigned`                         | Optional refinement (e.g. `posts.edit.own`)   |

Examples drawn from the canonical registry:

```
admin.users.list
admin.users.ban
admin.users.permissions
admin.orgs.recovery
site.posts.edit.own
org.shops.create
org.employees.invite
```

## Wildcards

Granting a wildcard authorises every key matching the prefix.

| Granted              | Authorises                                                          |
|----------------------|---------------------------------------------------------------------|
| `*`                  | Every permission in every scope (reserved for the owner role)       |
| `admin.*`            | Every key starting with `admin.` (`admin.users.list`, `admin.users.ban`, …) |
| `admin.users.*`      | `admin.users.list`, `admin.users.ban`, …                             |

The trailing `.*` is the explicit (and only) wildcard form: the
granted entry must end in `.*` for prefix expansion to apply. A
bare prefix without the star (`admin.users`) authorises **only**
the exact key `admin.users` — it does not implicitly grant the
keys below it. Spell out the `.*` when you mean "everything under
here".

## Composition

A method that lists two permissions in `@Auth({permissions})`
requires *both* by default:

```ts
@Auth({ permissions: ['admin.orders.view', 'admin.users.view'] })
```

For *either-of* semantics, register `BuiltInPolicies.requireAnyPermission`
on the `PolicyEngine` and reference it by its generated name. The
`policies` field of `@Auth` takes policy **name strings** (or an
`{ all } / { any }` / `and|or|not` expression of them), never
inline policy objects:

```ts
// bootstrap
policyEngine.registerPolicy(
  BuiltInPolicies.requireAnyPermission(['admin.orders.view', 'admin.users.view']),
);

// service — the factory names itself `permission:any:admin.orders.view,admin.users.view`
@Auth({ policies: ['permission:any:admin.orders.view,admin.users.view'] })
```

See [ABAC conditions](./abac-conditions.md) for richer
composition (and / or / not, time-of-day, MFA gates).

## Matcher

`permissionMatches(granted, required)` returns true when:

1. `granted === '*'` (full wildcard)
2. `granted === required` (exact match)
3. `granted` ends in `.*` and `required` starts with the prefix
   (e.g. `admin.users.*` covers `admin.users.ban`)

```ts
permissionMatches('admin.*', 'admin.users.ban')          // true
permissionMatches('admin.users.*', 'admin.users.ban')    // true
permissionMatches('admin.users', 'admin.users.ban')      // false (no trailing .*)
permissionMatches('admin.users.list', 'admin.users.ban') // false
permissionMatches('admin.*', 'site.posts.create')        // false
```

The matcher lives in
[`@omnitron-dev/titan/netron/auth`](../titan/netron/authentication.md)
(`netron/auth/utils.ts`). `hasPermission(grantedPermissions, required)`
applies it across a granted set (true when any granted entry
covers `required`). `@Auth({ permissions })` requires **all** of
the listed permissions, each resolved through this matcher.

## Scopes

Two scopes ship out of the box; both share the matcher, the
registry shape, and the override mechanism — they only differ in
where the grant is stored.

| Scope       | Storage                                        | Decorator                          |
|-------------|------------------------------------------------|-----------------------------------|
| `platform`  | `users.platformRole` + `users.customPermissions` | `@RequirePlatformPermission(p)`   |
| `org`       | `employees.roleIds[]` + `employees.customPermissions` | `@RequireOrgPermission(p)`        |

The org-scope decorator accepts an `OrgIdResolver` so a single
permission applies to a specific organisation extracted from the
call's args:

```ts
@RequireOrgPermission('org.shops.create')                          // default: args[0].organizationId
@RequireOrgPermission('org.shops.update', { argIndex: 0, field: 'orgId' })
@RequireOrgPermission('org.disputes.respond', (args) => args[0].dispute.organizationId)
```

## Validation

Every permission key referenced in a role definition is
validated against the registry at write time:

```ts
isValidPermissionKey('admin.users.ban', PLATFORM_PERMISSIONS) // true
isValidPermissionKey('admin.users.*',   PLATFORM_PERMISSIONS) // true (wildcard, at least one key under it)
isValidPermissionKey('admin.users.lban', PLATFORM_PERMISSIONS) // false — typo refused
```

`createRole` / `updateRole` reject the whole mutation on any
unknown key — the registry is the source of truth and typos
never make it to the persistence layer.

## See also

- [Per-user overrides](./overrides.md) — additive grants on a
  single user without bumping their role.
- [ABAC conditions](./abac-conditions.md) — non-permission gates
  (time-window, MFA, IP).
- [Mental model](./mental-model.md) — how the layers compose.
