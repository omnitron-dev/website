---
sidebar_position: 1
title: Services
description: "@Service, @Public, service descriptors, and peers."
---

# Services

A Netron service is a TypeScript class that the framework binds to a
named, versioned identifier on the wire.

## `@Service('name@version')`

```typescript
@Service('users@1.0.0')
class UsersService {
  // …
}
```

The identifier is `name@semver`. Together they form the service's
*public identity* — what clients pass to `queryInterface`.

The version is part of the identity, not an implementation detail.
`users@1.0.0` and `users@2.0.0` are **distinct services** that can
coexist on the same app, expose different method signatures, and be
called by clients pinning to one or the other.

```typescript
@Service('users@1.0.0')
class UsersServiceV1 { /* legacy */ }

@Service('users@2.0.0')
class UsersServiceV2 { /* new */ }

// Both classes registered; both reachable.
@Module({ providers: [UsersServiceV1, UsersServiceV2] })
class AppModule {}
```

This is the canonical way to do API versioning. Clients pin to the
version they were written for; servers can run multiple versions
side-by-side until clients migrate.

## `@Public()` — opt-in exposure

Methods are private to the process by default. `@Public()` marks one
as RPC-callable.

```typescript
@Service('users@1.0.0')
class UsersService {
  @Public()
  async findById(id: string): Promise<User | null> { /* exposed */ }

  @Public()
  async create(input: CreateInput): Promise<User> { /* exposed */ }

  private async hash(password: string) { /* internal — not callable */ }
}
```

This is a *deliberate* friction point. Many frameworks expose every
public method automatically; Netron does not. The reason: methods
that look fine inside the process can be dangerous when exposed
(internal-only operations, helper methods that bypass validation,
deprecated routes). `@Public()` requires an explicit decision per
method.

## Service descriptors

When you register a `@Service` class, Netron extracts a *descriptor* —
a typed metadata record:

```typescript
{
  name:    'users',
  version: '1.0.0',
  methods: {
    findById: {
      name:       'findById',
      paramSchemas: [/* … */],
      returnSchema: /* … */,
      contract:   /* if @Contract was applied */,
      // …
    },
    create: { /* … */ },
  },
}
```

The descriptor is what `queryInterface<T>()` resolves against. Clients
download the descriptor (or have it as part of a shared package); the
methods they call are typed against it.

Inspect a registered descriptor:

```typescript
const peer = app.getLocalPeer();
const descriptor = peer.getServiceDescriptor('users@1.0.0');
console.log(descriptor.methods);
```

The Omnitron console exposes the same descriptors via the operator
service.

## Peers

Netron's runtime model has two peer types:

- **`LocalPeer`** — represents the current process. Owns the set of
  registered services. One per `Application`.
- **`RemotePeer`** — a proxy to another process. Calls on the proxy
  marshal as RPC packets.

The application's `LocalPeer` is accessible via
`app.getLocalPeer()`. You rarely interact with it directly — the
framework wires services on its behalf.

`RemotePeer` is the client-side view. `NetronClient` constructs one
under the hood; you get the proxy via `queryInterface`.

## Local vs remote calls — the same code

A service in the same process is callable as a normal method —
no RPC involved:

```typescript
@Service('orders@1.0.0')
class OrdersService {
  constructor(private readonly users: UsersService) {}

  @Public()
  async create(userId: string, items: Item[]) {
    const user = await this.users.findById(userId);   // direct method call
    if (!user) throw Errors.notFound('user', { id: userId });
    // …
  }
}
```

The framework detects that `users` is a local provider and routes
calls directly. No serialisation, no transport, no middleware. The
same code from outside the process goes through the wire.

This means **you write services the same way regardless of where they
are called from**. The wire-vs-local optimisation is invisible.

## Multiple services per class? No.

One class = one service = one identifier. If a class has methods that
belong to different services, split it into two classes.

This is intentional. Lumping unrelated methods into one service makes
the wire contract less coherent and complicates versioning.

## Service-level decorators

In addition to method-level decorators, you can apply some traits at
the **class** level — they then cover every `@Public` method on the
class:

```typescript
@Service('orders@1.0.0')
@Auth({ scope: 'orders:*' })                          // class-level auth
@RateLimit({ capacity: 100, refillPerSec: 10 })       // class-level rate limit
class OrdersService {
  @Public() async list() { /* … */ }
  @Public() async get(id: string) { /* … */ }
  @Public()
  @Auth({ scope: 'orders:write' })                    // override for this method
  async create(input: CreateInput) { /* … */ }
}
```

Method-level decorators **override or extend** class-level ones, not
remove them. To opt out, the method must explicitly declare `@NoAuth()`
or equivalent.

## Anti-patterns

- **Mutable service state.** Singleton services are shared across
  calls. State stored in `this` is shared state, with all the
  concurrency hazards that implies. Keep service instance state to
  references (database, cache, configuration); per-call state belongs
  in method-local variables or a `Request`-scoped context.
- **Decorating private methods with `@Public`.** Private methods are
  not meant to be called from outside. If you need a public method,
  rename it and make it part of the contract.
- **Mixing service identities in one class.** "UsersService" and
  "AdminService" should be two classes, even if they share helpers.
  The wire contract is per-class.
- **Skipping the version.** `@Service('users')` — defaults to
  `1.0.0`, which is fine for v1 but invisible at the call site.
  Always write the explicit version.

→ Next: [Transports](./transports.md).
