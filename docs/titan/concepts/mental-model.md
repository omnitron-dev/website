---
sidebar_position: 3
title: Mental Model
description: How to think about a running Titan app.
---

# Mental Model

A picture of a running Titan app, from three viewpoints:

## Viewpoint 1 — From outside the process

A Titan service, viewed from the network, is **a set of named methods
behind a versioned identifier**. The identifier is `name@semver`, the
methods are whatever is marked `@Public`, and the wire format is
Netron — choose your transport.

```
http://localhost:3000  → service "users@1.0.0":
                          findById(id: string): Promise<User|null>
                          create(input: CreateInput): Promise<User>
                          remove(id: string): Promise<void>
```

A client does not care which DI container instantiated the service,
which module declared it, or which lifecycle phase is running. It cares
about the wire contract. **The wire contract is the TypeScript
interface.**

## Viewpoint 2 — From inside a service method

Inside a method body, your service is an ordinary TypeScript class:

```typescript
@Service('orders@1.0.0')
export class OrdersService {
  constructor(
    private readonly db:    Database,    // injected
    private readonly cache: CacheService, // injected
    private readonly logger: Logger,     // injected
  ) {}

  @Public()
  async findById(@Validate(IdSchema) id: string): Promise<Order> {
    this.logger.debug('findById', { id });
    return this.cache.getOrSet(`order:${id}`, () => this.db.findOrder(id));
  }
}
```

What is *not* visible from the method body — but is real:

- The container instantiated this object exactly once (default scope:
  Singleton) and reuses it for every call.
- `this.logger` is bound to the service name, so every log line
  carries `service: 'orders'` automatically.
- The `id` parameter has been validated against `IdSchema` *before*
  the method body runs.
- A trace context is attached to the current async scope; calls from
  this method to other services propagate it.
- If this method throws a typed `NetronError`, the client receives the
  same class. If it throws an `Error`, the client receives
  `InternalError` and the original is logged with the stack.

You write the method as if these were not there. The framework wires
them in.

## Viewpoint 3 — From the lifecycle's perspective

The lifecycle state machine sees the application as **a topologically
ordered set of providers**:

```
Container has these providers:
  ConfigService     (no deps)
  LoggerService     (depends on: ConfigService)
  Database          (depends on: ConfigService, LoggerService)
  CacheService      (depends on: ConfigService)
  OrdersService     (depends on: Database, CacheService, LoggerService)
  PaymentsService   (depends on: Database, OrdersService, LoggerService)

Topological order for onInit:
  ConfigService → LoggerService → Database → CacheService → OrdersService → PaymentsService

Topological order for onStop (reverse):
  PaymentsService → OrdersService → CacheService → Database → LoggerService → ConfigService
```

The framework guarantees:

- A provider's `onInit` is called only after every dependency's
  `onInit` has resolved.
- A provider's `onStop` is called before any dependency's `onStop`.
- A failure during `onInit` aborts the entire startup; partially-
  initialised providers have their `onStop` called in cleanup.
- A failure during `onStop` does not abort shutdown; the failure is
  logged, and the next provider's `onStop` runs.

This is the same guarantee modern DI frameworks (Spring, Guice, Dagger)
provide. The implementation is in
`@omnitron-dev/titan/application/_internal/lifecycle-state.ts`.

## Three things to internalise

### 1. The container is the world

When you wonder "where does X come from?", the answer is "the
container resolved it from a provider declared in some module." Always.
There are no globals. There are no singletons stored on `Object` or
imported from a `state.ts` file. If you find yourself reaching for
module-level state, you are stepping outside Titan's model.

### 2. Methods are just methods

A `@Public` method is no different from a private method except that
Netron can dispatch to it. You can call `this.findById(...)` from
inside the same class; it is a normal method call. You can call
`other.findById(...)` from another service in the same process; it is
a normal method call. Only when the call crosses the wire does Netron
get involved — and Netron's involvement is invisible to the method
body.

This is why testing Titan services is easy: instantiate the class with
mock dependencies, call the methods directly. No "test client" needed
unless you are testing the wire layer itself.

### 3. The framework gets out of the way

Once an `Application` has started, the framework does almost nothing
during a request. Netron decodes a packet, looks up a service in a
map, validates parameters, calls the method, encodes the result. The
container is not consulted on every call (services are singletons by
default; their instances are already in memory). The lifecycle is not
consulted (it has finished `onStart` and is waiting for `onStop`).

You are running a TypeScript method on a Node.js process. The
framework is the surrounding scaffolding, not a per-call interpreter.

## What this means for performance

The hot path of a Titan service is:

1. Transport receives bytes.
2. msgpack deserialises into a request.
3. Service descriptor lookup (one Map lookup).
4. Parameter validation (pre-compiled Zod validator).
5. Method invocation.
6. Result serialisation.
7. Transport sends bytes.

Steps 3–6 are framework code. They are O(1) per call. The DI container
is not on the hot path. The lifecycle is not on the hot path. The
event bus is not on the hot path.

When you tune Titan for throughput, you are tuning your method body,
your validation schemas, and your transport configuration. The
framework itself is approximately invisible at runtime.

→ Next: [Application Bootstrap](../application/bootstrap.md) — how
the kernel actually starts.
