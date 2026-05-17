---
title: Mental Model
sidebar_position: 6
---

# Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│                       JWT (per request)                      │
│  sub | roles[] | permissions[] | pv | sid | cnf.fp           │
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
             ▼                           ▼
   ┌────────────────────┐     ┌─────────────────────────┐
   │  Invocation        │     │  PermVer counter (Redis)│
   │  wrapper           │     │  omni:perm-v:{userId}   │
   │  (per-RPC)         │◄────┤                         │
   └──────┬─────────────┘     └─────────────────────────┘
          │  pass → propagate AuthContext into:
          │
  ┌───────┼─────────────────┬──────────────────────────┐
  │       │                 │                          │
  ▼       ▼                 ▼                          ▼
┌──────┐┌──────────┐  ┌─────────────────┐   ┌────────────────┐
│@Auth ││@kysera/  │  │ DynamicPolicy   │   │ Service-layer  │
│ gate ││ rls      │  │  (org scope)    │   │ requirePermiss-│
│      ││ policies │  │                 │   │ ion() helpers   │
└──┬───┘└────┬─────┘  └────────┬────────┘   └────────┬───────┘
   │         │                  │                    │
   └─────────┴──────┬───────────┴────────────────────┘
                   ▼
            ┌──────────────┐
            │  Audit log   │  (every privileged action)
            └──────────────┘
```

Four layers. They share **one** identity (the JWT-resolved
`AuthContext`), **one** permission grammar (`shared/permission-engine.ts`),
**one** counter (`omni:perm-v:{userId}`), and **one** audit
sink (`audit_logs`).

## Layer 1 — Roles

A user has one or more roles. Each role names a default
permission set. Roles are coarse — fewer than ten platform-
wide and a handful per organisation. Tier predicates
(`canModerateUserWithRole`) live in `@daos/auth-utils/role-hierarchy`
and are the only consumer of role-priority numbers; gates that
care about specific capabilities check **permissions**, not
roles.

## Layer 2 — Permissions

Strings in the canonical registry, matched by the engine, baked
into the JWT at mint time. Wildcards expand to sets of keys;
hierarchical prefixes grant child keys. The engine's matcher
is the **single source of truth** for "does this granted set
authorise this required permission?" — used unchanged on both
the platform and org scopes, on the server `@Auth` decorator,
on the @kysera/rls policy ctx, and on the frontend
`<PermissionGuard>` / `usePermission()`.

## Layer 3 — ABAC conditions

When role + permission isn't enough, a `PolicyDefinition`
attaches an attribute test: time window, recent step-up MFA,
request IP, feature flag, rate-limit. Built-in factories cover
the common shapes; custom policies are plain objects registered
on the `PolicyEngine`. Composition via `{and|or|not}`.

## Layer 4 — RLS

@kysera/rls policies fire on every DB query and consume the
SAME `AuthContext` that the application-side gates see. The
STRICT tier (`audit_logs`, `platform_roles`, `users`,
`user_sessions`, `organization_roles`) fails closed on a
missing auth context — raw SQL without context cannot leak
through. Other tables run permissive for anonymous reads.

## Live propagation

Every mutation to a user's effective permission set bumps
`omni:perm-v:{userId}`. The invocation wrapper compares the
JWT's `pv` snapshot against the live counter on every call;
mismatch ⇒ refresh-token flow ⇒ new JWT with the updated set.
The propagation window is bounded by one RPC round-trip —
no re-sign-in.

## Why one mental model?

Before the unification:

- The platform-scope matcher (`shared/permissions.ts`) accepted
  only `.*` wildcards.
- The org-scope matcher (`dynamic-policy.service.ts`) walked
  segment wildcards AND honoured hierarchical prefix grant.
- Two registries (`shared/permissions.ts` + org-roles JSON)
  could disagree.
- Three frontend copies of `ADMIN_ROLES = ['admin','superadmin']`
  drifted.
- `audit_logs` had a pass-through RLS policy.
- The `/admin` route gated on a hand-coded role-set that
  silently excluded moderator and security tiers.

Each of those was a real bug. The architecture above closes
them by making the layers share substrate — there is exactly
one place to look when something authorises (or doesn't)
unexpectedly.

## See also

- [Permissions](./permissions.md) — grammar, matcher, registry.
- [Per-user overrides](./overrides.md) — additive grants and
  live propagation.
- [ABAC conditions](./abac-conditions.md) — non-permission gates.
- [RLS bridge](./rls-bridge.md) — DB-layer enforcement +
  permVer wiring.
- [Audit trail](./audit-trail.md) — accountability layer.
