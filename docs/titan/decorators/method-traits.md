---
sidebar_position: 3
title: Method Traits
description: Composing decorators on a single method — order, semantics, common stacks.
---

# Method Traits

A "method trait" is a cross-cutting concern applied via decorator.
Most methods have one trait or none; some methods stack several.

## Two ways to express the same thing

`@Public(options)` accepts the same configuration that `@Auth`,
`@RateLimit`, `@Cache`, and `@Audit` set individually. The two styles
are equivalent.

### Inline (single decorator):

```typescript
@Public({
  auth:      { roles: ['admin'] },
  rateLimit: { limit: 10, window: 60_000 },
  cache:     { ttl: 30_000 },
})
async dangerousOp(input: Input) { /* … */ }
```

### Composed (stacked decorators):

```typescript
@Public()
@Auth({ roles: ['admin'] })
@RateLimit({ limit: 10, window: 60_000 })
@Cache({ ttl: 30_000 })
async dangerousOp(input: Input) { /* … */ }
```

Pick a style per project. Inline is terser; composed reads top-down
and groups easily.

## The order rule (when composing)

Decorators evaluate **outside-in** at declaration; they execute
**inside-out** at call time.

```typescript
@Public()                                              //  ← outer, processes last
@Auth({ roles: ['admin'] })                            //
@RateLimit({ limit: 10, window: 60_000 })              //
@Validate(InputSchema)                                 //  ← inner, processes first
async dangerousOp(input: Input) { /* … */ }
```

`@Validate` runs first, then `@RateLimit`, then `@Auth`, then `@Public`
finalises the dispatch. The runtime order is critical for stacks like
"validate before rate-limit" so malformed requests don't consume rate
budget.

## Common stacks

### Public read endpoint

```typescript
@Public({
  cache:     { ttl: 30_000 },
  rateLimit: { limit: 100, window: 60_000 },
})
@Validate(IdSchema)
async findById(id: string) { /* … */ }
```

- Cache outermost — cache hits skip everything else.
- Rate-limit before validation.

### Authenticated write endpoint

```typescript
@Public({
  auth:      { scopes: ['orders:write'] },
  rateLimit: { limit: 10, window: 60_000 },
})
@Validate(CreateOrderSchema)
async create(input: z.infer<typeof CreateOrderSchema>) { /* … */ }
```

- Rate limit applies to *all* callers (authenticated or not).
- Auth enforces a scope.

### Admin-only endpoint

```typescript
@Public({ auth: { roles: ['admin'] } })
@Validate(InputSchema)
async resetDatabase(input: Input) { /* … */ }
```

No rate limit — admin operations are deliberate and infrequent.
No cache — admin operations should always run.

### Internal method (not RPC)

```typescript
// No @Public — not exposed.
@Retry({ attempts: 3, delay: 100 })
async fetchFromUpstream(id: string) { /* … */ }
```

Internal methods use `@Retry`, `@Memoize`, `@Timeout` (from
`/decorators/utility.ts`), etc. — but not `@Public`, `@Auth`, or
`@RateLimit`, which only make sense at the network edge.

## Combining lifecycle decorators

`@PostConstruct` and `@PreDestroy` mark methods for lifecycle phases.
They do **not** stack with method traits — the marked method is
executed during the lifecycle, not as a wrapper for a regular call.

```typescript
// Wrong — @Memoize on a lifecycle hook.
@PostConstruct()
@Memoize()
async warm() { /* … */ }
```

If you need memoisation in lifecycle work, extract the memoised
helper:

```typescript
@PostConstruct()
async warm() {
  this.dictionary = await this.loadDictionary();
}

@Memoize()
private async loadDictionary() { /* … */ }
```

## Custom traits via `createDecorator`

If you need a trait the built-ins don't cover, write your own:

```typescript
import { createMethodInterceptor } from '@omnitron-dev/titan/decorators';

const AuditLog = createMethodInterceptor<{ resource: string }>(
  'AuditLog',
  async (originalMethod, args, context) => {
    const result = await originalMethod(...args);
    auditLog.append({
      resource: context.options?.resource,
      method:   context.propertyKey,
      args,
      at: Date.now(),
    });
    return result;
  },
);
```

Use:

```typescript
@Public()
@AuditLog({ resource: 'orders' })
async create(input: Input) { /* … */ }
```

Custom interceptors stack inside-out with the built-ins.

## Class-level vs method-level

Many traits also support class-level application — they apply to
every `@Public` method on the class:

```typescript
@Service('orders@1.0.0')
@Auth({ scopes: ['orders:*'] })                          // class-level
@RateLimit({ limit: 100, window: 60_000 })               // class-level
class OrdersService {
  @Public() async list() { /* inherits class-level traits */ }

  @Public()
  @Auth({ scopes: ['orders:write'] })                    // overrides class-level
  async create(input: CreateInput) { /* … */ }
}
```

Method-level decorators **override** class-level ones for that
method.

## Anti-patterns

- **Cache outside an auth-gated method.** Cache hits skip the auth
  check — anyone who can warm the cache can read its contents. Put
  `@Auth` outside `@Cache`, or cache per-user with a `keyGenerator`
  that includes the user identity.
- **Rate limit inside auth.** Unauthenticated abusers hit your auth
  backend at full rate. Rate-limit *before* auth (or apply
  rate-limit class-level so it covers all methods).
- **Validate after rate limit on cheap endpoints.** Malformed
  requests should be rejected before consuming rate budget —
  `@Validate` belongs inside (executed first).
- **Stacking similar decorators.** `@Cache` and `@Memoize` together
  cache the same call twice. Pick one — `@Cache` for shared,
  `@Memoize` for per-instance.

→ Back to [Decorators](./index.md).
