---
sidebar_position: 2
title: Application & DI
---

# Application & DI

Titan's container is the only thing that owns service instances. Everything
else — RPC transports, lifecycle hooks, validation, logging — is wired
through it.

## Providers

A provider is a class the container can instantiate. The container caches
one instance per scope (default: singleton).

```typescript
@Injectable()
export class UsersRepository {
  constructor(private readonly db: Database) {}
}
```

`@Injectable()` is implied for `@Service` classes; you only need it for
non-service helpers.

## Modules

A module declares which providers belong to it, which other modules it
depends on, and which providers it exposes.

```typescript
@Module({
  imports:   [DatabaseModule, LoggerModule],
  providers: [UsersService, UsersRepository],
  exports:   [UsersService],          // Visible to importers of UsersModule
})
export class UsersModule {}
```

A provider declared in `providers` but not in `exports` is private —
visible inside the module, invisible outside it.

## Configuration

`ConfigModule.forRoot({...})` reads from files, environment variables,
and inline overrides, validated against a schema.

```typescript
import { z } from 'zod';
import { ConfigModule } from '@omnitron-dev/titan';

const Schema = z.object({
  port: z.number().int().positive(),
  database: z.object({
    url: z.string().url(),
  }),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      schema: Schema,
      sources: [
        { type: 'file', path: 'config/default.yaml' },
        { type: 'file', path: 'config/${NODE_ENV}.yaml', optional: true },
        { type: 'env', prefix: 'APP_' },
      ],
    }),
  ],
})
export class AppModule {}
```

Inject the typed config anywhere:

```typescript
@Service('users@1.0.0')
export class UsersService {
  constructor(@InjectConfig() private readonly config: z.infer<typeof Schema>) {}
}
```

## Lifecycle

The container fires four hooks in dependency order:

| Hook         | Fires when                              |
| ------------ | --------------------------------------- |
| `onInit`     | All providers instantiated, before start |
| `onStart`    | After `app.start()` is called            |
| `onStop`     | When `app.stop()` is called              |
| `onShutdown` | After all transports closed              |

```typescript
@Service('users@1.0.0')
export class UsersService implements OnInit, OnStop {
  async onInit() { /* warm caches */ }
  async onStop() { /* flush queues */ }
}
```

A failure in `onInit` aborts startup with a typed error; the framework
will not partial-start with broken dependencies.

## Validation

Decorate parameters with `@Validate(Schema)` to validate them at the
service boundary. Validation runs *before* the method body, with the
parsed value substituted in.

```typescript
const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(120),
});

@Service('users@1.0.0')
export class UsersService {
  @Public()
  async create(@Validate(CreateUserSchema) input: z.infer<typeof CreateUserSchema>) {
    // input is parsed and trusted here
  }
}
```

A validation failure becomes a `ValidationError` over the wire — the
client receives a typed error with the schema's messages, not a 500.

## Errors

Throw a `NetronError` subclass for client-visible failures:

```typescript
throw new NotFoundError('user', { id });
throw new UnauthorizedError('session expired');
throw new ConflictError('email taken', { email });
```

The client receives the same error class with the same payload. Generic
`Error` instances are wrapped as `InternalError` and logged on the
server with the original stack.

## Reading more

- [Netron RPC](./netron.md) — exposing services over the wire.
- [Modules](./modules/index.md) — the bundled ecosystem modules.
