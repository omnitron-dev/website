---
sidebar_position: 5
title: Multi-injection
description: One token, many providers — the canonical pattern for plugins, validators, middleware chains.
---

# Multi-injection

Multi-injection is one token with many providers. Resolving the token
returns an array of all of them. It is the foundation for every plugin
or registry pattern in Titan.

## The basic pattern

```typescript
import { createToken } from '@omnitron-dev/titan/nexus';

interface IValidator {
  name: string;
  validate(input: unknown): boolean;
}

const VALIDATORS = createToken<IValidator[]>('Validators');

@Injectable()
class EmailValidator implements IValidator {
  name = 'email';
  validate(input: unknown) { return typeof input === 'string' && input.includes('@'); }
}

@Injectable()
class PasswordValidator implements IValidator {
  name = 'password';
  validate(input: unknown) { return typeof input === 'string' && input.length >= 8; }
}

@Module({
  providers: [
    EmailValidator,
    PasswordValidator,
    { provide: VALIDATORS, useExisting: EmailValidator,    multi: true },
    { provide: VALIDATORS, useExisting: PasswordValidator, multi: true },
  ],
  exports: [VALIDATORS],
})
class ValidationModule {}
```

A consumer injects the array:

```typescript
@Service('signup@1.0.0')
class SignupService {
  constructor(@Inject(VALIDATORS) private readonly validators: IValidator[]) {}

  @Public()
  async signup(input: unknown) {
    for (const v of this.validators) {
      if (!v.validate(input)) throw Errors.validation(`${v.name} failed`);
    }
    // …
  }
}
```

The array contains every provider registered against `VALIDATORS`,
in the order they were registered. New validators in new modules
slot in without changing the consumer.

## Why this matters

The alternative — a registry the consumer maintains — couples consumer
and contributor. Adding a new validator means editing the consumer.
With multi-injection, the consumer depends on a token; contributors
depend on the token. The two never meet.

This is the core of every extensibility seam in Titan:

- **Health indicators** — modules contribute, the aggregator
  consumes.
- **DI middleware** — modules contribute, the container consumes.
- **Netron RPC middleware** — modules contribute, Netron consumes.
- **Lifecycle phase tasks** — modules contribute, the coordinator
  consumes.
- **Custom event handlers** — modules contribute, the bus consumes.

All of them use multi-injection underneath.

## Cross-module multi-tokens

Multi-tokens compose across modules. If module A registers two
providers and module B registers one, a consumer that imports both
gets all three:

```typescript
@Module({
  providers: [
    { provide: VALIDATORS, useExisting: EmailValidator,    multi: true },
    { provide: VALIDATORS, useExisting: PasswordValidator, multi: true },
  ],
  exports: [VALIDATORS],
})
class CoreValidatorsModule {}

@Module({
  providers: [
    { provide: VALIDATORS, useExisting: PhoneNumberValidator, multi: true },
  ],
  exports: [VALIDATORS],
})
class ExtraValidatorsModule {}

@Module({
  imports: [CoreValidatorsModule, ExtraValidatorsModule],
  providers: [SignupService],
})
class AppModule {}

// SignupService gets [EmailValidator, PasswordValidator, PhoneNumberValidator]
```

The accumulation is the runtime composition of `imports`. Drop
`ExtraValidatorsModule` from the root, and `SignupService` sees only
the core validators — no other code change required.

## Order

Providers register in the order their modules are discovered, which
follows the `imports` graph. Within a module, registration follows
the order in `providers`. The result is deterministic but tied to
import order, so if order matters (middleware chains, for example),
make it explicit:

```typescript
interface IMiddleware {
  priority: number;        // explicit ordering
  handle(ctx: any, next: () => any): any;
}

@Service('orders@1.0.0')
class OrdersService {
  constructor(@Inject(MIDDLEWARE) private readonly middleware: IMiddleware[]) {
    this.middleware.sort((a, b) => a.priority - b.priority);
  }
}
```

## Optional empty arrays

If no provider is registered, resolving a multi-token returns an empty
array — not `undefined`, not throws. This means consumers can write
code that handles the no-contributor case naturally:

```typescript
const validators = container.resolve(VALIDATORS);   // [] if nothing registered
for (const v of validators) v.validate(input);       // loop is a no-op
```

## Mixing multi and single

A token is either multi or single. You cannot register one provider
without `multi: true` and another with `multi: true` against the same
token — the framework will throw at registration time.

If you need the "first one wins" pattern, use a regular single token
plus `useExisting` to alias to the chosen impl. If you need the "all
of them" pattern, use multi.

## A real example — health indicators

The `titan-health` ecosystem module uses multi-injection so any
module can contribute an indicator without changing the consumer:

```typescript
import { Injectable } from '@omnitron-dev/titan';
import { createToken } from '@omnitron-dev/titan/nexus';

const HEALTH_INDICATOR = createToken<IHealthIndicator[]>('HealthIndicator');

@Injectable()
class StripeHealth implements IHealthIndicator {
  async check() { /* … */ }
}

@Module({
  providers: [
    StripeHealth,
    { provide: HEALTH_INDICATOR, useExisting: StripeHealth, multi: true },
  ],
  exports: [HEALTH_INDICATOR],
})
class PaymentsModule {}
```

Adding `PaymentsModule` to the root module adds the indicator to
the health aggregator. Removing the module removes the indicator.
No other code changes.

The exact token name and shape are owned by `titan-health`; the
pattern shown above is the general multi-injection recipe.

## Anti-patterns

- **Forgetting `multi: true`.** Without it, the second registration
  overwrites the first. Symptom: only one provider shows up in the
  array.
- **Mutating the resolved array.** The container does not defensively
  copy. Mutating the array mutates the cached resolution. Treat
  resolved arrays as read-only.
- **Order-dependent behaviour without explicit ordering.** If your
  consumer assumes a specific order, encode that order in the
  providers themselves (`priority` field, sort step) — do not rely
  on import-order coincidence.

→ Next: [Contextual Injection](./contextual-injection.md).
