---
title: ABAC Conditions
sidebar_position: 3
---

# ABAC Conditions

When a role + permission check isn't enough — when access also
depends on **when**, **where**, or **how recently authenticated**
the caller is — write an ABAC policy.

A `PolicyDefinition` is a named, async, side-effect-free
function that takes the request's `ExecutionContext` and returns
a `PolicyDecision`.

```ts
interface PolicyDefinition {
  name: string;
  description?: string;
  tags?: string[];
  evaluate: (ctx: ExecutionContext) => Promise<PolicyDecision> | PolicyDecision;
}

interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}
```

## Built-in policies

`BuiltInPolicies` ships the common shapes:

| Factory                                          | Purpose                                                        |
|--------------------------------------------------|----------------------------------------------------------------|
| `requireAuth()`                                   | Reject anonymous callers                                       |
| `requireRole(role)`                               | Single role required                                            |
| `requireAnyRole([…])` / `requireAllRoles([…])`   | Combine multiple roles                                          |
| `requirePermission(perm)`                         | Single permission required (wildcard-aware)                     |
| `requireAnyPermission([…])`                       | Any-of                                                          |
| `requireResourceOwner()`                          | `auth.userId === resource.owner`                                |
| `requireTimeWindow(start, end, tz?)`              | Time-of-day window                                              |
| `requireIP([…])` / `blockIP([…])`                 | IP allow / block lists                                          |
| `requireAttribute(path, value)`                   | Arbitrary `auth.metadata[path] === value` match                 |
| `requireScope(scope)` / `requireAnyScope([…])`    | OAuth2/OIDC scope                                                |
| `rateLimit(maxRequests, windowMs)`                | Per-caller rate limit (policy returns deny when over budget)    |
| `requireTenantIsolation()`                        | Multi-tenant invariant: actor's tenant === resource's tenant    |
| `requireEnvironment(env)`                         | Only allow in a specific deploy environment                     |
| `requireFeatureFlag(flag, enabled?)`              | Gate behind a feature flag                                       |

## Custom policies

A custom policy is a plain object — register it on the
PolicyEngine and reference it by name from `@Auth`:

```ts
// my-policies.ts
import type { PolicyDefinition } from '@omnitron-dev/titan/netron/auth';

export const requireRecentMfa = (maxAgeSeconds: number): PolicyDefinition => ({
  name: `recent-mfa:${maxAgeSeconds}s`,
  description: `Caller must have stepped up MFA within the last ${maxAgeSeconds} seconds`,
  tags: ['mfa', 'step-up'],
  evaluate: (ctx) => {
    const stepUpAt = (ctx.auth?.metadata as { stepUpAt?: number } | undefined)?.stepUpAt;
    if (!stepUpAt) return { allowed: false, reason: 'No step-up MFA in session' };
    const ageMs = Date.now() - stepUpAt;
    if (ageMs > maxAgeSeconds * 1000) {
      return { allowed: false, reason: `Step-up MFA expired (${Math.floor(ageMs / 1000)}s ago)` };
    }
    return { allowed: true };
  },
});

// app bootstrap
policyEngine.registerPolicy(requireRecentMfa(300));

// service
@Auth({ policies: ['recent-mfa:300s'] })
async transferLargeAmount(...) { … }
```

## Composition

```ts
// AND (default)
@Auth({ policies: ['role:admin', 'recent-mfa:300s'] })

// OR
@Auth({ policies: { any: ['role:admin', 'role:security'] } })

// NOT
@Auth({ policies: { not: 'block-ip:tor-exits' } })

// Nested
@Auth({
  policies: {
    and: [
      'role:admin',
      { or: ['recent-mfa:300s', 'feature-flag:mfa-bypass'] },
    ],
  },
})
```

The engine short-circuits on the first decisive branch — AND
fails as soon as one leaf denies, OR succeeds as soon as one
allows.

## Failure semantics

`PolicyDecision.reason` is captured into the audit-log alongside
the `false` decision so the operator sees which gate denied and
why. Surface the reason to admins via the same audit-log UI
(see [Audit trail](./audit-trail.md)); never echo it back to
the caller — it's an information leak.

## Per-call configuration

A few of the built-ins take parameters specific to the gate;
prefer the factory form in `@Auth`:

```ts
@Auth({
  policies: [
    BuiltInPolicies.rateLimit(100, 60_000),
    BuiltInPolicies.requireTimeWindow('09:00', '18:00', 'Europe/Berlin'),
    BuiltInPolicies.requireFeatureFlag('beta-checkout-v2', true),
  ],
})
```

These don't need to be pre-registered on the engine — Titan
materialises and caches them per-method at decoration time.

## See also

- [Permissions](./permissions.md) — the simpler permission-only
  gate that covers ~80% of cases.
- [Per-user overrides](./overrides.md) — additive grants on
  top of role-derived permissions.
- [Audit trail](./audit-trail.md) — every policy decision is
  audit-logged with the deny reason.
