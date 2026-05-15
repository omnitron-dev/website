---
title: titan-auth
---

# titan-auth

JWT authentication and claims-based authorisation as Netron middleware.

## Install

```bash
pnpm add @omnitron-dev/titan-auth
```

## Setup

```typescript
import { AuthModule } from '@omnitron-dev/titan-auth';

@Module({
  imports: [
    AuthModule.forRoot({
      jwt: {
        secret:    env.JWT_SECRET,
        algorithm: 'HS256',
        issuer:    'my-app',
      },
    }),
  ],
})
export class AppModule {}
```

The module registers an auth middleware on Netron. Every call carries an
`Authorization: Bearer <token>` header (HTTP/WS) or an inline token field
(TCP/Unix). Decoded claims attach to the `NetronContext`.

## Decorators

```typescript
@Service('orders@1.0.0')
export class OrdersService {
  // Method-level: requires a valid token, no scope check.
  @Public()
  @RequireAuth()
  async list(@Context() ctx: NetronContext) {
    return this.repo.listForUser(ctx.auth.userId);
  }

  // Method-level: requires a specific scope claim.
  @Public()
  @RequireAuth({ scope: 'orders:write' })
  async cancel(orderId: string) { /* … */ }

  // Method-level: anonymous; no auth check.
  @Public()
  async healthCheck() { return 'ok'; }
}
```

## Custom claim verification

Inject `AuthService` to verify claims manually inside a method:

```typescript
@Service('reports@1.0.0')
export class ReportsService {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RequireAuth()
  async export(@Context() ctx: NetronContext, format: 'pdf' | 'csv') {
    if (format === 'pdf' && !this.auth.hasScope(ctx, 'reports:premium')) {
      throw new ForbiddenError('PDF export requires premium scope');
    }
    // …
  }
}
```

## Token issuing

`AuthService.sign()` issues tokens for tests or first-party flows:

```typescript
const token = await this.auth.sign({ userId, scopes: ['orders:read'] });
```

For production identity providers, use a separate IDP and feed the
public key (or JWKS URL) into `AuthModule.forRoot({ jwt: { jwksUri } })`.
