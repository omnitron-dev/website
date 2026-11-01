---
title: Shared-session authentication
description: Live session authority, revocation and consistent grants across backends.
---

# Shared-session authentication

`createSharedSessionAuthManager` verifies JWTs through `IJWTService` and binds
human credentials to a live session. The application owns sign-in, persistence,
role vocabulary and session creation. Titan owns claim validation and transport
enforcement. [Access](../../auth/access-policy.md) supplies the pure policy rules.

## Canonical authority

Use this mode when the next request must reflect committed changes to sessions,
accounts or role permissions. Return the session and grants from one consistent
snapshot; do not reconstruct authority from a cached JWT permission array.

```ts
import { createSharedSessionAuthManager, type SessionAuthorityLookup }
  from '@omnitron-dev/titan-auth/preset/shared-session';

// Application adapter: one database snapshot, including account status,
// current role grants and any session-specific conditions.
declare const lookup: SessionAuthorityLookup;

const auth = createSharedSessionAuthManager({
  logger,
  jwtService,
  expectedIssuer: 'my-platform',
  sessionAuthority: lookup,
  roleExpander: applicationRoles.expandRoleSet,
});
app.netron.configureAuth(auth);
```

`sessionAuthority(sessionId, userId)` returns `undefined` for an absent or
revoked principal, or a record with `userId`, `expiresAt`, `isRevoked`, `roles`
and `permissions`. It may include `activeRefreshTokenId`. Account suspension,
MFA proof and role conditions belong in this application-owned lookup. The
preset validates the response and refuses a mismatch between subject and owner.
Current roles and permissions replace the corresponding JWT claims.

A database or RPC failure returns 503; it never becomes an authenticated request
or a false assertion that the user signed out. Missing, expired or revoked
sessions are rejected as 401. Keep tokens and signing material out of logs.

## Cooperating backends

`SessionAuthorityService` from
`@omnitron-dev/titan-auth/preset/session-authority` adapts the lookup to Netron:

```ts
await app.netron.peer.exposeService(new SessionAuthorityService(lookup));
```

`SessionAuthority.resolve({ sessionId, userId })` requires **both**
`service_role` and `sessions.resolve`. It returns a minimal authority snapshot,
without bearer credentials. A consumer supplies a `sessionAuthority` callback
which invokes this service through its authenticated Netron client. Configure
bounded deadlines and dispose that client with the application. Do not fall
back to stale grants when the owner is unavailable.

Deploy the owner endpoint before consumers. For high availability, provide
redundant owner instances and an appropriate database failover policy. The
lookup is read-only; retries must remain bounded. This contract avoids a
second copy of the account schema or permission engine in every backend.

## Registry compatibility mode

Alternatively supply `sessionRedis`, with `get(key)` and an optional
`sessionLookup(sessionId)` for a registry miss or outage. The lookup returns
`userId`, `expiresAt`, `isRevoked` and optionally `activeRefreshTokenId`.
A healthy registry hit does not consult the fallback.

The preset **never writes Redis**. An unconditional cache write after a lookup
can resurrect a concurrently revoked session. Restore entries only through an
adapter serialized with revocation. Registry mode is only as current as that
update protocol; use canonical mode for immediate committed-state enforcement.

## Credentials and expiry

Human tokens require bounded string `sub` and `sid` claims and a finite,
unexpired integer `exp`. A human session claiming `service_role` is rejected.
Service tokens omit `sid` and must be issued through a separately controlled
service-credential flow. Role inheritance cannot promote a human to that tier.

Netron revalidates token-backed persistent peers before calls, property access
and core tasks. The checked context is bound to the invocation, including
property getters and setters. Token expiry bounds authentication cache entries.
An already admitted invocation retains its snapshot; sensitive writes should
also enforce ownership and current authority under their transaction's locks.

| Option | Meaning |
| --- | --- |
| `expectedIssuer` | Defaults to `omnitron`; `null` explicitly disables issuer checking |
| `sessionAuthority` | Live session and grants on every validation; bypasses registry mode |
| `sessionKeyPrefix` | Registry namespace; defaults to `omni:session:` |
| `cacheTtl` | Deprecated; this preset never caches authentication results |
| `cnfHmacSecret` | Checks an access token's confirmation against the active refresh-token ID |
| `roleExpander` | Optional application role hierarchy |

Signature verification may be cached by `IJWTService`; live authority is a
separate decision. When `cnf.fp` is present in canonical mode with a configured
secret, a missing or changed active refresh-token ID rejects the credential.
Legacy registry values without refresh-token IDs cannot provide that guarantee.
Issuer and verifier must agree on the binding secret and rotation protocol.

## Session conditions

`evaluateSessionPolicy` from `@omnitron-dev/access/session-policy` provides a
pure evaluator for `requireMfa`, absolute `maxSessionDuration` in minutes, and
`timeWindows` with IANA timezones. Supply the original session creation time and
persisted proof of completed MFA. Enrollment alone is insufficient. Evaluate on
every protected request and renewal; renewing a token must not reset session age.
Unknown or malformed conditions fail closed.

See [JWT configuration](./auth.mdx), [RPC authentication](../netron/authentication.md)
and [token issuance](../../auth/token-issuance.md) for the surrounding lifecycle.
