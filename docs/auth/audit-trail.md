---
title: Audit Trail
sidebar_position: 5
---

# Audit Trail

Every authorisation-relevant mutation lands in the platform's
`audit_logs` table. The trail is the platform's accountability
substrate — without it, post-incident reconstruction is
impossible on a closed, anonymous platform.

## Shape

```ts
interface NewAuditLog {
  actorId?: string;          // user.id (always from JWT — never from request body)
  actorType: 'user' | 'organization' | 'system' | 'admin';
  action: string;            // dot-separated event name
  targetType?: string;       // 'user' | 'employee' | 'organization' | 'shop' | …
  targetId?: string;
  details?: Record<string, unknown>;
  userAgent?: string;
}
```

Two invariants the platform protects mechanically:

1. **`actorId` is always taken from the verified JWT**
   (`actorId()` helper in `@daos/auth-utils`). It is NEVER
   read from a request DTO. This closes the audit-log
   spoofing class of bugs (see CRIT-1 fix).
2. **The `audit_logs` table is in the STRICT RLS tier**
   (`requireContext: true, allowUnfilteredQueries: false`).
   A raw `sql\`SELECT …\`` without an authenticated context
   refuses to return rows — the only legitimate writers are
   service-layer code paths running under a real JWT or the
   `'system'` escape hatch (migrations, workers).

## What gets logged

| Surface                                       | Action prefix                            |
|-----------------------------------------------|------------------------------------------|
| User suspend / ban / role-change              | `admin.user.statusChanged`, `admin.user.roleChanged` |
| Role CRUD (platform)                          | `admin.role.created`, `admin.role.updated`, `admin.role.deleted` |
| Per-user platform-permission overrides        | `admin.user.permissionGranted`, `admin.user.permissionRevoked`, `admin.user.permissionsReplaced` |
| Per-employee org-permission overrides         | `org.employee.permissionGranted`, `org.employee.permissionRevoked`, `org.employee.permissionsReplaced` |
| Force-transfer org ownership (admin recovery) | `admin.org.ownership.forceTransferred` |
| Org lifecycle (approve / suspend / ban / verify) | `org.approved`, `org.suspended`, `org.banned`, `org.verificationUpdated` |
| Shop moderation                                | `shop.approved`, `shop.suspended`, `shop.banned`, `commerce.shop.*` |
| Disputes                                       | `dispute.moderatorAssigned`, `dispute.resolved` |
| Auth (privileged actions on a user)            | `auth.password.reset`, `auth.totp.disabled`, `auth.pgp.disabled`, `auth.sessions.revoked` |

Every admin-side RPC method that mutates a privileged resource
either writes through `AuditLogRepository.log()` directly or
delegates to a service that does (the per-permission services
in [Per-user overrides](./overrides.md) are the canonical
template).

## Recovery + actor capture invariant

The admin recovery surface
(`OrganizationsService.forceTransferOwnership`) requires the
operator to supply a `reason` (minimum 8 characters) and
captures it into the audit-log alongside the
recovering-admin's id:

```ts
{
  actorId,                  // recovering admin (from JWT)
  actorType: 'admin',
  action: 'admin.org.ownership.forceTransferred',
  targetType: 'organization',
  targetId: orgId,
  details: { fromUserId, toUserId, reason },
}
```

Same pattern applies to other recovery-style actions; the
reason is enforced at the RPC-zod schema level so it never
becomes optional by convention.

## Read surface

The admin UI reads via the `Audit` RPC service:

- `/admin/audit` — global feed, filterable by `action`,
  `targetType`, `targetId`, date range.
- Per-user/per-org audit tabs — same query, scoped to the
  entity.

The read path itself is gated on `admin.audit.view` and
double-protected by the STRICT RLS policy on `audit_logs`:

```ts
audit_logs: {
  policies: [
    allow('read', (ctx) => hasPermission(ctx.auth.permissions ?? [], 'admin.audit.view'), { name: 'adminAuditRead' }),
    deny(['create', 'update', 'delete'], () => false, { name: 'systemOnlyWrite' }),
  ],
  skipFor: ['system'],
  defaultDeny: true,
}
```

`create` is denied for every role except `'system'` so audit
entries can only be written through the authorised
service-layer path — never via a raw client-issued INSERT.

## Redaction

Free-form `details` blobs are written as-is. Two rules:

1. **Never include passwords, secrets, or tokens.** The
   conventional shape is `{ field: 'password', changed: true }`
   — record that the field changed, not its value.
2. **For free-form text fields** (e.g. `reason`), the value
   stays as the operator typed it. The audit log is internal
   to the platform's administrators.

A redaction sweep over historical entries is a separate
batch job — see the security checklist for the procedure.

## See also

- [Permissions](./permissions.md) — `admin.audit.view` and the
  registry it sits in.
- [RLS bridge](./rls-bridge.md) — STRICT tier guarantees on
  `audit_logs`.
- [Mental model](./mental-model.md) — how audit ties the four
  layers together.
