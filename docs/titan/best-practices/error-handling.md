---
sidebar_position: 2
title: Error Handling
description: Throwing the right error, in the right place, for the right caller.
---

# Error Handling

Three rules and several patterns.

## Rule 1 — Throw typed errors at the boundary

Every `@Public` method should throw a `TitanError` (via the `Errors`
namespace or its subclasses) for client-visible failures. Native
`Error` becomes an `INTERNAL_ERROR` (status 500) — your client sees
an opaque server error.

```typescript
import { Errors } from '@omnitron-dev/titan/errors';

// Wrong
throw new Error('user not found');

// Right
throw Errors.notFound('user', id);
```

The framework preserves the code, status, and details across the
wire. Clients can `instanceof TitanError && e.code === ErrorCode.NOT_FOUND`
and act on the typed error.

## Rule 2 — Don't catch what you can't handle

```typescript
// Wrong — catches and silences.
try {
  return await this.upstream.fetch();
} catch (e) {
  this.logger.error({ err: e }, 'upstream failed');
  return null;
}
```

The caller now sees `null` for two different reasons (no data, or
a failure). The upstream failure becomes invisible.

Better:

```typescript
return await this.upstream.fetch();   // let the error propagate
```

Or, if you need a fallback:

```typescript
import { isOperationalError } from '@omnitron-dev/titan/utils';

try {
  return await this.upstream.fetch();
} catch (e) {
  if (isOperationalError(e)) {
    this.logger.warn({ err: e }, 'upstream unavailable, using cache');
    return await this.cache.get();
  }
  throw e;
}
```

Catch what you can handle. Re-throw what you can't.

## Rule 3 — Failure modes should be explicit

A method that can fail in different ways should signal them with
different `ErrorCode` values. Callers branch on the code, not on
parsing the message.

```typescript
import { Errors, DomainError, defineDomainCodes } from '@omnitron-dev/titan/errors';

const BillingCodes = defineDomainCodes('BILLING', {
  INSUFFICIENT_FUNDS: { status: 409, message: 'Insufficient funds' },
  ACCOUNT_FROZEN:     { status: 403, message: 'Account frozen'    },
});

@Public()
async transfer(from: string, to: string, amount: number) {
  const fromAcct = await this.repo.find(from);
  if (!fromAcct) throw Errors.notFound('account', from);

  const toAcct = await this.repo.find(to);
  if (!toAcct) throw Errors.notFound('account', to);

  if (fromAcct.balance < amount) {
    throw new DomainError({
      domainCode: BillingCodes.INSUFFICIENT_FUNDS,
      httpStatus: 409,
      message:    'Insufficient funds',
      details:    { available: fromAcct.balance, required: amount },
    });
  }

  if (fromAcct.frozen) {
    throw new DomainError({
      domainCode: BillingCodes.ACCOUNT_FROZEN,
      httpStatus: 403,
      message:    'Account frozen',
      details:    { accountId: from },
    });
  }

  return this.repo.transfer(from, to, amount);
}
```

The client checks the error code (or uses
`isDomainCode(e, BillingCodes, 'INSUFFICIENT_FUNDS')`) to
discriminate.

## Patterns

### Wrap third-party errors

External libraries throw their own error classes. Wrap them at the
boundary so the rest of your code (and your clients) sees Titan
errors:

```typescript
import { Errors } from '@omnitron-dev/titan/errors';

async findById(id: string) {
  try {
    return await this.db.users.findOne({ id });
  } catch (e) {
    if (e instanceof MongoNetworkError) {
      throw Errors.unavailable('database', String(e));
    }
    throw e;          // unknown — let the framework wrap as INTERNAL_ERROR
  }
}
```

### Use the cause field

Modern JavaScript errors support `cause`. `Errors.internal` takes the
original error as its second argument, so you can chain failures
without losing the underlying cause:

```typescript
try {
  await this.upstream.fetch();
} catch (e) {
  throw Errors.internal('upstream down', e as Error);
}
```

### Differentiate validation from business errors

```typescript
// Schema validation — input is malformed (422).
@Validate({ input: InputSchema })    // throws via the framework

// Business validation — input is well-formed but invalid in context (409).
if (input.endDate < input.startDate) {
  throw Errors.conflict('end before start', {
    startDate: input.startDate,
    endDate:   input.endDate,
  });
}
```

Both look like "user error" but mean different things.

### Centralise domain errors

Per-module error definitions reduce repetition:

```typescript
// users/errors.ts
import { Errors } from '@omnitron-dev/titan/errors';

export const usersErrors = {
  notFound:   (id: string)     => Errors.notFound('user', id),
  emailTaken: (email: string)  => Errors.alreadyExists('user', email),
  inactive:   (id: string)     => Errors.conflict('user not active', { id }),
};
```

Throw from anywhere:

```typescript
throw usersErrors.notFound(id);
```

## Logging errors

Log errors at the boundary where you decide what to do with them —
not at every level of the call stack.

```typescript
// Service — does not log; throws.
@Public()
async create(input: CreateInput) {
  if (await this.repo.findByEmail(input.email)) {
    throw Errors.alreadyExists('user', input.email);
  }
  return this.repo.create(input);
}

// Middleware / interceptor — logs the error and lets it propagate
// to the client.
class ErrorLoggingInterceptor {
  async handle(ctx, next) {
    try {
      return await next();
    } catch (e) {
      this.logger.error({
        service: ctx.service,
        method:  ctx.method,
        err:     e,
      }, 'rpc.error');
      throw e;
    }
  }
}
```

Log once per error. Multiple log lines per error muddy the
investigation.

## Anti-patterns (consolidated)

- **Generic `Error`.** No code, no status, no structure — becomes
  a 500. Always use the `Errors` namespace.
- **Catch-and-swallow.** Hides the failure and produces silent
  wrong-data bugs. Re-throw what you can't handle.
- **Catch-and-log-and-rethrow.** Doubles the log output and adds
  no value. Log at the outermost level, throw inside.
- **Polymorphic returns.** `Promise<User | Error>` makes callers
  type-check the result. Throw the error; let the framework
  signal failure.

→ Next: [Observability](./observability.md).
