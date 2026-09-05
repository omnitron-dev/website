---
sidebar_position: 4
title: Configuration Hot Reload
description: Change config without restarting — when, how, and the gotchas.
---

# Configuration Hot Reload

The `ConfigWatcherService` watches file sources for changes. On a
change it triggers `ConfigService.reload()`, which re-loads **all**
sources, optionally re-validates against the schema, and notifies
subscribers registered via `ConfigService.onChange()`.

The model is deliberately simple, and it pays to know its shape before
you build on it:

- Subscription is the `onChange(listener)` callback — there is **no**
  `config:changed` event on the application bus.
- The watcher uses Node's `fs.watch`; there are **no** polling or
  debounce options.
- A file change reloads and re-validates the **whole** config and
  fires **one** event — there is no per-leaf-key diffing.

The rest of this page walks through each of those in detail, with
source references into
[`packages/titan/src/modules/config/`](https://github.com/omnitron-dev/omni/tree/main/packages/titan/src/modules/config).

## When hot reload is the right tool

It saves a restart cycle. Useful for:

- **Feature flags.** Toggle a feature without redeploying.
- **Rate limit thresholds.** Tighten or loosen during an incident.
- **Log levels.** Bump to `debug` to investigate a live issue.
- **Cache TTLs.** Adjust without invalidating.

It is the **wrong** tool for:

- **Database connection strings.** A live connection pool can't be
  swapped without dropping in-flight calls.
- **Service identities.** Renaming `users@1.0.0` mid-flight breaks
  every connected client.
- **Schema changes.** The framework expects the schema to be
  stable between boot and shutdown.

For "wrong tool" cases, restart the process.

## Enabling

File watching is **opt-in**. Turn it on with `watchForChanges`:

```typescript
ConfigModule.forRoot({
  schema: AppConfigSchema,
  sources: [...],
  watchForChanges: true,
})
```

Omit it (or set it `false`) to disable watching. On `onInit`,
`ConfigService` only attaches the watcher when both `watchForChanges`
is truthy and a watcher service is present; the watcher's change
handler is what calls `reload()` (the watcher wiring in `ConfigService.initialize`, and
`ConfigService.handleConfigChange`). Only `file` sources are watched — `ConfigWatcherService`
filters the source list to `type === 'file'` and ignores the rest
(`ConfigWatcherService.watch`).

## Subscribing to changes

Register a listener with `ConfigService.onChange()`. It adds the
listener to an internal `Set` and returns an unsubscribe function that
removes it (`ConfigService.onChange`) — call it in `onDestroy` to
avoid leaks. There is **no** `config:changed` event on the application
bus; the callback is the only subscription path.

```typescript
@Service('cache@1.0.0')
class CacheService implements OnInit, OnDestroy {
  private unsubscribe?: () => void;

  constructor(private readonly config: ConfigService) {}

  async onInit() {
    this.applyTtl(this.config.get<number>('cache.ttlMs'));

    this.unsubscribe = this.config.onChange((event) => {
      // A file reload emits a single whole-config event
      // (event.path === ''); re-read the key you care about.
      this.applyTtl(this.config.get<number>('cache.ttlMs'));
    });
  }

  async onDestroy() {
    this.unsubscribe?.();
  }

  private applyTtl(ms: number) {
    this.cache.setDefaultTtl(ms);
  }
}
```

The listener receives an `IConfigChangeEvent`:

```typescript
interface IConfigChangeEvent {
  path:      string;   // dotted path; '' for a whole-config reload
  oldValue:  any;
  newValue:  any;
  source:    string;   // e.g. 'reload' or 'runtime'
  timestamp: Date;     // a Date, not epoch ms
}
```

## What gets emitted

A file change triggers a full `reload()`, which fires **one** event
with `path: ''`, `source: 'reload'`, and `oldValue` / `newValue`
holding the entire previous / new config object — it does **not**
diff and emit per leaf key (in `ConfigService.reload`). A
programmatic `config.set(path, value)` is the other emit path: it
fires a targeted event for that `path` with `source: 'runtime'`,
carrying the old and new value at that path (`ConfigService.set`).

So inside an `onChange` handler, branch on `event.source` (or on
`event.path === ''`) and re-read the specific keys you care about from
`ConfigService` rather than relying on a per-key payload from a file
reload.

## Validation on reload

`reload()` only re-validates when `validateOnStartup` is set and a
schema is present (`validateOnStartup` in `ConfigService`). In that case a reload
that fails validation is **rejected** — `reload()` restores the
previous config and throws, so the running app keeps its
last-known-good values (the validation branch of `ConfigService.reload`). The reload is
triggered from the watcher's change handler (`handleConfigChange`),
which `await`s `reload()` inside a `try/catch` and logs the failure
rather than propagating it (`ConfigService.handleConfigChange`).

This means a typo in a config file does not crash the running app.
You see the error in the logs, fix the file, and the next change
applies.

> Note: if `validateOnStartup` is **not** enabled, a reload swaps in
> the new config unconditionally. Enable `validateOnStartup` if you
> want bad reloads rejected.

## Atomicity

`reload()` re-loads and merges the *whole config*, runs validation,
then swaps the result in atomically. There is no intermediate state
where half the keys are updated and half are not. A single
whole-config `onChange` event fires after the swap.

## Watch mechanism

The watcher resolves each file source's path and opens a Node
`fs.watch` on it, de-duplicating already-watched paths
(`ConfigWatcherService.watch`). It reacts to `fs.watch` events
whose `eventType` is `'change'`, calling back into `ConfigService` to
reload. There are no polling-interval or debounce options — the change
event triggers a reload directly, so a rapid burst of writes can drive
several reloads. `unwatch()` closes every `FSWatcher` and clears the
tracked set (`ConfigWatcherService.unwatch`); `ConfigService`
calls it on both `onStop` and `onDestroy`. On filesystems where
`fs.watch` is unreliable (some NFS mounts), prefer a restart-on-change
deployment or a `remote` source instead.

## Multi-pod considerations

Hot reload changes config **only on the pod where the file was
modified**. For multi-pod deployments:

- Use a config tool that pushes to all pods (e.g. K8s ConfigMap +
  pod restart, or a remote source that polls).
- Or restart pods on config change — losing the hot-reload benefit
  but gaining cross-pod consistency.

The `remote` source type (experimental) is built for the
push-to-all-pods case; it polls a central server.

## Anti-patterns

- **Treating the `onChange` callback as transactional.** If your
  handler fails partway, you have inconsistent state. Make handlers
  idempotent.
- **Restarting a pool on every reload event.** A file reload fires a
  whole-config event even when the key you care about didn't change.
  Compare the value you read against the current one before acting.
- **Mutable singletons reading config in hot paths.** Read once at
  `onInit` and update inside `onChange`. Reading on every call pays
  the lookup cost forever.
- **Forgetting to unsubscribe.** `onChange` returns a disposer; call
  it in `onDestroy`.

→ Back to [Configuration Overview](./overview.md).
