---
title: titan-auth
---

# titan-auth

JWT authentication with multi-algorithm support (HS256 / RS256 /
ES256), remote JWKS, in-memory token cache, and HTTP middleware.

```bash
pnpm add @omnitron-dev/titan-auth
```

## Setup

```typescript
import { TitanAuthModule } from '@omnitron-dev/titan-auth';

@Module({
  imports: [
    TitanAuthModule.forRoot({
      algorithm:    'HS256',
      jwtSecret:    env.JWT_SECRET,
      issuer:       'my-app',
      audience:     'my-api',
      cacheEnabled: true,
      cacheMaxSize: 1_000,
      cacheTTL:     300_000,
    }),
  ],
})
class AppModule {}
```

For asymmetric signing or external identity providers:

```typescript
TitanAuthModule.forRoot({
  algorithm: 'RS256',
  jwksUrl:   'https://auth.example.com/.well-known/jwks.json',
  issuer:    'https://auth.example.com',
  audience:  'my-api',
})
```

### `IAuthModuleOptions`

| Option         | Type                                     | Default      |
| -------------- | ---------------------------------------- | ------------ |
| `algorithm`    | `'HS256' \| 'RS256' \| 'ES256'`          | `'HS256'`    |
| `jwtSecret`    | `string`                                 | —            |
| `serviceKey`   | `string`                                 | —            |
| `anonKey`      | `string`                                 | —            |
| `jwksUrl`      | `string`                                 | —            |
| `issuer`       | `string`                                 | —            |
| `audience`     | `string`                                 | —            |
| `cacheEnabled` | `boolean`                                | `true`       |
| `cacheMaxSize` | `number`                                 | `1_000`      |
| `cacheTTL`     | `number` (ms)                            | `300_000`    |
| `defaultTenantId` | `string`                              | —            |
| `isGlobal`     | `boolean`                                | —            |

## Exposed services and tokens

| Symbol                      | Notes                                       |
| --------------------------- | ------------------------------------------- |
| `JWTService`                | Sign / verify tokens                        |
| `AuthMiddleware`            | HTTP middleware to validate the Authorization header |
| `JWT_SERVICE_TOKEN`         | DI token for `JWTService`                   |
| `AUTH_MIDDLEWARE_TOKEN`     | DI token for `AuthMiddleware`               |
| `SIGNED_URL_SERVICE_TOKEN`  | DI token for signed-URL helper              |
| `AUTH_OPTIONS_TOKEN`        | DI token for the resolved options bundle    |

## `@RequireAuth` decorator

Protect a method:

```typescript
import { RequireAuth } from '@omnitron-dev/titan-auth';

@Service({ name: 'orders' })
class OrdersService {
  @Public()
  @RequireAuth({ roles: ['admin'], permissions: ['orders:write'] })
  async cancel(orderId: string) { /* … */ }
}
```

Options:

```typescript
@RequireAuth({
  roles?:       string[],
  permissions?: string[],
  policies?:    string[] | { all?: string[] } | { any?: string[] },
})
```

The policy framework comes from the Netron auth layer
(`@omnitron-dev/titan/netron/auth` — `BuiltInPolicies`,
`PolicyEngine`, etc.). See
[Netron Authentication](../netron/authentication.md) for the
underlying primitives.

## JWT issuing

`JWTService.sign(payload, options?)` returns a signed token.
`JWTService.verify(token, options?)` validates and returns the
decoded claims (cached if `cacheEnabled`).

```typescript
constructor(@Inject(JWT_SERVICE_TOKEN) private readonly jwt: JWTService) {}

const token = await this.jwt.sign({ userId, roles: ['user'] }, { expiresIn: '15m' });
const claims = await this.jwt.verify(token);
```
