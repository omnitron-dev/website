---
sidebar_position: 6
title: Contextual Injection
description: Resolve different providers based on runtime context — current user, environment, feature flags.
---

# Contextual Injection

Contextual injection lets a single token resolve to **different
providers** depending on runtime context. Same dependency, different
implementation, chosen per call or per scope.

It is the Nexus answer to multi-tenancy, A/B testing, role-based
behaviour, and per-environment overrides.

## When you need it

Three scenarios that all reduce to "this dependency depends on who is
asking":

1. **Multi-tenancy.** Tenant A uses a different storage backend than
   tenant B. The service code is identical; the storage provider is
   not.
2. **Feature flags.** New users get the new payment processor; old
   users get the legacy one. Both code paths exist.
3. **Per-role behaviour.** Admins see audit-aware queries; regular
   users see plain ones. The repository class is different.

Without contextual injection, you would write `if (tenant === 'X') {
useA() } else { useB() }` in every consumer. Contextual injection
moves the decision to the container.

## The strategy interface

A *strategy* answers "given this context, which provider should I
return?":

```typescript
import { type ContextStrategy } from '@omnitron-dev/titan/nexus';

const TenantStrategy: ContextStrategy<IStorage> = {
  selectProvider(ctx) {
    const tenant = ctx.get('tenantId');
    return tenant === 'enterprise' ? S3Storage : LocalStorage;
  },
};
```

Three built-in strategies cover most cases:

- **`RoleBasedStrategy`** — selects based on the current user's role.
- **`EnvironmentStrategy`** — selects based on `NODE_ENV` or a
  config value.
- **`FeatureFlagStrategy`** — selects based on a flag query.

Custom strategies implement the same interface.

## Registering a contextual provider

```typescript
import { createToken, ContextManager } from '@omnitron-dev/titan/nexus';

const STORAGE = createToken<IStorage>('Storage');

container.register(STORAGE, {
  contextual: {
    strategy: TenantStrategy,
    providers: {
      enterprise: { useClass: S3Storage    },
      default:    { useClass: LocalStorage },
    },
  },
  scope: Scope.Request,
});
```

When a consumer resolves `STORAGE`, the strategy runs against the
current `ContextManager` and the matching provider is constructed.

## Setting context

The `ContextManager` is request-scoped. Middleware sets values on it;
strategies read them.

```typescript
import { ContextManager } from '@omnitron-dev/titan/nexus';

@Injectable()
class TenantMiddleware implements INetronMiddleware {
  constructor(private readonly context: ContextManager) {}

  async handle(ctx, next) {
    const tenantId = ctx.headers.get('x-tenant-id');
    this.context.set('tenantId', tenantId);
    return next();
  }
}
```

Inside the request, services that depend on `STORAGE` get the right
instance for the tenant.

## Composition with scopes

Contextual providers usually live in `Request` scope — the context
varies per request, so the resolution should too. A `Singleton`
contextual provider would resolve once and cache the result, defeating
the purpose.

| Scope         | Behaviour with contextual                                     |
| ------------- | ------------------------------------------------------------- |
| `Singleton`   | Strategy runs once on first resolve; result cached forever    |
| `Request`     | Strategy runs once per request; result cached for the request |
| `Transient`   | Strategy runs every resolve                                   |

`Request` is almost always the right answer.

## Per-environment overrides

A common pattern — different implementations per `NODE_ENV`:

```typescript
container.register(EMAIL_SENDER, {
  contextual: {
    strategy: EnvironmentStrategy.fromConfig('NODE_ENV'),
    providers: {
      production:  { useClass: SendgridSender },
      staging:     { useClass: MailtrapSender },
      development: { useClass: ConsoleSender  },
      test:        { useClass: NoopSender     },
    },
  },
});
```

This is more explicit than `if (env === 'production') { … }` scattered
in code, and it gives you one place to grep when you need to see
"what runs where".

## Strategy + multi-injection

Contextual and multi can compose. A multi-token can resolve to a
context-dependent **subset** of providers:

```typescript
container.register(VALIDATORS, {
  contextual: {
    strategy: RoleBasedStrategy,
    providers: {
      admin:   [{ useClass: AdminValidator }, { useClass: BaseValidator }],
      user:    [{ useClass: BaseValidator }],
    },
  },
  multi: true,
});
```

`admin` callers get both validators; `user` callers get one. The
consumer is unaware.

## Performance

Each contextual resolution costs:

- One context lookup (`ContextManager.get(key)`).
- One strategy call.
- One provider resolution (cached per scope).

The cost is proportional to the number of `Request`-scoped contextual
providers in the request, which is usually small.

## Anti-patterns

- **Contextual for static decisions.** If "which storage" is decided
  at boot, use a regular provider (or `EnvironmentStrategy` at
  registration time, not contextual). Contextual adds runtime cost.
- **Reading the context manually inside services.** Defeats the
  purpose. The point of contextual injection is to push the
  decision into the container so services stay context-agnostic.
- **Forgetting to set context.** A strategy that reads `tenantId`
  from a context that was never set returns the default. Make sure
  middleware that sets context runs before the consumer resolves.
- **Strategy with side effects.** Strategies are queried during
  resolution; they should be pure functions of the context.

→ Next: [DI Middleware](./middleware.md).
