---
title: RLS Bridge
sidebar_position: 4
---

# RLS Bridge

The auth layer above gates **calls**. `@kysera/rls` gates
**rows**. They use the same identity — the user's
`AuthContext` — bridged from the Netron invocation wrapper
into the @kysera RLS AsyncLocalStorage scope.

This page covers the wrapper, the policy authoring shape, and
the per-request permission-version (`permVer`) enforcement that
shares the wrapper's hot path.

## The shared wrapper

Every daos backend (`main`, `paysys`, `storage`, `messaging`,
`priceverse`) wires the SAME `createRlsInvocationWrapper` from
`@daos/auth-utils`. The wrapper does **four** things on every
authenticated RPC:

```ts
// packages/auth-utils/src/rls-invocation-wrapper.ts
export function createRlsInvocationWrapper(options) {
  return async (metadata, fn) => {
    const authCtx = metadata.get('authContext');
    if (!authCtx) return fn();                               // 1. anon → no RLS scope

    // 2. permVer check (HIGH-5 / #173 / #174)
    if (options.permVerRedis) {
      const tokenPv = authCtx.metadata?.pv ?? 0;
      const currentPv = parseInt(await options.permVerRedis.get(`omni:perm-v:${authCtx.userId}`) ?? '0', 10);
      if (currentPv > tokenPv) {
        throw Object.assign(new Error('Permission version stale'), {
          code: 'PERMISSION_VERSION_STALE',
          statusCode: 401,
        });
      }
    }

    // 3. User-activity touch — debounced Redis marker that
    //    the flusher worker in `main` batches into
    //    `users.last_active_at`. Fire-and-forget; a Redis
    //    hiccup must never delay the request.
    if (options.activityRedis) {
      void touchUserActivity(options.activityRedis, authCtx.userId).catch(() => undefined);
    }

    // 4. RLS context propagation
    const rlsCtx = mapAuthToRLSContext(authCtx, { defaultTenantId: authCtx.metadata?.tenantId ?? 'default' });
    return rlsContext.runAsync(rlsCtx, fn);
  };
}
```

In `bootstrap.ts`:

```ts
auth: {
  jwt: { enabled: true, tokenCacheTtl: 60_000 },
  invocationWrapper: createRlsInvocationWrapper({
    permVerRedis: deferredPermVerRedis.ref,
    activityRedis: deferredPermVerRedis.activityRef,
  }),
}
```

The `deferredPermVerRedis` ref is populated in `afterCreate`
once Redis is resolvable from the DI container; the same
underlying client doubles as both the permVer lookup and the
activity-touch sink.

### User activity

The `touchUserActivity` helper performs an atomic
`SET omni:activity:dirty:{userId} <iso-now> NX EX 60` — at most
one Redis write per user per 60 seconds, regardless of request
volume across all five backends. A dedicated
`UserActivityFlusherService` in `main` runs on a 30-second
interval to SCAN the dirty namespace, batch-update
`users.last_active_at` with a `GREATEST()`-clamped UPDATE FROM
VALUES (monotonic and idempotent), then UNLINK the keys.

Worst-case lag from "user did something" to "`users.last_active_at`
advances" is `windowSeconds + flushIntervalMs` ≈ 90 seconds.
No new inter-backend RPC traffic — each backend writes to the
shared Redis namespace; only `main` reads.

## RLS policies

A policy is a per-table allow/deny/filter that runs inside the
plugin BEFORE every SELECT / INSERT / UPDATE / DELETE.

```ts
// rls-schema.ts
export const platformRLSSchema = defineRLSSchema<Database>({
  users: {
    policies: [
      allow('read', () => true, { name: 'publicProfiles' }),
      allow('update', (ctx) => ctx.auth.userId === row(ctx)?.['id'], { name: 'ownUpdate' }),
      allow('update', (ctx) => {
        const targetRole = (row(ctx)?.['platformRole'] as string) ?? 'user';
        return canModerateUserWithRole(ctx.auth.roles, targetRole);
      }, { name: 'tieredAdminUpdate' }),
    ],
    skipFor: ['system'],
    defaultDeny: false,
  },
  // …
});
```

`ctx.auth` carries `userId`, `roles`, `permissions` — the
same shape the application-side gates check.

## STRICT vs PERMISSIVE plugin tiers

A single plugin instance with `allowUnfilteredQueries: true`
was the source of CRIT-2 (RLS effectively advisory). The
schema is split into two tiers via two plugin instances:

```ts
// modules/rbac/rls-plugins.ts
const strict = rlsPlugin({
  schema: platformRLSSchema,
  bypassRoles: ['superadmin'],
  requireContext: true,         // fail closed on missing context
  allowUnfilteredQueries: false, // fail closed on missing filters
});

const permissive = rlsPlugin({
  schema: platformRLSSchema,
  bypassRoles: ['superadmin'],
  requireContext: false,         // anonymous reads OK
  allowUnfilteredQueries: true,
});

for (const t of STRICT_RLS_TABLES) registerTablePlugins(t, […existing, strict]);
for (const t of PERMISSIVE_RLS_TABLES) registerTablePlugins(t, […existing, permissive]);
```

| Tier        | Tables                                                                     | Behaviour                                                                |
|-------------|----------------------------------------------------------------------------|--------------------------------------------------------------------------|
| STRICT      | `audit_logs`, `platform_roles`, `users`, `user_sessions`, `organization_roles` | Queries without auth context → 0 rows / refused. `'system'` escape hatch. |
| PERMISSIVE  | `posts`, `comments`, `organizations`, `employees`, `shops`, `products`, `orders`, `notifications`, `disputes` | Anonymous public reads work. Policies apply to authenticated callers.    |

A `'system'` skipFor is built into every policy as the legitimate
escape for migrations, background workers, and explicit
service-layer transactions.

## permVer counter

The `omni:perm-v:{userId}` Redis key is bumped by any code path
that mutates a user's effective permission set:

```ts
authService.bumpPermissionVersion(userId)     // single bump (INCR + EXPIRE)
authService.bumpPermissionVersionMany(userIds) // batched pipeline
```

Bump sites (production):

| Mutation                                          | Caller                                            |
|---------------------------------------------------|---------------------------------------------------|
| Platform role change (`adminUpdateRole`)          | `UsersService.adminUpdateRole`                    |
| Per-user platform override grant / revoke         | `UserPermissionService.{grant,revoke,replaceAll}` |
| Per-employee org override grant / revoke          | `EmployeePermissionService.{grant,revoke,replaceAll}` |
| Force-transfer org ownership                       | `OrganizationsService.forceTransferOwnership`     |

The JWT carries the snapshot in the `pv` claim. Every backend's
invocation wrapper consults the live counter on every call —
mismatch ⇒ `PERMISSION_VERSION_STALE` (401) ⇒ client refresh
mints a fresh JWT with the up-to-date set.

## Redis fail-open

The permVer check is best-effort: a Redis outage on GET falls
open with an `auth.permver.fail_open` log tag, mirroring
`auth.session.fail_open` (MED-2). The DB-side session-revoke
path remains the authoritative kill switch.

## See also

- [Per-user overrides](./overrides.md) — what triggers a bump.
- [Audit trail](./audit-trail.md) — every bump is audit-logged
  alongside the mutation that triggered it.
- `@kysera/rls` upstream docs — schema authoring details
  beyond the bridge above.
