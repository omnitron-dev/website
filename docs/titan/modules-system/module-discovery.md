---
sidebar_position: 3
title: Module Discovery
description: How modules are found, loaded, and ordered.
---

# Module Discovery

Module discovery is **explicit**. Titan does not scan the filesystem
for modules at boot. Every module the application loads is reachable
from the root module's `imports` graph.

## The discovery walk

When `Application.create(RootModule)` runs:

1. The root module is added to the registry.
2. Each `import` of the root module is walked.
3. For each imported module, its `import`s are walked.
4. Discovery continues breadth-first until no new modules appear.
5. Each unique module is registered exactly once.

The result is a topologically sorted module list. Providers are
registered with the container in this order so dependencies precede
dependents.

## Why this is explicit

The alternative — automatic filesystem scanning — has three serious
problems:

- **Surprise.** Adding a file in the wrong directory loads code
  silently. Renaming a file changes the runtime in ways `git diff`
  does not show.
- **Test fragility.** Tests that load a partial module set diverge
  from production at boot.
- **Slow startup.** Filesystem walks scale poorly; explicit imports
  are O(actually-loaded-modules), not O(repo-size).

The explicit graph is a few extra lines of `imports: [...]` in
exchange for a runtime that is exactly what your code says.

## The registered set

After discovery, the registry holds:

| Property                              | Type                  |
| ------------------------------------- | --------------------- |
| Module class reference                | `Function`            |
| Module name (defaults to class name)  | `string`              |
| Module version (optional)             | `string`              |
| Static or dynamic flag                | `boolean`             |
| Resolved imports (after dedup)        | `IModule[]`           |
| Resolved providers                    | `Provider[]`          |
| Resolved exports                      | `Token[]`             |

Inspect via the `module:registered` event or programmatically through
`app.modules`.

## Detecting cycles

The discovery walk detects cycles between modules. A cycle throws a
`CircularDependencyError` at boot with the full cycle path:

```
CircularDependencyError: cycle in module imports
  AuthModule → SessionModule → UsersModule → AuthModule
```

The fix is structural — extract the shared piece into a third module,
or invert one of the dependencies (often via a callback or interface).
See [Circular Dependencies](../di/circular-dependencies.md).

## Lazy loading

Some applications want to load modules on demand (admin features that
ship in production but should not run on every boot, optional
integrations enabled by feature flag).

Titan does not have built-in lazy module loading at runtime. The
preferred patterns are:

- **Conditional imports.** Build the root module's `imports` array
  conditionally at boot:

  ```typescript
  const imports = [CoreModule, UsersModule];
  if (env.ENABLE_BILLING) imports.push(BillingModule);

  @Module({ imports })
  export class AppModule {}
  ```

- **Conditional providers.** Inside a module, register providers
  only if a config flag is set, using the `ConditionalProvider`
  type from Nexus:

  ```typescript
  @Module({
    providers: [
      {
        provide:     BillingService,
        useClass:    BillingService,
        when:        (ctx) => ctx.config.get('billing.enabled'),
        useFallback: NoopBillingService,
      },
    ],
  })
  export class BillingModule {}
  ```

These are decided at `Application.create` time. Truly dynamic
load/unload at runtime is a multi-app concern; use the Omnitron
orchestrator for that.

→ Next: [Dependency Injection](../di/overview.md).
