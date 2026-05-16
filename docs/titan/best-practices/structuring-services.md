---
sidebar_position: 1
title: Structuring Services
description: How to size, organise, and compose services as the codebase grows.
---

# Structuring Services

A service is the unit of behaviour. A module is the unit of
composition. Get the sizes right and the codebase scales; get them
wrong and it doesn't.

## Size a service by its bounded context

A service should map to one *bounded context* — one cohesive area of
business meaning. Not one database table, not one HTTP endpoint, not
one screen. A bounded context.

| Bad sizing                                  | Better                            |
| ------------------------------------------- | --------------------------------- |
| `UsersTableService` (one table)             | `UsersService` (the user concept) |
| `LoginEndpointService` (one route)          | `AuthService` (auth in general)   |
| `OrderListPageService` (one screen)         | `OrdersService` (orders in general) |

A service that is too small drowns the codebase in coordination
boilerplate. A service that is too large grows uncomfortable to test
and refactor.

Rule of thumb: 5–15 `@Public` methods is healthy. Past 20, start
splitting.

## Group services into modules by domain, not by layer

**Wrong** — by layer:

```
@Module({ providers: [UsersController, OrdersController, BillingController] })
class ControllersModule {}

@Module({ providers: [UsersRepository, OrdersRepository, BillingRepository] })
class RepositoriesModule {}
```

The "controllers module" has nothing in common — it bundles unrelated
features together because they share a layer name.

**Right** — by domain:

```
@Module({ providers: [UsersService, UsersRepository] })
class UsersModule {}

@Module({ providers: [OrdersService, OrdersRepository] })
class OrdersModule {}
```

Now `UsersModule` is self-contained. Refactoring it doesn't touch
unrelated code.

## Keep `@Public` methods small

A `@Public` method is a wire contract. It should:

- Take typed input (validated at the boundary).
- Delegate to private helpers for the work.
- Return a typed output.

Most logic should live in private methods or in injected helpers
(repositories, validators, calculators). The `@Public` method is a
shell.

```typescript
@Public()
@Validate(CreateOrderSchema)
async create(input: CreateOrder, @Context() ctx: NetronContext): Promise<Order> {
  await this.validateOwnership(ctx.auth!.userId, input.cartId);
  const order = await this.repo.create(input);
  await this.events.emit('order.created', { orderId: order.id });
  return order;
}

private async validateOwnership(userId: string, cartId: string) { /* … */ }
```

Reading the `@Public` method gives the reader the wire contract and
the high-level flow. Helpers fill in the details.

## Avoid service-to-service calls in the same process when you can

Two services in the same process can call each other directly via
DI. This is fine — but it can mask coupling. Two patterns to prefer:

- **Shared repository.** If both `UsersService` and `OrdersService`
  need to look up users, both inject `UsersRepository`. They don't
  need `UsersService` itself.
- **Domain events.** If `OrdersService` needs to react to a user
  change, subscribe to `user.updated` rather than calling
  `UsersService` directly.

These reduce direct service-to-service dependencies and make
splitting into separate processes (later) easier.

## Use module-private providers liberally

A provider in `providers` but not `exports` is invisible to other
modules. Use this for:

- Internal repositories (`UsersRepository`).
- Validators (`UsersValidator`).
- Mappers (`UsersDtoMapper`).
- Helpers that the public API uses but no one else needs.

Smaller export surfaces mean less coupling.

## Avoid the "service sub-classes service" pattern

```typescript
class BaseService { /* shared methods */ }

@Service('users@1.0.0')
class UsersService extends BaseService { /* … */ }

@Service('orders@1.0.0')
class OrdersService extends BaseService { /* … */ }
```

Two problems:

- **Hidden coupling.** A change in `BaseService` affects every
  subclass.
- **DI confusion.** What gets injected into `BaseService`? The
  same thing or different things per subclass?

Prefer composition: extract the shared logic into a helper service
and inject it.

```typescript
@Injectable()
class CommonHelper { /* shared methods */ }

@Service('users@1.0.0')
class UsersService {
  constructor(private readonly common: CommonHelper) {}
}
```

## Anti-patterns

- **God services.** One `AppService` with 30 methods spanning every
  domain. Always splittable.
- **Anemic services.** A service that is one method delegating to
  one repository call. Inline it; the service adds no value.
- **Direct database access in `@Public` methods.** Couples wire
  contract to schema. Use a repository (even a thin one).
- **State in singleton services.** Instance state is shared across
  every call. Either move to a `Request`-scoped service or store
  in the database.

→ Next: [Error Handling](./error-handling.md).
