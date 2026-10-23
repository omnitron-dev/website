---
title: Shared access policy
description: Small, portable roles and permissions shared by issuers, servers and interfaces.
---

# Shared access policy

`@omnitron-dev/access` is the implemented, dependency-free policy core. It runs
in browsers, servers and workers. Use your own role vocabulary and permission
catalog, or import the optional platform preset. Authentication, persistence,
resource ownership and infrastructure remain separate choices.

This guide follows the current source workspace. For a registry release that
includes the package, install it normally:

```bash
pnpm add @omnitron-dev/access
```

Before that release, build and pack it from the framework workspace, then add
the resulting archive to your application and commit its lockfile:

```bash
pnpm --filter @omnitron-dev/access build
pnpm --filter @omnitron-dev/access pack --pack-destination /tmp/access-package
# In the consuming application:
mkdir -p vendor
cp /tmp/access-package/omnitron-dev-access-0.3.1.tgz vendor/
pnpm add ./vendor/omnitron-dev-access-0.3.1.tgz
```

For a reproducible checkout, copy the archive into the application's `vendor/`
directory and use a relative `file:vendor/...tgz` dependency. The framework
workspace and installed registry version can differ; verify the installed
package's `exports` before adopting a new entry point.

## Choose exactly what you need

| Entry point | Includes |
| --- | --- |
| `@omnitron-dev/access` | Role factory and permission primitives |
| `@omnitron-dev/access/roles` | `createRoleHierarchy`, `RoleDefinition`, `RoleHierarchy` |
| `@omnitron-dev/access/permissions` | Matching, compiled checks, catalog helpers and types |
| `@omnitron-dev/access/platform` | Optional `user` → `superadmin` preset |
| `@omnitron-dev/titan-auth/access` | Compatibility facade for the core and platform preset |

The package ships ESM and declarations with `sideEffects: false`. It imports no
Node built-ins, JWT library, Titan container, React or network client. Narrow
imports and a named import from the root both support tree shaking. Importing
permission helpers does not construct the platform hierarchy.

## Define a role policy

```ts
import { createRoleHierarchy } from '@omnitron-dev/access/roles';

export const rolePolicy = createRoleHierarchy({
  reader: { level: 0 },
  author: { level: 10, inherits: ['reader'] },
  reviewer: { level: 20, inherits: ['reader'] },
  editor: { level: 30, inherits: ['author', 'reviewer'] },
  owner: { level: 40, inherits: ['editor'], assignable: false },
});

rolePolicy.expandRoles('reviewer'); // ['reader', 'reviewer']
rolePolicy.canSeeRole(['editor'], 'editor'); // true: visible peers
rolePolicy.canModerateRole(['editor'], 'editor'); // false: strictly higher rank required
rolePolicy.assignableRolesFor(['owner'], ['reader', 'editor', 'owner']);
// ['reader', 'editor']; nonassignable roles stay out of selection lists
```

Rank and inheritance answer different questions. `level` orders visibility,
moderation and assignment. `inherits` explicitly adds capabilities. A reviewer
has a higher rank than an author but does not inherit authorship. Equal-rank
research and customer roles can stay independent. Inheritance must be acyclic;
unknown parents, invalid ranks and empty definitions fail during construction.

Definitions are copied and expansions are precomputed. Returned arrays cannot
mutate the policy. Independent applications can reuse role names without global
configuration or shared state.

| Operation | Contract |
| --- | --- |
| `rolePriority(role)` | Known rank; `-1` for unknown, null or undefined |
| `effectiveLevel(roles)` | Highest recognised rank; `-1` when none exists |
| `canSeeRole(actorRoles, targetRole)` | Known target at or below the actor's rank |
| `canModerateRole(actorRoles, targetRole)` | Known target strictly below the actor's rank |
| `visibleRolesFor(actorRoles, candidates)` | Filters candidates using visibility |
| `assignableRolesFor(actorRoles, candidates, currentRole?)` | Known, assignable candidates within rank; excludes the supplied current role |
| `expandRoles(role)` / `expandRoleSet(roles)` | Stable, deduplicated inheritance expansion |
| `priorities` | Frozen, prototype-free lookup for adapters such as SQL generation |

Unknown roles never become visibility, moderation or assignment targets.
Expansion preserves unknown claims for applications with independent roles;
preserving a string does not establish its authority. Authenticate the principal
before invoking policy and validate persisted grants against your catalog.

## Share a permission catalog

```ts
import {
  definePermission, isValidPermissionKey, createPermissionChecker, resolvePermissions,
} from '@omnitron-dev/access/permissions';

export const catalog = [
  definePermission('workspace.documents.read', 'workspace', 'documents', 'content',
    'Read documents', 'Read documents in the current workspace'),
  definePermission('workspace.documents.edit', 'workspace', 'documents', 'content',
    'Edit documents', 'Change documents in the current workspace', 'high'),
];

isValidPermissionKey('workspace.documents.*', catalog); // true
const allows = createPermissionChecker(['workspace.documents.*'], 'explicit');
allows('workspace.documents.edit'); // true
resolvePermissions(['workspace.documents.*'], catalog, 'explicit');
// ['workspace.documents.read', 'workspace.documents.edit']
```

`PermissionDefinition<Scope>` preserves an application's scope vocabulary.
`domain`, `category`, `label`, `description` and `risk` support administrative
interfaces; they do not change matching. Restrict the catalog to the relevant
scope before validating a new grant. `*` is accepted by the validator, so enforce
who may delegate it separately.

## Select matching semantics explicitly

| Grant → required | `explicit` | `hierarchical` (default) |
| --- | --- | --- |
| `documents.read` → `documents.read` | true | true |
| `documents` → `documents.read` | false | true |
| `documents.*` → `documents.read` | true | true |
| `documents.*` → `documents` | false | false |
| `documents.*` → `documents.` | true, transport compatibility | false |
| `document` → `documents.read` | false | false |
| `research` → `research:read` | false | false |
| `*` → any key | true | true |

Dots define hierarchy; colons are literal characters. There is no general glob
or regex language. Only a full `*` and suffix `.*` have wildcard meaning.
Prefer validated, nonempty concrete keys in an application's catalog.

`permissionGrants` compares one grant. `hasPermission` scans a list for one
required key. `createPermissionChecker` snapshots grants once, uses exact Set
lookup and probes the required key's dot boundaries. Repeated checks therefore
do not scan every grant. Rebuild the checker after changing principal or grants;
do not keep a global checker across requests.

`hasAllPermissions` and `hasAnyPermission` compile once per call. Empty requirements
satisfy all-of and fail any-of. `resolvePermissions` returns recognised effective
keys in catalog order. `expandWildcards` is a compatibility helper: it expands
wildcards but retains concrete grants verbatim, including unregistered ones.

## Compose authentication and enforcement

- With opaque sessions, load the account and grants from your session adapter,
  then evaluate the pure policy. JWT and Titan Auth are unnecessary.
- With the [shared-session preset](../titan/modules/shared-session.md), pass
  `roleExpander: rolePolicy.expandRoleSet`. Use the same definition during token
  issuance and verification. Keep issuer, session namespace and revocation
  policy in the authentication adapter.
- With Netron's `@Auth` gate, permission matching stays **explicit**. Its existing
  helpers now delegate to this core without changing that transport contract.
- In a UI, use the same catalog and matcher to decide which actions to display.
  Every mutation still requires a server decision against current authority.

Before assigning a role, check that the actor may moderate the target's current
role, validate the requested role against the allowed choices, and enforce
self-edit and tenant rules. A dropdown's choices alone are not an access gate.
For SQL filtering, reject unknown target ranks before comparing levels: `-1 <= 3`
alone would incorrectly expose unknown roles. On policy lookup failure, refuse
access; an empty exclusion list is an unrestricted grant.

Service identities are separate from human role rank. A claim named
`service_role` does not itself authenticate a machine or bypass resource policy.
Only a trusted authentication boundary can establish that identity.

## Optional platform preset and migration

The preset exports `PLATFORM_ROLES`, `PlatformRole`, `ROLE_PRIORITY`,
`rolePriority`, `effectiveLevel`, `canSeeUserWithRole`,
`canModerateUserWithRole`, `visibleRolesFor`, `assignableRolesFor`,
`expandRoles` and `expandRoleSet`.

Its ranks are `user: 0`, `moderator: 1`, `security: 2`, `admin: 3`,
`superadmin: 4`. Security inherits user only; admin combines moderation and
security. The retired `boss` claim expands to `user` for compatibility but has
no independent rank or assignability. Unknown claims pass through expansion
without becoming assignable platform roles.

Existing `titan-auth/access` imports remain supported. New shared UI/server
policy should import `access/permissions` and either `access/roles` or
`access/platform` directly. The meaningful tightening is that unknown target
roles are refused. Existing valid platform roles and permission patterns retain
their behavior. Keep Netron's explicit mode and application hierarchical mode
intentional when migrating.

## Verification and build budget

Run `pnpm --filter @omnitron-dev/access test` and
`pnpm --filter @omnitron-dev/access check:bundle` in the source workspace.
The bundle check compiles browser ESM, rejects external runtime modules and
unwanted role presets, and enforces an 8 KiB minified budget per tested entry.
With esbuild 0.28.2, the permission-checker fixture is 328 bytes minified / 242
bytes gzip; the role-factory fixture is 1,651 / 797 bytes. These are isolated
fixtures, not application bundle sizes or latency measurements.

The regression suite covers independent hierarchies, cycles, prototype-shaped
names, unknown roles, immutable snapshots and exhaustive agreement between
compiled and single-grant matching in both modes. Consumer tests must also
cover tenant ownership, token/session revocation and database enforcement.
