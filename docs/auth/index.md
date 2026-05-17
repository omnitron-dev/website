---
title: Authentication & Authorisation
sidebar_position: 0
---

# Authentication & Authorisation

:::caution Design RFC
The roles + permissions + ABAC + RLS-bridge stack documented in this section is an in-progress architectural target. The current Omnitron build ships only the base auth surface — JWT issuance, session lifecycle, and a single `admin` role (see `OmnitronAuth` in [services-reference](../omnitron/services-reference.md#omnitronauth--authrpc-servicets)). Treat these pages as the design reference, not a feature you can flip on today.
:::

The Titan/Omnitron auth surface is split into four layers. Each
layer is independently composable; the page you're reading next
should be picked by what you're trying to do.

| If you want to…                                                | Start here                                |
|----------------------------------------------------------------|-------------------------------------------|
| Verify a JWT and resolve a user                                | [`@titan-auth` JWT primitives](../titan/modules/auth.mdx) |
| Gate an RPC method on a role / permission / policy             | [`@Auth` decorator & PolicyEngine](../titan/netron/authentication.md) |
| Compose a permission string (grammar, wildcards, hierarchy)    | [Permissions](./permissions.md)           |
| Grant a permission to a single user on top of their role       | [Per-user overrides](./overrides.md)      |
| Apply attribute-based conditions (time window, MFA, IP)        | [ABAC conditions](./abac-conditions.md)   |
| Project the auth context onto a `@kysera/rls` policy           | [RLS bridge](./rls-bridge.md)             |
| Capture every authorisation decision for audit                 | [Audit trail](./audit-trail.md)           |
| Understand how the four layers fit together                    | [Mental model](./mental-model.md)         |
| Migrate from `@RequireRole(...)` to permission strings         | [Migration: auth v1 → v2](../titan/migrations/auth-1-to-2.md) |

## Reading order for first-time integrators

1. **[Mental model](./mental-model.md)** — one page, one diagram,
   how roles / permissions / conditions / RLS combine.
2. **[Permissions](./permissions.md)** — grammar, wildcards,
   hierarchical prefix grant. Read once, reference forever.
3. **[`@titan-auth`](../titan/modules/auth.mdx)** — set up the
   JWT verifier and the `@Auth` decorator.
4. **[ABAC conditions](./abac-conditions.md)** when you need
   gates beyond role/permission (time of day, MFA-stepped-up,
   request IP, feature flag).
5. **[RLS bridge](./rls-bridge.md)** when your gates also need
   to apply at the database layer.
6. **[Audit trail](./audit-trail.md)** when you need to prove,
   after the fact, that a decision was made the way it was.

Every page links back to the runnable examples in
[`recipes/api-service`](../titan/recipes/api-service.md) and
[`recipes/multi-tenant-saas`](../titan/recipes/multi-tenant-saas.md).
