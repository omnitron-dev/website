---
sidebar_position: 8
title: Circular Dependencies
description: Detect, diagnose, and break cycles in the DI graph.
---

# Circular Dependencies

A circular dependency is a cycle in the constructor graph: A's
constructor needs B, B's constructor needs A. The container cannot
construct either without the other being already constructed. Nexus
detects this and throws `CircularDependencyError`.

```typescript
import { CircularDependencyError, forwardRef } from '@omnitron-dev/titan/nexus';
```

## What you see

```
CircularDependencyError: cycle in container graph
  UsersService → SessionService → AuthService → UsersService
```

The error names every node in the cycle, in order.

## Why cycles are bad

Beyond "the container cannot do its job":

- **Construction order is undefined.** If both A and B could be
  constructed in some order, that order leaks into runtime
  semantics. Tests pass under one order, fail under another.
- **Refactoring is fragile.** A method moves from A to B and the
  cycle suddenly closes. The build breaks and nobody knows why.
- **Architectural smell.** Two modules that mutually depend
  usually have a shared concept they both need to know about.
  Extracting it is almost always the right move.

## Three ways to break a cycle

### 1. Extract the shared concept

Most cycles hide a third concept that should be its own module.

```typescript
// Before — cycle:
//   UsersService → AuthService
//   AuthService  → UsersService

// After — extract:
class UsersDirectory { /* read-only user lookup */ }

class UsersService { constructor(private dir: UsersDirectory, private auth: AuthService) {} }
class AuthService  { constructor(private dir: UsersDirectory) {} }
// Now AuthService no longer depends on UsersService.
```

This is the cleanest fix. The third concept is usually a
"directory", "registry", "context", or "core" of the domain.

### 2. Invert the dependency

If A and B genuinely need each other at runtime, restructure so the
constructor dependency goes one way:

```typescript
// Before:
class A { constructor(private b: B) {} foo() { this.b.bar(); } }
class B { constructor(private a: A) {} bar() { this.a.foo(); } }

// After: B publishes a callback, A injects nothing from B.
interface BarHandler { bar(): void; }

class A {
  private barHandler?: BarHandler;
  registerBarHandler(h: BarHandler) { this.barHandler = h; }
  foo() { this.barHandler?.bar(); }
}

class B {
  constructor(private a: A) { a.registerBarHandler(this); }
  bar() { /* … */ }
}
```

### 3. Lazy resolution with `forwardRef`

`forwardRef` defers reference resolution until first use, breaking
the construction-time cycle:

```typescript
import { forwardRef, Inject } from '@omnitron-dev/titan/nexus';

class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService)) private auth: AuthService,
  ) {}
}
```

The container resolves `AuthService` when the field is first
*accessed*, not when `UsersService` is constructed. Use sparingly
— it hides the wiring; future readers will struggle to trace the
graph.

Lazy tokens (`createLazyToken`) serve the same purpose with a
different API.

## Cycles between modules vs cycles between providers

| Error                        | Where                          | Detection                              |
| ---------------------------- | ------------------------------ | -------------------------------------- |
| Module import cycle          | `@Module({ imports: [...] })`  | Module discovery (boot time)           |
| Provider constructor cycle   | Constructor signatures         | Container graph analysis               |

Both throw at boot. Both name the cycle. Both have the same three
fixes.

## Avoiding cycles in design

### Layer your modules

Sort modules into layers: core (no domain deps), domain (depends
on core), feature (depends on domain). A cycle implies a layer
violation.

```
┌─ feature: BillingModule, UsersModule, OrdersModule
├─ domain:  AuthModule
└─ core:    LoggerModule, ConfigModule, DatabaseModule
```

Lower layers can be imported by higher layers, never the reverse.

### Domain types in their own module

If both `UsersModule` and `OrdersModule` need a `User` type, put
the type in a `UsersTypesModule` (or a shared `domain/users.types`
file that exports types but no providers). Both modules import the
types without depending on the implementation.

## Diagnosing a cycle in a large graph

When the cycle path is long, use [DevTools](./devtools.md) to
render the full container graph and visually locate the cycle.

→ Next: [DevTools](./devtools.md).
