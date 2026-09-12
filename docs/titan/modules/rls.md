---
title: RLS context guards
description: The shipped context guard decorators, their bypass semantics and the boundary with database policies.
---

# RLS context guards

`@omnitron-dev/titan/module/rls` is a public entry point for guard
decorators. Despite its path, it does not export an `RlsModule` to register.
The decorators read the current `@kysera/rls` context directly.

```typescript
import { RequireRlsContext } from '@omnitron-dev/titan/module/rls';

class TenantReports {
  @RequireRlsContext({ requireUser: true, requireTenant: true })
  async list() {
    // Query a repository whose row policies are configured separately.
    return [];
  }
}
```

Establish a trusted context before invoking the method. A context supplied
from unverified request data is not an authorization boundary.

## Guards and behaviour

| Export | Check |
| --- | --- |
| `RequireRlsContext(options?)` | Context exists, plus the selected user, tenant, role and permission requirements |
| `RequireUser()` | Context has a user |
| `RequireTenant()` | Context has a tenant |
| `RequireRole(role)` | Context has a user and the named role |
| `RequirePermission(permission)` | Context has a user and the named permission |
| `RequireAdmin()` | Context is explicitly marked `auth.isSystem`; an `admin` role string alone is insufficient |
| `RlsProtected(message?)` | Any RLS context is present |
| `getRlsGuardRequirements(target, key)` | Reads declared guard metadata |
| `RlsGuardError` | Error raised when a guard requirement is not met |
| `RLS_GUARD_METADATA_KEY` | Metadata key containing the declared requirements |

`RequireRlsContextOptions` accepts `requireUser`, `requireTenant`,
`roles`, `permissions` and `message`. Within `roles` and `permissions`,
the implementation accepts **any** matching entry. Supplying both groups
requires each group to pass. A trusted context with `auth.isSystem`
**bypasses these checks**.

The wrapper is asynchronous. Await guarded methods and test both accepted
and rejected calls.

## Three separate boundaries

1. [RPC authentication](../netron/authentication.md) establishes identity.
2. A context guard controls whether a method may execute in that context.
3. [Database RLS](./database.mdx) constrains the rows read or written.

A decorator alone does not install database row policies, start a
transaction or propagate identity across a remote call. Test tenant
isolation at the repository boundary, including missing context and a
cross-tenant request.

The broader [RLS bridge](../../auth/rls-bridge.md) is a design proposal
for composition. Its permission-version and activity-tracking extensions
are separate from these shipped guards.
