---
sidebar_position: 3
title: From Express
description: Migrating a plain-Node Express service to Titan.
---

# From Express

Express services tend to share a recognisable shape: an app
object, a stack of middleware, a router file or two, ad-hoc
process-level config via `process.env`, and `console.log` for
observability. None of this is wrong — Titan just trades the
manual wiring for an opinionated container.

The point of this page is not to lecture you about why a
framework is better; it is to show you the **smallest concrete
mapping** between what you wrote in Express and what its
equivalent looks like in Titan, so you can decide whether the
trade is worth it.

## At a glance

| Express                              | Titan                                                |
| ------------------------------------ | ---------------------------------------------------- |
| `express()` app                      | `Application.create({ modules: [...] })`             |
| `app.use(mw)` middleware             | Netron RPC middleware via `netron.use(...)`          |
| `app.get('/path', handler)`          | `@Service` method with `@Public()`                   |
| `req.body` / `req.query` / `req.params` | Plain method arguments                            |
| `req.headers`                        | RPC context (auth, tracing) from `Netron.useContext` |
| `process.env`                        | `ConfigModule.forRoot({ schema, sources })`          |
| `console.log` / `winston` / `pino`   | Built-in `LoggerService` (pino under the hood)       |
| `helmet` / `cors` / `compression`    | Transport-level options or per-method middleware     |
| `joi` / `ajv` / `class-validator`    | Zod schemas + `@Validate(schema)`                    |
| `error-handler` middleware           | `TitanError` subclasses (auto-serialised)            |
| `node-cron`                          | `titan-scheduler` `@Cron(...)` decorator             |
| `prom-client`                        | `titan-metrics` counters / gauges / histograms       |
| `winston-loki` / file rotation       | Logger transports (configured declaratively)         |
| `bull` / `bullmq` queues             | `titan-notifications` (rotif) or `titan-scheduler`   |
| Manual `redis` connection            | `titan-redis` (clusters, sentinel, named instances)  |
| Manual graceful shutdown handlers    | Built-in lifecycle (`OnStop` / `OnDestroy`)          |

## A side-by-side concrete example

Suppose you have a small REST endpoint that creates a user.

```typescript
// Express — index.ts
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

const CreateUserSchema = z.object({ email: z.string().email() });

app.post('/users', async (req, res, next) => {
  try {
    const input = CreateUserSchema.parse(req.body);
    const user  = await repo.create(input);
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

app.listen(3000);
```

```typescript
// Titan — equivalent
import { Application, Module, Service, Public, Injectable, Inject }
  from '@omnitron-dev/titan';
import { Validate } from '@omnitron-dev/titan/validation';
import { z } from 'zod';

const CreateUserSchema = z.object({ email: z.string().email() });
type  CreateUser       = z.infer<typeof CreateUserSchema>;

@Injectable()
class UserRepo { /* ... */ }

@Service('users@1.0.0')
class UsersService {
  constructor(private readonly repo: UserRepo) {}

  @Public()
  @Validate(CreateUserSchema)
  async create(input: CreateUser) {
    return this.repo.create(input);
  }
}

@Module({ providers: [UserRepo, UsersService] })
class UsersModule {}

const app = await Application.create({ modules: [UsersModule] });
await app.start();
```

Things you stop writing yourself:

- **Body parsing.** The transport layer hands you typed arguments.
- **Per-handler try/catch.** Throw a typed error; the framework
  serialises it on the wire.
- **Status-code mapping.** `Errors.notFound(...)` / `Errors.validation(...)`
  carry their own HTTP-equivalent codes.
- **Listen / port management.** Configured declaratively on the
  Netron transport.

## Mapping middleware

### Authentication

```typescript
// Express
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).end();
  req.user = verifyJwt(token);
  next();
});
```

```typescript
// Titan — use titan-auth
@Module({
  imports: [TitanAuthModule.forRoot({ jwtSecret: env.JWT_SECRET })],
})
class AppModule {}

// In your service:
@Service('users@1.0.0')
class UsersService {
  @Public()
  @Auth({ roles: ['user'] })
  async me(@Context() ctx: AuthContext) { return ctx.user; }
}
```

### CORS / Helmet / Compression

These belong to the HTTP **transport**, not the service. Configure
on the Netron HTTP transport directly:

```typescript
import { HttpTransport } from '@omnitron-dev/titan/netron/transport-http';

netron.use('http', new HttpTransport({
  port: 3000,
  cors: { origin: 'https://example.com' },
  // compression, helmet-style headers, etc.
}));
```

### Logging requests

Express:

```typescript
app.use(morgan('combined'));
```

Titan: enable the built-in logger and request middleware:

```typescript
LoggerModule.forRoot({ level: 'info' });
netron.use(RequestLoggingMiddleware);
```

→ See [Netron / Middleware](../netron/middleware.md) for the
full middleware contract.

## Configuration

Replace ad-hoc `process.env` reads with a validated schema. You
get type-safety and a single source of truth.

```typescript
// Express — typical
const PORT      = parseInt(process.env.PORT ?? '3000', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
```

```typescript
// Titan
import { ConfigModule } from '@omnitron-dev/titan/module/config';
import { z } from 'zod';

const AppConfigSchema = z.object({
  port:     z.coerce.number().default(3000),
  redisUrl: z.string().url(),
});

ConfigModule.forRoot({
  schema:  AppConfigSchema,
  sources: [{ type: 'env', prefix: 'APP_' }],
});
```

→ [`ConfigModule`](../modules/config.mdx)

## Logging

Drop `console.log` and `winston`:

```typescript
// Express
console.log(`[${new Date().toISOString()}] user created`, { id });
```

```typescript
// Titan
@Injectable()
class UsersService {
  constructor(private readonly logger: LoggerService) {}
  async create(input) {
    const user = await this.repo.create(input);
    this.logger.info({ id: user.id }, 'user created');
    return user;
  }
}
```

→ [`LoggerModule`](../modules/logger.mdx)

## Graceful shutdown

Express requires manual `SIGTERM` / `SIGINT` handlers and
`server.close()` orchestration. Titan handles this automatically:

```typescript
// Express
const server = app.listen(3000);
process.on('SIGTERM', () => server.close(() => process.exit(0)));
```

```typescript
// Titan
@Injectable()
class FlushBuffersOnShutdown implements OnStop {
  async onStop() { await this.bufferedWriter.flush(); }
}
```

The `Application` registers signal handlers, fires
`OnStop` → `OnDestroy` in reverse dependency order, and exits
cleanly.

→ [Application / Shutdown](../application/shutdown.md)

## Background work (cron, queues)

| Express setup                            | Titan equivalent                           |
| ---------------------------------------- | ------------------------------------------ |
| `node-cron` + manual handler             | `titan-scheduler` `@Cron('0 * * * *')`     |
| `bullmq` queue + worker process          | `titan-notifications` rotif backbone       |
| Manual setInterval                       | `@Interval(60_000)`                        |
| `setTimeout` + bookkeeping               | `@Timeout(5_000)`                          |

→ [`SchedulerModule`](../modules/scheduler.mdx)
and [`NotificationsModule`](../modules/notifications.mdx).

## Migration order — recommended

1. **Bootstrap.** Wrap your `express()` app inside an Application
   shell that runs alongside it — gradually move endpoints over.
2. **Config + logger.** Replace `process.env` reads and
   `console.log` calls. Wins are immediate (type-safety + structured
   logs).
3. **One endpoint.** Pick a low-risk endpoint, convert it to a
   `@Service` with `@Public()`. Front it with a thin Express proxy
   if needed:
   ```typescript
   app.post('/users', async (req, res) => {
     try { res.json(await usersService.create(req.body)); }
     catch (e) { /* map TitanError → status */ }
   });
   ```
4. **Cross-cutting concerns.** Replace middleware (auth, rate-limit,
   metrics) with Titan modules one at a time.
5. **Background work.** Migrate cron / queues to the scheduler /
   notifications modules.
6. **Cut the cord.** Once endpoints are all converted, drop the
   Express proxy and use Netron HTTP transport directly.

## What you gain

- **Validation, errors, logging, metrics as first-class** — not
  bolted-on.
- **Transport flexibility.** Same service works over HTTP, WS,
  TCP, Unix without rewriting handlers.
- **Real DI.** Easier tests; cleaner separation of concerns;
  contextual overrides for multi-tenant scenarios.
- **Operability.** Built-in graceful shutdown, health probes,
  metrics endpoint, traceable IDs.

## What you give up

- **The "one file, one app" feeling.** Titan applications are
  structured. If your service is < 200 lines of Express, the
  ergonomic gain is modest.
- **Direct control over the request/response cycle.** You will
  rarely need it, but if you do (e.g., streaming a multipart
  upload byte-for-byte), you reach for transport-level escapes.
- **Decorator-heavy code style.** If your team is decorator-averse,
  Titan will feel heavy.

## See also

- [Recipes / Webhook receiver](../recipes/webhook-receiver.md) —
  closest direct analogue to a small Express service
- [Concepts / Mental Model](../concepts/mental-model.md)
- [`titan-metrics`](../modules/metrics.mdx) — replaces `prom-client`
  (see [next page](./from-prom-client.md))
