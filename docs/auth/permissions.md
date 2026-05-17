---
title: Permissions
sidebar_position: 1
---

# Permissions

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
| `admin.*`            | Every `admin.<resource>.<action>` key                                |
| `admin.users.*`      | `admin.users.list`, `admin.users.ban`, …                             |
| `admin.users`        | (hierarchical) — same effect as `admin.users.*`                      |

The trailing `.*` is the explicit form. A granted entry without
a trailing star also authorises every key one level below it —
this **hierarchical prefix grant** lets short policy lists
expand naturally as the registry grows.

## Composition

A method that lists two permissions in `@Auth({permissions})`
requires *both* by default:

```ts
@Auth({ permissions: ['admin.orders.view', 'admin.users.view'] })
```

For *either-of* semantics, use `BuiltInPolicies.requireAnyPermission`:

```ts
@Auth({ policies: [BuiltInPolicies.requireAnyPermission(['admin.orders.view', 'admin.users.view'])] })
```

See [ABAC conditions](./abac-conditions.md) for richer
composition (and / or / not, time-of-day, MFA gates).

## Matcher

`permissionGrants(granted, required)` returns true when:

1. `granted === '*'` (full wildcard)
2. `granted === required` (exact match)
3. `granted` ends in `.*` and `required` starts with the prefix
4. `required` starts with `granted + '.'` (hierarchical prefix grant)

```ts
permissionGrants('admin.*', 'admin.users.ban')          // true
permissionGrants('admin.users.*', 'admin.users.ban')    // true
permissionGrants('admin.users', 'admin.users.ban')      // true (hierarchical)
permissionGrants('admin.users.list', 'admin.users.ban') // false
permissionGrants('admin.*', 'site.posts.create')        // false
```

The matcher lives in `shared/permission-engine.ts` and is used
unchanged on both the platform and the organisation scopes.

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
