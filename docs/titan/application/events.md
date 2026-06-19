---
sidebar_position: 5
title: Application Events
description: The framework event bus — what fires, what to subscribe to, and what to ignore.
---

# Application Events

The kernel emits a typed set of events through the `Application`
event bus. Subscribe when you need to observe framework behaviour or
instrument the runtime.

## API

```typescript
import { ApplicationEvent } from '@omnitron-dev/titan';

app.on(ApplicationEvent.Started, (data) => { /* … */ });
app.off(ApplicationEvent.Started, handler);
app.once(ApplicationEvent.Started, (data) => { /* … */ });
app.emit('user.created', { id, email });   // user events too
```

`on` accepts a typed `ApplicationEvent` enum value (or a string for
custom events). Handlers receive `(data, meta?)` where `meta`
carries event metadata. Handler return values are ignored.

## Framework-emitted events

| Enum                              | String value             | Payload (as emitted by the kernel)               |
| --------------------------------- | ------------------------ | ------------------------------------------------ |
| `ApplicationEvent.Starting`       | `'starting'`             | _(none)_                                         |
| `ApplicationEvent.Started`        | `'started'`              | _(none)_                                         |
| `ApplicationEvent.Stopping`       | `'stopping'`             | _(none)_                                         |
| `ApplicationEvent.Stopped`        | `'stopped'`              | _(none)_                                         |
| `ApplicationEvent.Error`          | `'error'`                | the raw `Error` (or `{ error }` from the bus)    |
| `ApplicationEvent.ModuleRegistered` | `'module:registered'`  | `{ module }`                                     |
| `ApplicationEvent.ModuleStarted`  | `'module:started'`       | `{ module }`                                     |
| `ApplicationEvent.ModuleStopped`  | `'module:stopped'`       | `{ module }`                                     |
| `ApplicationEvent.ConfigChanged`  | `'config:changed'`       | `{ config }` (full reconfigure) or `{ key, value }` (`setConfig`) |
| `ApplicationEvent.HealthCheck`    | `'health:check'`         | _(reserved; not emitted by the kernel itself)_   |
| `ApplicationEvent.Signal`         | `'signal'`               | `{ signal }`                                     |
| `ApplicationEvent.UncaughtException` | `'uncaughtException'` | `{ error }` (or `{ error, recovered: true }`)    |
| `ApplicationEvent.UnhandledRejection` | `'unhandledRejection'` | `{ reason, promise }`                          |
| `ApplicationEvent.StateSave`      | `'state:save'`           | _(none)_                                         |
| `ApplicationEvent.ShutdownStart`  | `'shutdown:start'`       | `{ reason, details }`                            |
| `ApplicationEvent.ShutdownComplete` | `'shutdown:complete'`  | `{ reason, success }`                            |
| `ApplicationEvent.ShutdownError`  | `'shutdown:error'`       | `{ reason, error }`                              |
| `ApplicationEvent.ShutdownTaskComplete` | `'shutdown:task:complete'` | `{ task }`                               |
| `ApplicationEvent.ShutdownTaskError` | `'shutdown:task:error'` | `{ task, error }`                               |
| `ApplicationEvent.LifecyclePhaseEvent` | `'lifecycle:phase'`   | `LifecyclePhaseEvent` (`{ phase, kind, taskName?, error?, … }`) |
| `ApplicationEvent.ProcessExit`    | `'process:exit'`         | `{ code }`                                       |
| `ApplicationEvent.Custom`         | `'custom'`               | depends on the emitter                           |

The full enum is exported as `ApplicationEvent` from
`@omnitron-dev/titan/application` or via the root barrel.

## Typed handlers

```typescript
app.on(ApplicationEvent.ShutdownComplete, ({ reason, success }) => {
  metrics.counter('app.shutdown', { reason, success: String(success) }).inc();
});
```

The data type is what the kernel actually emits for that event;
exact field shapes can change between minor versions, so handlers
that read deep fields should be defensive (use optional chaining).

## Custom events

Modules can emit and subscribe to their own events. The event name
is a free-form string; the payload is typed by the emitter.

```typescript
app.emit('user.created', { id, email });

app.on('user.created', (data) => { /* … */ });
```

Use sparingly. For domain events between services, prefer the
[`titan-events`](../modules/events) module — it gives you schema
validation, scheduled delivery, and structured handler composition.
The application event bus is for *framework-level* signalling and
ad-hoc lightweight notifications, not for business workflows.

## Common subscriptions

### Boot timing

`Started` carries no payload — read `app.uptime` (ms since start) at
the moment it fires:

```typescript
app.on(ApplicationEvent.Started, () => {
  metrics.histogram('app.boot.ms').observe(app.uptime);
});
```

### Crash signals

`Error` delivers the raw `Error` (the in-process event bus may wrap it
as `{ error }` — be defensive):

```typescript
app.on(ApplicationEvent.Error, (data) => {
  const error = data instanceof Error ? data : (data as { error?: Error }).error;
  oncall.page({ message: 'Titan lifecycle error', error });
});
```

### Config-change audit

```typescript
app.on(ApplicationEvent.ConfigChanged, (data) => {
  // `{ config }` on a full reconfigure, `{ key, value }` on setConfig().
  audit.log('config.changed', data);
});
```

### Shutdown bookkeeping

```typescript
app.on(ApplicationEvent.ShutdownComplete, ({ reason, success }) => {
  metrics.counter('app.shutdown', { reason, success: String(success) }).inc();
});
```

## Event ordering guarantees

- Framework events for the same phase fire in dependency order
  (same as the hooks themselves).
- Events emitted from inside a handler are queued; they run after
  the current handler returns.
- `emit` does **not** await handlers. For synchronous coordination,
  use the lifecycle hooks instead.

## Anti-patterns

- **Mutating application state from handlers.** Handlers are
  observers. If you find yourself starting / stopping providers
  from a handler, you are probably looking for a lifecycle hook.
- **Long-running async work in handlers.** Handlers are not
  awaited. An `async` handler that does heavy work will run, but
  the event bus will not delay subsequent events for it. For long
  work, use a scheduled job and trigger it from the handler.
- **Treating user events as a transport.** The application event
  bus is in-process and has no delivery guarantees. For
  cross-process events, use `titan-events` over redis or the
  notifications module.

→ Next: [Modules](../modules-system/defining-modules.md).
