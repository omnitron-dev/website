---
sidebar_position: 4
title: Child Loggers
description: Bind context to a logger instance — service, request, trace.
---

# Child Loggers

A child logger is a logger with extra context bound to it. Every log
line written through the child carries the bound fields automatically.

This is the right way to add per-call or per-request fields without
repeating them at every call site.

## Creating a child

```typescript
const child = this.logger.child({ requestId: 'r_42', userId: 'u_91' });

child.info('processing');
// → {"level":"info","requestId":"r_42","userId":"u_91","msg":"processing", …}

child.error('oops', { reason: 'db timeout' });
// → {"level":"error","requestId":"r_42","userId":"u_91","reason":"db timeout","msg":"oops", …}
```

The child carries the bound fields forever. Pass it down to
helpers, into other services, into queue handlers — every log line
through it has the same context.

## Per-service binding (automatic)

Every `LoggerService` injected into a `@Service` class is
automatically a child bound to `service: <ClassName>`:

```typescript
@Service('users@1.0.0')
class UsersService {
  constructor(private readonly logger: LoggerService) {}
  // logger.info('hello') → {"service":"UsersService","msg":"hello"}
}
```

You don't need to set this; the framework wires it.

## Per-call binding via context

For Netron calls, a request-scoped logger is available in the
`NetronContext`. It is already bound to:

| Field           | From                                    |
| --------------- | --------------------------------------- |
| `service`       | The service identifier                  |
| `method`        | The method being called                 |
| `traceId`       | The trace context                       |
| `spanId`        | The trace context                       |
| `requestId`     | Generated per call                      |
| `userId`        | The auth context (if authenticated)     |

Use it via `@Context()`:

```typescript
@Public()
async findById(id: string, @Context() ctx: NetronContext) {
  ctx.logger.debug('looking up user', { id });
  return this.repo.findById(id);
}
```

Every log line from this method carries the request context — no
manual passing.

## Across async boundaries

Child loggers cross async boundaries by *passing the reference*. They
do not propagate via `AsyncLocalStorage` automatically (unlike trace
context). If you spawn a background task, pass the logger:

```typescript
@Public()
async findById(id: string, @Context() ctx: NetronContext) {
  const logger = ctx.logger;        // capture
  void this.warmCache(id, logger);  // pass into the task
  return this.repo.findById(id);
}

private async warmCache(id: string, logger: LoggerService) {
  logger.debug('warming cache', { id });
  // …
}
```

For propagation through deep call chains where passing is awkward,
use the trace integration — log lines automatically carry `traceId`
and `spanId` from the active trace context.

## Don't pass the parent logger

A common mistake:

```typescript
// Wrong — uses the unbound parent.
@Public()
async findById(id: string) {
  this.logger.info('looking up', { id });   // no requestId, no traceId
}
```

Inject `@Context()` and use `ctx.logger` instead. The parent
`this.logger` has no per-call context.

## Performance

Creating a child is cheap (it's a shallow clone of the parent's
bound fields). Logging through a child is the same cost as logging
through the parent.

A common pattern in tight loops:

```typescript
// Bind once outside the loop.
const itemLogger = ctx.logger.child({ batch: 'b_42' });

for (const item of items) {
  itemLogger.debug('processing item', { id: item.id });
}
```

The child is created once; each log is normal cost.

## Anti-patterns

- **Recreating the same child per call.** If you find yourself
  writing `this.logger.child({ service: 'X' })` everywhere, that's
  what `@Context()` already gives you.
- **Mutating bound fields after binding.** Child loggers' fields
  are frozen at creation. To change context, create a new child.
- **Logging via `console.log`.** Bypasses the framework — no
  context, no level, no transport routing. Always use the
  injected logger.

→ Back to [Logging Overview](./overview.md).
