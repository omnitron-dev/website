---
sidebar_position: 3
title: Log Processors
description: How redaction works (Pino's native redact) and the status of the ILogProcessor type.
---

# Log Processors

Read this first: **redaction is the real, working feature on this
page, and it is driven by Pino's native `redact` option — not by an
`ILogProcessor`.** The `ILogProcessor` interface and the
`RedactionProcessor` class exist in the public API, but `LoggerService`
does not run processors on the log write path. If you want to redact
fields, configure `redact` (below); reach for the processor API only
with that limitation in mind.

## Redaction (the supported mechanism)

Set the `redact` module option. `LoggerService` forwards it straight to
Pino when it builds the root logger
(`packages/titan/src/modules/logger/logger.service.ts:186`):

```typescript
LoggerModule.forRoot({
  redact: ['password', 'token', 'apiKey', 'headers.authorization', '*.creditCard'],
})
```

This is Pino's own redaction, so:

- It uses **Pino path syntax**, including `*` wildcards and bracket
  notation (`headers["x-api-key"]`).
- Matched values are replaced with `[Redacted]` by default; Pino also
  supports censoring to a custom value or removing keys entirely via
  the object form (`{ paths, censor, remove }`).
- It runs inside Pino's serialisation, on the actual hot path, for
  every log line — including child loggers.

You can also supply the list through `ConfigService` under the
`logger.redact` key, which `LoggerService` reads at startup
(`logger.service.ts:318`). **Set the list per app** — Titan redacts
nothing by default (`redact: config.redact || []`,
`logger.service.ts:186`), because what counts as sensitive is
project-specific.

> **Redaction is defence-in-depth, not a primary control.** It catches
> a field that slips through; it is not a licence to log secrets.
> Don't put credentials into a log call in the first place.

## The `ILogProcessor` interface and processor status

```typescript
interface ILogProcessor {
  process(log: any): any | null;
}
```

A processor is a single `process(log)` method that returns a
transformed log object, or `null` to drop the record
(`logger.types.ts:67-69`). You can register processors via
`LoggerModule.forRoot({ processors })` or `LoggerService.addProcessor()`.

**However, registered processors are not invoked on the log path.**
`LoggerService` stores them in an internal list (`addProcessor` pushes
to `this.processors`, `logger.service.ts:399-401`; the constructor
seeds it from the injected `processors`, `:169-171`) but nothing in the
service ever calls `process()`. Logging goes directly through Pino
(`LoggerImpl`, `logger.service.ts:65-141`), bypassing the processor
list entirely. There is no transform/filter/enrich pipeline running
today.

Practical consequences:

- **To redact**, use the `redact` option above — not a
  `RedactionProcessor`.
- **To enrich** every line with static fields, use `base`
  (`forRoot({ base: { region, version } })`) or `setContext(...)`,
  both of which flow into Pino's bindings.
- **To add per-request context** (trace ID, user ID), bind a **child
  logger** — see [Child Loggers](./child-loggers.md). This is the
  idiomatic way to attach contextual fields and is fully wired.
- **To filter by level**, set the level (`forRoot({ level })` or
  `setLevel`); Pino drops below-threshold records before serialising.

### `RedactionProcessor`

`RedactionProcessor` is exported and implements `ILogProcessor`. Its
constructor takes a **positional** `string[]` of dotted paths (not an
options object), and `process()` walks each path and replaces the
matched leaf with the literal string `'[REDACTED]'`. Paths are literal
dotted segments only — **no `*` wildcard support** in this class
(source: `logger.module.ts:213-239`):

```typescript
import { RedactionProcessor } from '@omnitron-dev/titan/module/logger';

const p = new RedactionProcessor(['password', 'token', 'headers.authorization']);
p.process({ password: 'hunter2' }); // → { password: '[REDACTED]' }
```

Because the service never runs processors, registering this class via
`forRoot({ processors })` does **not** redact your logs. It is usable
only if you call `process()` yourself. For real redaction, use Pino's
`redact` option — it is more capable (wildcards, custom censor) and
actually executes.

## Pretty output

Human-readable dev output is a Pino concern, not a processor one. See
[Logging Overview](./overview.md) for the module's pretty-print handling
and how JSON-vs-pretty is selected.

## Anti-patterns

- **Relying on `forRoot({ processors })` for redaction.** Processors do
  not run on the log path — use the `redact` option.
- **Redaction as the only privacy guard.** It is defence-in-depth.
  Don't log secrets to begin with.
- **Per-call data via a global mechanism.** A user ID or trace ID
  belongs on a child logger bound to that scope, not on a global
  transform.

→ Next: [Child Loggers](./child-loggers.md).
