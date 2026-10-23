---
title: Shared-session authentication
description: Configure the shipped JWT and session-registry preset for multiple backends.
---

# Shared-session authentication

`@omnitron-dev/titan-auth/preset/shared-session` exports
`createSharedSessionAuthManager`. It verifies JWTs through the supplied
`IJWTService`, validates claims and checks a shared session registry.
The resulting `AuthenticationManager` can be passed to
`app.netron.configureAuth(...)` before the application starts.

The preset does not implement sign-in, account storage or session creation.
The authentication owner creates those records and issues tokens.
See [token issuance](../../auth/token-issuance.md) for HTTP token transport.

## Required integration

```typescript
import {
  createSharedSessionAuthManager,
  type SharedSessionAuthManagerOptions,
} from '@omnitron-dev/titan-auth/preset/shared-session';

export function sessionAuth(dependencies: SharedSessionAuthManagerOptions) {
  return createSharedSessionAuthManager({
    ...dependencies,
    expectedIssuer: 'omnitron',
    sessionKeyPrefix: 'omni:session:',
    cacheTtl: 60_000,
  });
}
```

Supply `logger`, `jwtService` and `sessionRedis`. Resolve these dependencies
from the application after creation and before opening its transports.
`sessionRedis` implements `get`; its optional `set` supports rewarming
with an expiry. Use a separate registry namespace for each environment.

## Verification path

1. `jwtService.verify` checks the token.
2. `sub` must be a nonempty string. `iss` must match `expectedIssuer`
   unless the issuer check was explicitly disabled.
3. User tokens must carry `sid`. A session-bearing token is always a
   human session even if a role claim names `service_role`.
4. The preset reads the session from Redis. A miss or Redis failure can
   fall back to the supplied `sessionLookup`.
5. A live canonical record can rewarm Redis for its remaining lifetime.
   Missing, revoked or expired sessions are refused.

A service-tier token without `sid` follows the separate service-principal
path. Control which trusted issuer may mint that claim; do not derive it
from a user-editable account property.

## Canonical-store fallback

`SessionLookup` receives a session ID and returns either `undefined` or a
record with `userId`, `expiresAt` and `isRevoked`. It can also return
`activeRefreshTokenId` for confirmation-claim verification.

Wire this adapter on the backend that owns the authoritative session
store. A sibling without it relies on Redis and refuses a session that
the registry cannot confirm. Test Redis restart, missing entries,
canonical-store failure, expiry and revocation.

## Options that affect security

| Option | Behaviour |
| --- | --- |
| `expectedIssuer` | Defaults to `omnitron`; `null` disables issuer checking |
| `sessionKeyPrefix` | Defaults to `omni:session:` |
| `cacheTtl` | Authentication cache lifetime in milliseconds; defaults to `60_000` |
| `cnfHmacSecret` | Enables confirmation-claim verification when the token and session record supply the required fields |
| `roleExpander` | Unset preserves claims verbatim; pass an application hierarchy’s `expandRoleSet` or the optional platform expander |

Redis accepts the legacy user-ID string and the structured session value
with user and refresh-token IDs. A legacy record without a refresh-token
ID does not enforce `cnf.fp`. Likewise, leaving `cnfHmacSecret` unset
disables that check. The issuer and verifier must agree on the confirmation
secret and refresh-token identity before relying on rotation to invalidate
earlier access tokens.

Account for the authentication cache when defining revocation latency.
Verify the actual behaviour of already-cached tokens in your deployment.

## Failures

`InvalidTokenClaimError` exposes code `INVALID_TOKEN_CLAIM`;
`SessionRevokedAuthError` exposes `SESSION_REVOKED`. Both carry HTTP status
401. Keep failure logs free of token contents and signing material.

Use the [module auth reference](./auth.mdx) for JWT configuration and
[RPC authentication](../netron/authentication.md) for authentication,
authorization and HTTP token transport as distinct responsibilities.

## A shared application hierarchy

```ts
import { createRoleHierarchy } from '@omnitron-dev/access/roles';
const roles = createRoleHierarchy({
  reader: { level: 0 },
  editor: { level: 1, inherits: ['reader'] },
});
// Pass roleExpander: roles.expandRoleSet to createSharedSessionAuthManager.
// Use roles.expandRoleSet during token issuance as well.
```

[Shared access policy](../../auth/access-policy.md) describes unknown claims,
service identity, rank boundaries and the optional platform preset.
