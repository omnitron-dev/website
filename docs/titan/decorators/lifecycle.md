---
sidebar_position: 2
title: Lifecycle Decorators
description: PostConstruct, PreDestroy — and when to prefer interfaces.
---

# Lifecycle Decorators

Lifecycle work can be declared two ways: implementing the
`OnInit` / `OnStart` / `OnStop` / `OnDestroy` interfaces, or
decorating methods with `@PostConstruct` / `@PreDestroy`.

The framework treats them identically. Choose by intent.

## `@PostConstruct()`

Runs after the container constructs the instance, in the dependency-
ordered `onInit` phase. Equivalent to implementing
`OnInit.onInit()`.

```typescript
import { Service, PostConstruct } from '@omnitron-dev/titan';

@Service('users@1.0.0')
class UsersService {
  @PostConstruct()
  async warm() {
    await this.cache.warm();
  }
}
```

Multiple `@PostConstruct` methods on one class run in declaration
order.

## `@PreDestroy()`

Runs during shutdown, in the `onDestroy` phase. Equivalent to
implementing `OnDestroy.onDestroy()`.

```typescript
import { Service, PreDestroy } from '@omnitron-dev/titan';

@Service('users@1.0.0')
class UsersService {
  @PreDestroy()
  async drain() {
    await this.queue.drain();
  }
}
```

Multiple `@PreDestroy` methods run in reverse declaration order
(LIFO).

## When to prefer the interface form

The interface form (`implements OnInit`) is recommended for:

- **Single-purpose lifecycle work** — one method per phase, with a
  signature the type system enforces.
- **Public API** — the class declares lifecycle participation in
  its type signature, making it explicit to readers.
- **Tooling support** — IDEs and the framework can detect the
  interface and offer better autocomplete / quick fixes.

```typescript
import { Service, type OnInit, type OnDestroy } from '@omnitron-dev/titan';

@Service('users@1.0.0')
class UsersService implements OnInit, OnDestroy {
  async onInit()    { await this.cache.warm(); }
  async onDestroy() { await this.queue.drain(); }
}
```

## When to prefer decorators

The decorator form is useful when:

- **Multiple lifecycle methods of the same kind** — you want two
  things to happen at `onInit`, separated for readability:

  ```typescript
  @PostConstruct()
  async warmCache() { await this.cache.warm(); }

  @PostConstruct()
  async loadDictionary() { await this.dict.load(); }
  ```

- **Mixin patterns** — a base class wants lifecycle behaviour
  without forcing subclasses to implement an interface.

## Mapping to lifecycle phases

| Decorator         | Equivalent interface | Phase       |
| ----------------- | -------------------- | ----------- |
| `@PostConstruct`  | `OnInit.onInit()`    | `onInit`    |
| —                 | `OnStart.onStart()`  | `onStart`   |
| —                 | `OnStop.onStop()`    | `onStop`    |
| `@PreDestroy`     | `OnDestroy.onDestroy()` | `onDestroy` |

There is no decorator equivalent for `onStart` / `onStop` because
the distinction between `onInit`/`onStart` and `onStop`/`onDestroy`
is semantically important — the framework wants you to choose by
phase, and the interface forces the choice.

For `onStart` / `onStop` work, implement the interface.

## Anti-patterns

- **Mixing decorators and interfaces on the same class.** The
  framework runs both, but readers will be confused. Pick one
  style per class.
- **Lifecycle decorators on private methods.** They work — but the
  intent is unclear. Lifecycle work is part of the class's public
  contract, even if the method is private.
- **Lifecycle work in regular methods.** Calling `await
  this.warmCache()` from a constructor or from a deferred
  `setImmediate` bypasses the framework's ordering guarantees. Use
  the proper hook.

→ Next: [Method Traits](./method-traits.md).
