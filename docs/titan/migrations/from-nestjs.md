---
sidebar_position: 2
title: From NestJS
description: Concept-by-concept mapping from NestJS to Titan.
---

# From NestJS

NestJS and Titan share a decorator-driven, container-centric
philosophy — most concepts map directly. The genuine deltas are
where Titan made different decisions; this page calls them out
explicitly so you don't fight the framework.

## At a glance

| NestJS                              | Titan                                              | Note                                 |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------ |
| `@Module()`                         | `@Module()`                                        | Same shape                           |
| `@Injectable()`                     | `@Injectable()`                                    | Same                                 |
| `@Controller()`                     | `@Service({ name, version })`                      | RPC contract, not HTTP route         |
| `@Get()` / `@Post()` etc.           | `@Public()`                                        | Transport-agnostic exposure          |
| `@Inject(TOKEN)`                    | `@Inject(TOKEN)`                                   | Same                                 |
| `@Optional()`                       | `@Optional()`                                      | Same                                 |
| `@Global()`                         | `@Global()` + `global: true` on DynamicModule      | Both available                       |
| `OnModuleInit`                      | `OnInit`                                           | Slightly different name              |
| `OnModuleDestroy`                   | `OnDestroy`                                        | Slightly different name              |
| `OnApplicationBootstrap`            | `OnStart`                                          | Slightly different name              |
| `OnApplicationShutdown`             | `OnStop`                                           | Plus `OnDestroy` for finalisation    |
| `ModuleRef.get()`                   | `app.resolve(Token)` or `container.resolve(Token)` | Same idea                            |
| `DynamicModule`                     | `DynamicModule`                                    | Same shape                           |
| `forRoot / forRootAsync`            | `forRoot / forRootAsync`                           | Same patterns                        |
| `HttpException` / `RpcException`    | `TitanError` and subclasses                        | Different hierarchy                  |
| `ConfigModule` (`@nestjs/config`)   | `ConfigModule` (built-in)                          | Similar, multi-source merge          |
| `Logger`                            | `LoggerService` (built-in pino-based)              | 4 levels                             |
| `ScheduleModule` (`@nestjs/schedule`) | `SchedulerModule` (`titan-scheduler`)            | Same `@Cron` / `@Interval` pattern   |
| `CacheModule` (`@nestjs/cache-manager`) | `TitanCacheModule` (`titan-cache`)              | Native multi-tier (L1/L2)            |
| `ThrottlerModule` (`@nestjs/throttler`) | `TitanRateLimitModule` (`titan-ratelimit`)      | Three algorithms                     |
| `BullModule` / `BullMQModule`       | `SchedulerModule` (cron) + `NotificationsModule` (rotif) | Different decomposition       |
| Guards (`@UseGuards`)               | `@Auth(...)` or middleware via Netron              | Auth-specific surface                |
| Interceptors                        | RPC middleware (per-call) + DI middleware (per-resolution) | Two distinct layers          |
| Pipes (`@UsePipes`)                 | `@Validate(schema)` / `@Contract(...)`             | Zod schemas, not class-validator     |
| Filters (`@UseFilters`)             | Error class hierarchy + middleware                 | Errors are values, not events        |

## The biggest delta — controllers vs services

The largest mental shift: NestJS controllers are HTTP-aware (`@Get`,
`@Post`, `@Param`, `@Body`). Titan's `@Service` is **transport-
agnostic**. The same service class is reachable over HTTP, WebSocket,
TCP, and Unix — the framework dispatches to the same method body
regardless.

```typescript
// NestJS
@Controller('users')
class UsersController {
  @Get(':id')
  async findById(@Param('id') id: string) { return this.repo.find(id); }

  @Post()
  async create(@Body() input: CreateUserDto) { return this.repo.create(input); }
}

// Titan
@Service('users@1.0.0')
class UsersService {
  @Public()
  async findById(id: string) { return this.repo.find(id); }

  @Public()
  @Validate(CreateUserSchema)
  async create(input: CreateUser) { return this.repo.create(input); }
}
```

URLs and parameter mapping are no longer part of the contract.
Clients call `users.findById('u_42')` directly — the wire format
is the framework's concern.

→ See [Netron / Services](../netron/services.md) for the full
contract semantics.

## Lifecycle hooks

| NestJS interface             | Titan interface         | Fires when                              |
| ---------------------------- | ----------------------- | --------------------------------------- |
| `OnModuleInit`               | `OnInit`                | After construction, before start        |
| `OnApplicationBootstrap`     | `OnStart`               | Once all `onInit` complete              |
| `OnApplicationShutdown(sig)` | `OnStop`                | On `app.stop()` (in reverse dep order)  |
| `OnModuleDestroy`            | `OnDestroy`             | Final cleanup phase                     |

Map your existing hooks accordingly. The `signal` argument on
`OnApplicationShutdown` becomes the `reason` on Titan's shutdown
events — query `app.getShutdownReason()` if you need it.

→ [Application / Lifecycle](../application/lifecycle.md)

## Validation — class-validator → Zod

NestJS commonly uses `class-validator` + `class-transformer`:

```typescript
// NestJS — DTO with decorators
class CreateUserDto {
  @IsEmail()      email: string;
  @MinLength(1)   @MaxLength(120) name: string;
}

@Post()
async create(@Body() input: CreateUserDto) { /* … */ }
```

Titan uses Zod (re-exported from `@omnitron-dev/titan/validation`):

```typescript
// Titan — schema-first
const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(120),
});

@Public()
@Validate(CreateUserSchema)
async create(input: z.infer<typeof CreateUserSchema>) { /* … */ }
```

The schema **is** the type. No separate DTO class; no decorator
soup; the `z.infer` gives you exact compile-time types.

→ [Validation / Contracts](../validation/contracts.md)

## Errors — exception filters → typed errors

NestJS catches via filters:

```typescript
// NestJS
@Catch(NotFoundException)
class NotFoundFilter implements ExceptionFilter { /* … */ }

throw new NotFoundException('user not found');
```

Titan: errors are values; the framework serialises them across the
wire with their class intact.

```typescript
// Titan
import { Errors, ErrorCode, TitanError } from '@omnitron-dev/titan/errors';

throw Errors.notFound('user', id);

// On the client:
try { await users.findById('missing'); }
catch (e) {
  if (e instanceof TitanError && e.code === ErrorCode.NOT_FOUND) { /* handle */ }
}
```

No filter classes needed. The error class is the wire contract.

→ [Errors](../errors/overview.md)

## DI scopes

| NestJS scope       | Titan equivalent (Nexus) |
| ------------------ | ------------------------ |
| `Scope.DEFAULT`    | `Scope.Singleton`        |
| `Scope.REQUEST`    | `Scope.Request`          |
| `Scope.TRANSIENT`  | `Scope.Transient`        |
| (no analogue)      | `Scope.Scoped`           |

Plus Titan's [contextual injection](../di/contextual-injection.md) —
one token, multiple providers, chosen per request context. This is
the closest Titan has to NestJS's request-scoped providers but
covers more (per-tenant, per-feature-flag, per-environment).

## Guards / middleware

NestJS:

```typescript
@UseGuards(JwtAuthGuard)
@Get(':id')
async findById(@Param('id') id: string) { /* … */ }
```

Titan:

```typescript
@Public()
@Auth({ roles: ['user'] })
async findById(id: string) { /* … */ }
```

Or use Netron RPC middleware globally:

```typescript
netron.use(AuthMiddleware);
netron.use(RateLimitMiddleware);
```

→ [Netron / Middleware](../netron/middleware.md) and
[Netron / Authentication](../netron/authentication.md)

## Module helpers

NestJS has helpers like `Test.createTestingModule()` for tests.
Titan exposes the same shape via `Application.create({ overrides: [...] })`:

```typescript
// NestJS
const module = await Test.createTestingModule({
  providers: [UsersService],
}).overrideProvider(Database).useClass(FakeDatabase).compile();

// Titan
const app = await Application.create({
  modules:    [UsersModule],
  overrides:  [{ provide: Database, useClass: FakeDatabase }],
  disableGracefulShutdown: true,
});
```

→ [Testing / DI Overrides](../testing/di-overrides.md)

## Migration order — recommended

1. **Bootstrap.** Move the entry-point into `Application.create`;
   bridge legacy providers via `providers: [[TOKEN, { useValue: ... }]]`.
2. **One module.** Pick a low-stakes feature module; convert
   controller → `@Service`, DTOs → Zod, guards → `@Auth`.
3. **Lifecycle.** Rename `OnModuleInit` → `OnInit`, etc.
4. **Errors.** Replace `HttpException` instances with the `Errors`
   namespace.
5. **Config / logging.** Drop `@nestjs/config` and `Logger` —
   built-in equivalents are auto-loaded.
6. **Repeat module-by-module.** Strangler-fig — no big bang.

## What you gain

- **Transport-agnostic RPC.** Same service over HTTP / WS / TCP /
  Unix without duplicating handlers.
- **Native time-series metrics.** No prom-client; built-in storage
  backends.
- **End-to-end typed errors.** Errors travel as classes, not
  status codes.
- **Smaller dependency footprint.** Ecosystem modules are
  individually versioned; you install what you use.

## What's different (not better-or-worse, just different)

- **Validation is Zod, not class-validator.** If your codebase
  is heavily class-decorated DTOs, the rewrite is real work.
- **No `@Get('/path')` semantics.** RPC-first means thinking in
  service methods, not URL routes.
- **`OnApplicationShutdown(signal)` → `OnStop` + reason from
  `app.getShutdownReason()`** — slightly different API.

## See also

- [Concepts / Design Principles](../concepts/design-principles.md)
- [Recipes / API service stack](../recipes/api-service.md) — the
  Titan equivalent of the canonical NestJS REST API
