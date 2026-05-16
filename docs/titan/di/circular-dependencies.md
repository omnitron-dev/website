---
sidebar_position: 8
title: Circular Dependencies
description: Detect, diagnose, and break cycles in the DI graph.
---

# Circular Dependencies

A circular dependency is a cycle in the constructor graph: A's
constructor needs B, B's constructor needs A. The container cannot
construct either without the other being already constructed. Nexus
detects this at registration time and throws.

## What you see

```
CircularDependencyError: cycle in container graph
  UsersService → SessionService → AuthService → UsersService
```

The error names every node in the cycle. The cycle is closed —
follow the arrows and you return to the start.

This error fires at `Application.create` time, before any provider is
instantiated. The application will not start with an unresolved cycle.

## Why cycles are bad

Beyond the obvious "the container cannot do its job":

- **Construction order is undefined.** If both A and B can be
  constructed, in some order, that order leaks into the runtime
  semantics. Tests pass under one order, fail under another.
- **Refactoring is fragile.** A method moves from A to B and the
  cycle suddenly closes. The build breaks and nobody knows why.
- **Architectural smell.** Two modules that mutually depend usually
  have a shared concept they both need to know about. Extracting it
  is almost always the right move.

## Three ways to break a cycle

### 1. Extract the shared concept

Most cycles hide a third concept that should be its own module.
Identify it, extract it, and have both original modules depend on
the new one.

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

### 2. Invert the dependency with an interface

If A and B genuinely need to call each other, push one direction
through an interface so the dependency goes one way:

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

`B` depends on `A`; `A` depends on no one. The wiring happens via a
registration call rather than a constructor injection.

### 3. Lazy resolution

Sometimes A really does need B at *use time* but not at *construction
time*. Inject a *getter* instead of the value:

```typescript
import { Inject } from '@omnitron-dev/titan';

class UsersService {
  constructor(
    @Inject(() => AuthService) private getAuth: () => AuthService,
  ) {}

  whoAmI(token: string) {
    return this.getAuth().validateToken(token);   // resolved here, not at construction
  }
}
```

The container provides the getter; calling it resolves on demand. The
cycle is broken because `UsersService`'s constructor no longer needs
`AuthService` to be constructed first.

Use this sparingly. It works but hides the wiring; future readers will
struggle to trace the dependency graph.

## Cycles between modules vs cycles between providers

Module-level cycles (`A` imports `B` imports `A`) and provider-level
cycles (constructor of `A` needs `B`, constructor of `B` needs `A`)
are different errors with similar symptoms.

| Error                        | Where                          | Detection                              |
| ---------------------------- | ------------------------------ | -------------------------------------- |
| Module import cycle          | `@Module({ imports: [...] })`  | Module discovery (boot time)           |
| Provider constructor cycle   | Constructor signatures         | Container graph analysis (boot time)   |

Both throw at boot. Both name the cycle. Both have the same three
fixes (extract, invert, lazy).

## Avoiding cycles in design

Two heuristics that prevent most cycles before they appear:

### Layer your modules

Conceptually, sort modules into layers: core (no domain deps),
domain (depends on core), feature (depends on domain). A cycle
implies a layer violation.

```
          ┌─ feature: BillingModule
          ├─ feature: UsersModule
          ├─ feature: OrdersModule
          │
          ├─ domain:  AuthModule
          │
          └─ core:    LoggerModule, ConfigModule, DatabaseModule
```

Lower layers can be imported by higher layers, never the reverse. If
you find a higher layer importing a lower one *and* the lower
importing the higher, you have a cycle.

### Domain types in their own module

If both `UsersModule` and `OrdersModule` need a `User` type, put the
type in a `UsersTypesModule` (or a shared `domain/users.types` file
that exports types but no providers). Both modules import the types
without depending on the implementation.

This breaks cycles before they form because types — unlike
implementations — never need to call back.

## Diagnosing a cycle in a large graph

When the cycle path is long, the error message can be hard to read.
Use the DevTools (see [DevTools](./devtools.md)) to render the full
container graph and visually locate the cycle:

```typescript
import { ContainerDevtools } from '@omnitron-dev/titan/nexus/devtools';

const devtools = new ContainerDevtools(container);
console.log(devtools.renderGraph({ format: 'mermaid' }));
```

Output is a Mermaid diagram you can paste into the docs or a
visualization tool.

→ Next: [DevTools](./devtools.md).
