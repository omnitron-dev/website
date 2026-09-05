---
sidebar_position: 3
title: Configuration Validation
description: Schema-checked config — crash at boot, not at 3 AM.
---

# Configuration Validation

A typed schema for your config is the cheapest reliability win you
can take. Misconfiguration becomes a startup failure instead of a
runtime crash hours later.

## Defining a schema

```typescript
import { z } from '@omnitron-dev/titan/validation';

export const AppConfigSchema = z.object({
  port:        z.number().int().min(1).max(65535),
  environment: z.enum(['development', 'staging', 'production']),
  database: z.object({
    url:  z.string().url(),
    pool: z.object({
      min: z.number().int().nonnegative().default(2),
      max: z.number().int().positive().default(20),
    }),
  }),
  cache: z.object({
    tier:  z.enum(['memory', 'redis']).default('memory'),
    ttlMs: z.number().int().positive().default(60_000),
  }).default({}),
  features: z.object({
    enableBilling: z.boolean().default(false),
  }).default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
```

Wire it in. **`validateOnStartup` is required** — it has no default, so
a schema on its own is parsed by nothing and an invalid config loads in
silence:

```typescript
ConfigModule.forRoot({
  schema: AppConfigSchema,
  validateOnStartup: true,
  sources: [...],
})
```

## What happens at boot

1. Sources load and merge into a candidate config object.
2. The candidate is parsed against the schema.
3. On success: the typed result is frozen and exposed via
   `ConfigService`.
4. On failure: `ConfigService.initialize()` throws
   `Errors.badRequest('Configuration validation failed', { errors })`,
   which surfaces as a `TitanError` with code `BAD_REQUEST`. There is
   no `ConfigValidationError` class.

Every invalid field is carried in `details.errors`, one entry per Zod
issue:

```typescript
try {
  await app.start();
} catch (err) {
  if (err instanceof TitanError && err.code === ErrorCode.BAD_REQUEST) {
    // [{ path, message, expected, received }, …]
    console.error(err.details.errors);
  }
}
```

```
[
  { path: 'port',          message: 'Expected number, received string', expected: 'number', received: 'string' },
  { path: 'database.url',  message: 'Required',                          expected: 'string', received: 'undefined' },
  { path: 'cache.tier',    message: "Invalid enum value. Expected 'memory' | 'redis', received 'redos'" }
]
```

`path` is the Zod issue path joined with `.`, so a nested field reads
`database.url`. Use this to fail fast in CI: a config that doesn't
validate locally won't validate in production either.

This runs only when both `validateOnStartup` and `schema` are set, as
above.

## Defaults

Schema-level defaults (`z.number().default(60_000)`) apply when no
source supplies the value. This is the right place for "sensible
default for development":

```typescript
cache: z.object({
  ttlMs: z.number().int().positive().default(60_000),
})
```

Don't put production defaults here — they should come from
`production.yaml` so they're explicit.

## Coercion

`@omnitron-dev/titan/validation` exposes Zod with coercion enabled
for env-var sources. A `z.number()` field can read its value from
the string `"3000"` and coerce. Same for booleans, dates.

For stricter parsing (the source must provide the right type), use
`z.number().strict()` etc.

## Per-section validation

You can validate just a slice of the config without loading the
whole schema:

```typescript
const cacheConfig = this.config.getTyped<CacheConfig>(CacheConfigSchema, 'cache');
//      ^? CacheConfig (z.infer<typeof CacheConfigSchema>)
```

`getTyped<T>(schema, path?)` parses the value at `path` (or the whole
config when `path` is omitted) and throws if it doesn't match.

Useful in dynamic modules whose options are a subtree of the global
config.

## Branded types for safety

For values that should never accidentally interconvert (e.g. URLs vs
plain strings), use Zod's `.brand`:

```typescript
const DatabaseUrl = z.string().url().brand<'DatabaseUrl'>();
type DatabaseUrl = z.infer<typeof DatabaseUrl>;

const Schema = z.object({
  database: z.object({ url: DatabaseUrl }),
});
```

`DatabaseUrl` and `string` are now distinct types; you cannot pass a
plain string where a `DatabaseUrl` is expected. Catches "I forgot to
read the right config key" bugs at the type level.

## Anti-patterns

- **`z.unknown()` everywhere.** Defeats the point. Use specific
  types; if a value can be one of several shapes, use a union.
- **Validating in code instead of the schema.** A runtime check
  in `onInit` is fine for state-derived invariants (the database
  schema matches my code), but not for config shape — that's
  what the schema is for.
- **Optional vs default for production values.** Use defaults for
  development conveniences. Production values should be required
  so a missing one fails the boot.

→ Next: [Hot Reload](./hot-reload.md).
