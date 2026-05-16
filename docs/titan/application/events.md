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

| Enum                              | String value             | Payload (typical)                                |
| --------------------------------- | ------------------------ | ------------------------------------------------ |
| `ApplicationEvent.Starting`       | `'starting'`             | `{}`                                             |
| `ApplicationEvent.Started`        | `'started'`              | `{ durationMs }`                                 |
| `ApplicationEvent.Stopping`       | `'stopping'`             | `{ reason }`                                     |
| `ApplicationEvent.Stopped`        | `'stopped'`              | `{ durationMs }`                                 |
| `ApplicationEvent.Error`          | `'error'`                | `{ error, phase?, providerName? }`               |
| `ApplicationEvent.ModuleRegistered` | `'module:registered'`  | `{ name, version }`                              |
| `ApplicationEvent.ModuleStarted`  | `'module:started'`       | `{ name }`                                       |
| `ApplicationEvent.ModuleStopped`  | `'module:stopped'`       | `{ name }`                                       |
| `ApplicationEvent.ConfigChanged`  | `'config:changed'`       | `{ key, oldValue, newValue, source }`            |
| `ApplicationEvent.HealthCheck`    | `'health:check'`         | `{ status, modules, details }`                   |
| `ApplicationEvent.Signal`         | `'signal'`               | `{ signal }`                                     |
| `ApplicationEvent.UncaughtException` | `'uncaughtException'` | `{ error }`                                      |
| `ApplicationEvent.UnhandledRejection` | `'unhandledRejection'` | `{ reason }`                                    |
| `ApplicationEvent.StateSave`      | `'state:save'`           | `{ state }`                                      |
| `ApplicationEvent.ShutdownStart`  | `'shutdown:start'`       | `{ reason }`                                     |
| `ApplicationEvent.ShutdownComplete` | `'shutdown:complete'`  | `{ totalDurationMs, hardExit? }`                 |
| `ApplicationEvent.ShutdownError`  | `'shutdown:error'`       | `{ error }`                                      |
| `ApplicationEvent.ShutdownTaskComplete` | `'shutdown:task:complete'` | `{ taskId, name, durationMs }`           |
| `ApplicationEvent.ShutdownTaskError` | `'shutdown:task:error'` | `{ taskId, name, error }`                       |
| `ApplicationEvent.LifecyclePhaseEvent` | `'lifecycle:phase'`   | `{ phase, providerName?, durationMs, status }`   |
| `ApplicationEvent.ProcessExit`    | `'process:exit'`         | `{ code, signal? }`                              |
| `ApplicationEvent.Custom`         | `'custom'`               | depends on the emitter                           |

The full enum is exported as `ApplicationEvent` from
`@omnitron-dev/titan/application` or via the root barrel.

## Typed handlers

```typescript
app.on(ApplicationEvent.ShutdownComplete, (data) => {
  metrics.histogram('app.shutdown.ms').observe(data.totalDurationMs);
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
[`titan-events`](../modules/events.md) module — it gives you schema
validation, scheduled delivery, and structured handler composition.
The application event bus is for *framework-level* signalling and
ad-hoc lightweight notifications, not for business workflows.

## Common subscriptions

### Boot SLA

```typescript
app.on(ApplicationEvent.Started, ({ durationMs }) => {
  metrics.histogram('app.boot.ms').observe(durationMs);
});
```

### Crash signals

```typescript
app.on(ApplicationEvent.Error, ({ error, phase, providerName }) => {
  oncall.page({ message: `Titan crashed in ${phase}`, providerName, error });
});
```

### Config hot-reload audit

```typescript
app.on(ApplicationEvent.ConfigChanged, ({ key, oldValue, newValue, source }) => {
  audit.log('config.changed', { key, oldValue, newValue, source });
});
```

### Shutdown SLA

```typescript
app.on(ApplicationEvent.ShutdownComplete, ({ totalDurationMs }) => {
  metrics.histogram('app.shutdown.ms').observe(totalDurationMs);
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
