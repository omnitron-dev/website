---
sidebar_position: 4
title: Configuration Hot Reload
description: Change config without restarting — when, how, and the gotchas.
---

# Configuration Hot Reload

The `ConfigWatcherService` watches file sources for changes,
re-validates against the schema, and emits a `config:changed` event
on the application bus. Subscribers update their internal state.

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

Hot reload is on by default for file sources. To disable:

```typescript
ConfigModule.forRoot({
  schema: AppConfigSchema,
  sources: [...],
  watch: false,
})
```

## Subscribing to changes

```typescript
@Service('cache@1.0.0')
class CacheService implements OnInit {
  constructor(
    @Inject(ApplicationToken) private readonly app: IApplication,
    private readonly config: ConfigService,
  ) {}

  async onInit() {
    this.applyTtl(this.config.get<number>('cache.ttlMs'));

    this.app.on('config:changed', ({ key, newValue }) => {
      if (key === 'cache.ttlMs') this.applyTtl(newValue as number);
    });
  }

  private applyTtl(ms: number) {
    this.cache.setDefaultTtl(ms);
  }
}
```

The event payload:

```typescript
{
  key:      'cache.ttlMs',
  oldValue: 60_000,
  newValue: 120_000,
  source:   'config/production.yaml',
  timestamp: 1715800000000,
}
```

## What gets emitted

The watcher diffs the post-validation config against the previous
version. One event per **changed leaf key**, not one per file
change.

Editing a single key in a 200-key config emits one event, not 200.

## Validation on reload

A reload that fails validation is **rejected** — the running config
remains unchanged. The watcher logs a warning:

```
WARN config.watcher  validation failed for config/staging.yaml; keeping previous config
  port: expected number, got "3000a"
```

This means a typo in a config file does not crash the running app.
You see the warning, fix the file, and the next change applies.

## Atomicity

The watcher loads the *whole config*, runs validation, then diffs
against the previous version. There is no intermediate state where
half the keys are updated and half are not.

## Watch frequency

The default watcher polls files every 1s (where `fs.watch` is
unreliable, e.g. NFS mounts) or uses `fs.watch` on supported
filesystems. Configure:

```typescript
ConfigModule.forRoot({
  schema: AppConfigSchema,
  sources: [...],
  watch: {
    pollIntervalMs: 5_000,
    debounceMs:     200,        // wait this long after last change before reloading
  },
})
```

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

- **Treating `config:changed` as transactional.** If your handler
  fails partway, you have inconsistent state. Make handlers
  idempotent.
- **Subscribing without handling the no-change case.** If a
  handler restarts a pool whenever it sees `config:changed`, even
  no-op changes cause restarts. Diff before acting.
- **Mutable singletons reading config in hot paths.** Read once at
  `onInit` and update on `config:changed`. Reading on every call
  pays the lookup cost forever.

→ Back to [Configuration Overview](./overview.md).
