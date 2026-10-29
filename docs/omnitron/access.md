---
title: Console access
description: Human roles, effective RPC permissions, account administration and revocation shared by Console and CLI.
---

# Console access

The **Access** page (`/access`) shows the permissions of the current account. Administrators can create accounts, change roles and revoke sessions. `omnitron access` calls the same `OmnitronAccess` service. The service runs on a master with PostgreSQL and an audit service.

## One policy across interfaces

The daemon publishes methods with Titan `@Public({ auth: … })` metadata. `OmnitronAccess.describe()` reads that metadata from the services actually registered in Netron and evaluates it with Titan's access validator and authorization manager. The browser receives a catalog of `service.method` capabilities; it does not maintain a second role-to-action matrix.

| Role | Intended use | Examples |
| --- | --- | --- |
| `viewer` | Observe infrastructure | Status, logs, metrics, health and deployment history |
| `operator` | Operate applications | Viewer reads plus lifecycle, deployment and permitted node operations |
| `admin` | Administer the control plane | Operator actions plus accounts, configuration, secrets, SSH terminals and arbitrary-code automation |

These are the existing daemon roles, defined through `@omnitron-dev/access/roles`. Exact grants come from each RPC method, not this summary. `service_role` is a separate machine identity and cannot be assigned to a human account.

Prism's narrow `@omnitron-dev/prism/auth` entry supplies guards without importing authentication forms or layouts. Console gates navigation, page entry, mutation controls and dialogs using the catalog. It refreshes while visible every 15 seconds; a failed refresh clears effective grants until verification succeeds. A role change is enforced by the server independently of this refresh interval.

A catalog grant describes a method-level rule. Resource ownership, live sessions and other checks still apply during invocation. Dynamic policies that need call arguments are marked **Conditional**, and the UI does not grant them speculatively. A hidden control never replaces server authorization.

## Manage accounts

In **Access → Console accounts**, create a named account with the least powerful suitable role. Creation defaults to viewer. Usernames allow 1–128 letters, digits and `. _ @ + -`, beginning with a letter or digit. The initial password and later password changes use the same validation: at least 15 Unicode characters and at most 256 UTF-8 bytes. Secrets are never included in account listings or audit details.

```bash
omnitron access show
omnitron access users
omnitron access create observer --role viewer --password-stdin
omnitron access create deployer --role operator --display-name 'Deployment operator' --password-stdin
```

On a terminal, `--password-stdin` opens a hidden prompt. A pipe is read until EOF. Do not put a password in shell arguments or checked-in scripts. Account creation in the browser requires HTTPS, with a loopback exception for local development.

Account lists contain at most 100 entries and a continuation cursor. Use `omnitron access users --after <id>` for the next page. Global `--json` is supported.

## Change roles and revoke sessions

Review the current role first, then submit it as the expected previous value:

```bash
omnitron access role <account-id> operator --expect viewer
omnitron access revoke <account-id>
```

Role changes are serialized in PostgreSQL and revalidate the actor inside the transaction. A stale expected role fails rather than overwriting another administrator's change. The last administrator cannot be demoted. A human administrator cannot change their own role; use another administrator. The owner-only local CLI retains its OS-authorized recovery path.

Changing a role deletes that account's sessions and records `account.role.change` in the same transaction. Creating an account records `account.create`; explicit revocation records `account.sessions.revoke`. If the audit insert fails, the transaction rolls back. Read the events in **Audit** or with `omnitron audit --resource account`.

After commit, the daemon invalidates cached tokens and removes authority from admitted persistent peers. A validation already in flight cannot restore a cached grant after revocation. SSH checks the live session on every operation and during its two-second lifecycle sweep. The account signs in again to obtain its new role.

Revocation ends sessions; it does not disable an account or change its password. The owner can sign in again. Changing one's password preserves the caller's session and revokes the others. Sign-out also invalidates cached authority for the affected session.

## Scope and extension points

Console roles govern infrastructure administration. Application users, organization memberships and tenant-specific policies belong to the application's access layer; see [Authentication and authorization](../auth/index.md). Selecting a project in Console filters the workspace and is **not** a tenant security boundary.

This release manages the three fixed daemon roles. It does not add custom role editing, per-project grants, invitations, account suspension, SSO, passkeys or MFA enrollment. The database's second-factor fields alone do not enable those flows. Add such features through the shared access policy and server authorization before exposing controls in Console.

## Activation

Update the master backend and Console as one release. Before switching the
served frontend, verify `omnitron access show` against the restarted master.
An older daemon without `OmnitronAccess` cannot supply the permission catalog;
the new UI then denies access instead of inventing grants. See the
[Console build workflow](./console.md#production-build) for staging validation
assets without replacing a running frontend.

## Implementation and validation

The implementation is in `apps/omnitron/src/services/access.rpc-service.ts`, `shared/roles.ts`, `shared/dto/access.ts` and `webapp/src/auth/access.tsx`. New public methods appear automatically in the catalog; new UI actions must use their typed RPC permission.

Integration tests exercise real PostgreSQL transactions and HTTP authorization: role boundaries, stale edits, last-admin protection, audit failure rollback and cached-token revocation. Browser tests cover pending grants, failed refresh, account changes and viewer isolation. See [SSH workspace](./terminal.md) for terminal-specific ownership and limits.

## Automation and future agents

Xec pipeline methods require `admin`, including definition and run-history reads. A run revalidates the human session and requires a durable audit intent and the reviewed definition revision. An operator's application lifecycle rights do not grant arbitrary shell execution. See [Xec automation](./automation.md).

The local MCP server uses the daemon owner's administrative Unix socket. Tool selection in an agent client does not reduce that underlying authority. It is not a delegated identity. Embedded agents require a broker, isolated workers and resource-scoped grants evaluated by this same access layer; the [agent design](./agents.md) describes the boundary and acceptance tests. That delegated path is not enabled yet.
