---
sidebar_position: 8
title: OAuth callback
description: PKCE-protected authorisation-code flow with state validation and signed-URL session bootstrap.
---

# OAuth callback

Handling an OAuth 2.0 authorisation-code flow correctly has a long
checklist: state validation, PKCE, token exchange, refresh
storage, and bootstrapping the user's session. This recipe shows
the canonical shape using `titan-auth`, `titan-cache` (for the
short-lived state), and the rest of the standard stack.

## Shape

- **PKCE.** The initiating page generates `code_verifier` +
  `code_challenge` (SHA-256). The callback validates against the
  stored verifier.
- **State parameter.** Random, opaque, short-TTL, tied to one
  session. Replaying a state from another browser fails.
- **Token exchange.** Authorisation code → access + refresh
  tokens — server-side only, never in the browser.
- **Signed session bootstrap.** Issue a signed URL with a JWT
  pointing back to your app's session endpoint.

## Architecture

```mermaid
sequenceDiagram
  participant U as User
  participant App as Your app
  participant P as OAuth provider

  U->>App: GET /auth/start
  App->>App: Generate state + PKCE verifier; cache(state → verifier, TTL 10m)
  App-->>U: Redirect to provider with state + code_challenge
  U->>P: Authenticate
  P-->>U: Redirect to /auth/callback?code=&state=
  U->>App: GET /auth/callback?code=...&state=...
  App->>App: Lookup state; retrieve verifier; pop from cache
  App->>P: POST /token { code, code_verifier, redirect_uri }
  P-->>App: { access_token, refresh_token, id_token }
  App->>App: Verify id_token; create local session
  App->>App: Sign a session-bootstrap JWT
  App-->>U: Redirect to /session/bootstrap?token=...
```

## Setup

```typescript
import { Module } from '@omnitron-dev/titan';
import { ConfigModule } from '@omnitron-dev/titan/module/config';
import { LoggerModule } from '@omnitron-dev/titan/module/logger';

import { TitanAuthModule } from '@omnitron-dev/titan-auth';
import { TitanCacheModule } from '@omnitron-dev/titan-cache';
import { TitanRedisModule } from '@omnitron-dev/titan-redis';
import { TitanRateLimitModule } from '@omnitron-dev/titan-ratelimit';

@Module({
  imports: [
    ConfigModule.forRoot({/* … */}),
    LoggerModule.forRoot({ level: 'info' }),

    TitanRedisModule.forRoot({ config: { url: env.REDIS_URL } }),

    // Short-lived auth state cache
    TitanCacheModule.forRoot({
      maxSize:        10_000,
      defaultTtl:     600,                    // 10 min
      evictionPolicy: 'ttl',
    }),

    TitanAuthModule.forRoot({
      algorithm:     'HS256',
      jwtSecret:     env.JWT_SECRET,
      issuer:        env.APP_ISSUER,
      audience:      env.APP_AUDIENCE,
      urlSigningKey: env.URL_SIGNING_KEY,
    }),

    TitanRateLimitModule.forRoot({
      enabled:         true,
      storageType:     'redis',
      defaultLimit:    10,                   // 10 OAuth starts per minute per IP
      defaultWindowMs: 60_000,
    }),

    AuthFlowModule,
  ],
})
export class AppModule {}
```

## Implementation

```typescript
import { Service, Public, Inject } from '@omnitron-dev/titan';
import { Errors } from '@omnitron-dev/titan/errors';
import {
  JWT_SERVICE_TOKEN, SIGNED_URL_SERVICE_TOKEN,
  type IJWTService, type ISignedUrlService,
} from '@omnitron-dev/titan-auth';
import { CACHE_SERVICE_TOKEN, type ICacheService }
  from '@omnitron-dev/titan-cache';
import { createHash, randomBytes } from 'node:crypto';

const PROVIDER_AUTHORIZE = 'https://idp.example.com/oauth/authorize';
const PROVIDER_TOKEN     = 'https://idp.example.com/oauth/token';
const CLIENT_ID          = process.env.OAUTH_CLIENT_ID!;
const CLIENT_SECRET      = process.env.OAUTH_CLIENT_SECRET!;
const REDIRECT_URI       = `${process.env.APP_BASE_URL}/auth/callback`;

@Service({ name: 'auth-flow' })
class AuthFlowService {
  constructor(
    @Inject(CACHE_SERVICE_TOKEN)        private readonly cache:  ICacheService,
    @Inject(JWT_SERVICE_TOKEN)          private readonly jwt:    IJWTService,
    @Inject(SIGNED_URL_SERVICE_TOKEN)   private readonly signer: ISignedUrlService,
  ) {}

  /**
   * Step 1: start the flow. Returns the provider URL to redirect to.
   */
  @Public()
  async start(): Promise<{ redirectTo: string }> {
    const state    = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    // Cache state → verifier with TTL = 10 min
    await this.cache.getCache('auth-flow').set(`state:${state}`, verifier, { ttl: 600 });

    const url = new URL(PROVIDER_AUTHORIZE);
    url.searchParams.set('response_type',         'code');
    url.searchParams.set('client_id',             CLIENT_ID);
    url.searchParams.set('redirect_uri',          REDIRECT_URI);
    url.searchParams.set('state',                 state);
    url.searchParams.set('code_challenge',        challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('scope',                 'openid profile email');

    return { redirectTo: url.toString() };
  }

  /**
   * Step 2: handle the provider's callback.
   */
  @Public()
  async callback(code: string, state: string): Promise<{ bootstrapUrl: string }> {
    // Validate state — atomic get-and-delete so it can't be replayed
    const cache = this.cache.getCache<string>('auth-flow');
    const verifier = await cache.get(`state:${state}`);
    if (!verifier) throw Errors.unauthorized('invalid or expired state');
    await cache.delete(`state:${state}`);

    // Exchange code for tokens
    const response = await fetch(PROVIDER_TOKEN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        code_verifier: verifier,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    if (!response.ok) throw Errors.unauthorized('token exchange failed');
    const tokens = await response.json();
    // tokens: { access_token, refresh_token, id_token, expires_in }

    // Verify the id_token (the OAuth provider's JWT proves the user)
    // For external IDPs, use TitanAuthModule with jwksUrl for this verify.
    // Project-specific: store refresh_token securely (encrypted-at-rest).

    // Bootstrap the local session via signed URL
    const bootstrapToken = await this.signer.createSignedToken(
      {
        resource: 'session/bootstrap',
        // any minimal claims you need to bootstrap
        accessTokenHash: createHash('sha256').update(tokens.access_token).digest('hex'),
      },
      120,    // 2 min expiry — single-use
    );

    return {
      bootstrapUrl: `${process.env.APP_BASE_URL}/session/bootstrap?token=${bootstrapToken}`,
    };
  }
}
```

## Cross-module wiring notes

| Concern                          | Wiring detail                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| State cache name                 | Dedicated cache (`'auth-flow'`) — keeps short-lived auth state separate from app data           |
| State key vs the value           | Cache key = `state:${state}` (opaque); value = `verifier`. State is what the URL carries; verifier never leaves the server. |
| State TTL                        | 10 minutes is generous — most users finish in seconds. Shorter is fine.                         |
| Atomic state consumption         | `get` + `delete` — prevents replaying the same state. The `getOrSet` pattern doesn't apply here. |
| PKCE algorithm                   | SHA-256 base64url; matches `code_challenge_method: 'S256'`                                      |
| Token storage                    | `refresh_token` is long-lived and sensitive — store encrypted at rest (`pgcrypto` or KMS)       |
| Rate-limit per IP                | Prevents brute-force `state` guessing against the cache                                          |
| Signed bootstrap URL             | Short TTL (≤ 2 min) and single-use; check + reject reuse on the bootstrap endpoint              |
| Tokens never reach the browser   | Access + refresh tokens stay server-side; only your session JWT goes to the client              |

## Production checklist

- [ ] **PKCE enabled** — `code_challenge_method: 'S256'`, never `'plain'`
- [ ] **State validated atomically** — `get` then `delete`; no race window
- [ ] **State TTL** ≤ 15 minutes
- [ ] **Redirect URI exact-match** on the provider side (no wildcards)
- [ ] **Token exchange uses POST** with `Content-Type: application/x-www-form-urlencoded`
- [ ] **`client_secret` server-side only** — never in the browser
- [ ] **id_token verified** — JWKS-backed verify against the IDP's keys
- [ ] **`refresh_token` encrypted at rest** in the database
- [ ] **Bootstrap JWT** with very short TTL (≤ 2 min) and single-use semantics
- [ ] **Rate-limit `/auth/start` and `/auth/callback`** per IP
- [ ] **Detect and reject reused authorisation codes** — the provider should also do this; defense in depth
- [ ] **Detect impossible-time-window flows** (state created seconds ago coming back from a different IP)

## See also

- [`titan-auth`](../modules/auth.mdx) — JWT + signed URLs
- [`titan-cache`](../modules/cache.mdx) — state storage
- [`titan-ratelimit`](../modules/ratelimit.mdx) — protect both endpoints
- [API service stack](./api-service.md) — what runs after the user is authenticated
