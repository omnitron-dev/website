---
sidebar_position: 3
title: Graceful Shutdown
description: Phased shutdown with hard-exit guarantees.
---

# Graceful Shutdown

Production systems must shut down cleanly under three conditions:

1. The orchestrator sends `SIGTERM` (deploy, scale-down, restart).
2. Operator pressed Ctrl-C (`SIGINT`).
3. The process supervisor signals reload (`SIGHUP`).

Titan handles all three with a phased shutdown coordinator that
guarantees a hard exit within `gracefulShutdownTimeout`, regardless
of in-flight work.

## Hook-driven shutdown

For most providers, you do not register shutdown tasks directly —
you implement `OnStop` and/or `OnDestroy`:

```typescript
@Service({ name: 'Orders' })
export class OrdersService implements OnStop, OnDestroy {
  async onStop()    { await this.queue.drain(); }
  async onDestroy() { await this.metrics.flush(); }
}
```

The shutdown coordinator runs `onStop` in reverse dependency order,
then `onDestroy` in the same order, then issues a final hard-exit
guarantee.

## Triggering shutdown

| Source                     | Effect                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `await app.stop()`         | Programmatic; reason = `ShutdownReason.Manual`              |
| `SIGTERM`                  | Standard orchestrator stop; reason = `SIGTERM`              |
| `SIGINT`                   | Ctrl-C; reason = `SIGINT`                                   |
| `SIGHUP`                   | Reload; reason = `SIGHUP`                                   |
| Uncaught exception         | reason = `UncaughtException`                                |
| Unhandled rejection        | reason = `UnhandledRejection`                               |

Reasons (from `ShutdownReason` enum): `Manual`, `SIGTERM`, `SIGINT`,
`SIGHUP`, `Signal`, `UncaughtException`, `UnhandledRejection`,
`Timeout`, `Error`, `Reload`, `Upgrade`, `Maintenance`.

## `app.stop()` options

`IShutdownOptions` is `{ timeout?, force?, graceful?, signal? }`:

```typescript
await app.stop({
  timeout:  10_000,   // override gracefulShutdownTimeout for this call
  force:    false,    // true → swallow hook/task/module errors, push to Stopped
  graceful: true,     // false → a module-stop error aborts (unless force)
});
```

A direct `app.stop()` always reports `ShutdownReason.Manual` to
shutdown-task handlers and the `ShutdownComplete` event. The reason
variants (`SIGTERM`, `Maintenance`, …) come from the signal/programmatic
path that calls the internal `shutdown(reason)` entry, not from a
`reason` field on `stop()`.

## Custom shutdown tasks

For tasks that don't belong to any single provider, register them
directly with the application:

```typescript
import { ShutdownPriority } from '@omnitron-dev/titan';

app.registerShutdownTask({
  id:       'audit.flush',
  name:     'Flush audit log',
  priority: ShutdownPriority.High,
  timeout:  5_000,
  handler:  async () => {
    await auditClient.flush();
  },
});

// Later, if you no longer want this task:
app.unregisterShutdownTask('audit.flush');
```

`ShutdownPriority` is a numeric enum (lower = runs first):
`First (0)`, `VeryHigh (10)`, `High (20)`, `AboveNormal (30)`,
`Normal (50)`, `BelowNormal (70)`, `Low (80)`, `VeryLow (90)`,
`Last (100)`.

## The hard-exit guarantee

The coordinator runs a watchdog timer for the whole shutdown:

```typescript
gracefulShutdownTimeout: 30_000  // default
```

If the timer fires before shutdown completes, the process exits
with a non-zero code. A misbehaving handler cannot hold the process
alive forever.

> **Why this matters.** A single `await db.disconnect()` that hangs
> because the connection is half-closed can deadlock the entire
> process. In production this means the orchestrator's restart loop
> stalls; the deploy hangs; on-call gets paged. The hard exit is
> strictly better: a forced exit is recoverable, an indefinite hang
> is not.

## Disabling auto-binding

If you embed Titan inside a larger Node.js process (test harness,
another framework, an Electron renderer), set
`disableGracefulShutdown: true`. Titan will not bind signal
handlers; you call `app.stop()` yourself.

```typescript
const app = await Application.create({
  modules: [AppModule],
  disableGracefulShutdown: true,
});
```

## Observability

The shutdown coordinator emits these events through the Application
event bus:

| Event                                | Payload                                       |
| ------------------------------------ | --------------------------------------------- |
| `ApplicationEvent.ShutdownStart`     | `{ reason, details }`                         |
| `ApplicationEvent.ShutdownTaskComplete` | `{ task }`                                 |
| `ApplicationEvent.ShutdownTaskError` | `{ task, error }`                             |
| `ApplicationEvent.ShutdownComplete`  | `{ reason, success }`                         |
| `ApplicationEvent.ShutdownError`     | `{ reason, error }`                           |

Per-phase timing flows through `ApplicationEvent.LifecyclePhaseEvent`
(a `LifecyclePhaseEvent` with `phase`, `kind`, and timing fields), which
is where duration histograms belong. Subscribe in production to record
shutdown outcomes:

```typescript
app.on(ApplicationEvent.ShutdownComplete, ({ reason, success }) => {
  metrics.counter('app.shutdown', { reason, success: String(success) }).inc();
});
```

## Anti-patterns

- **Long-running work outside `onStop`/`onDestroy`.** Anything that
  needs to clean up at shutdown should be hooked in via the lifecycle
  interfaces, not started with `setTimeout`.
- **Catching errors in shutdown tasks and continuing.** A failed
  task should fail (and let the coordinator move on or escalate),
  not silently swallow. The coordinator already isolates failures.
- **Spawning new async work in shutdown.** The framework cannot wait
  for promises you do not return. If you `setTimeout` something
  during shutdown, it will be killed on hard exit.
- **Long blocking sync code.** The coordinator can only timeout
  async work. A 30 s synchronous CPU loop will not be interrupted.

→ Next: [Health](./health.md).
