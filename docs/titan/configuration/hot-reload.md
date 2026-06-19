---
sidebar_position: 4
title: Configuration Hot Reload
description: Change config without restarting — when, how, and the gotchas.
---

# Configuration Hot Reload

The `ConfigWatcherService` watches file sources for changes. On a
change it triggers `ConfigService.reload()`, which re-loads **all**
sources, re-validates against the schema, and notifies subscribers
registered via `ConfigService.onChange()`.

> ⚠️ NEEDS REWRITE — earlier drafts of this page described a
> `config:changed` application-bus event with per-leaf-key diffing
> and `watch: { pollIntervalMs, debounceMs }` options. None of that
> exists in the current implementation
> (`packages/titan/src/modules/config/`). The corrected behaviour
> below reflects `config.service.ts` / `config-watcher.service.ts`:
> subscription is through the `onChange()` callback, the watcher uses
> `fs.watch` (no polling/debounce knobs), and a reload re-loads and
> re-validates the **whole** config — there is no leaf-key diff.

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

Omit it (or set it `false`) to disable watching.

## Subscribing to changes

Register a listener with `ConfigService.onChange()`. It returns an
unsubscribe function — call it in `onDestroy` to avoid leaks. There
is **no** `config:changed` event on the application bus.

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
diff and emit per leaf key. A programmatic `config.set(path, value)`
fires a targeted event for that `path` with `source: 'runtime'`.

So inside an `onChange` handler, re-read the specific keys you care
about from `ConfigService` rather than relying on a per-key payload.

## Validation on reload

`reload()` only re-validates when `validateOnStartup` is set and a
schema is present. In that case a reload that fails validation is
**rejected** — `reload()` restores the previous config and throws,
so the running app keeps its last-known-good values. The reload is
triggered from the watcher's change handler, which logs the failure
rather than propagating it.

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

The watcher uses Node's `fs.watch` on each file source (see
`config-watcher.service.ts`). There are no polling-interval or
debounce options — the change event from `fs.watch` triggers a
reload directly. On filesystems where `fs.watch` is unreliable
(some NFS mounts), prefer a restart-on-change deployment or a
`remote` source instead.

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
