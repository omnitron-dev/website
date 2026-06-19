---
sidebar_position: 3
title: Log Processors
description: The ILogProcessor pipeline (transform / drop, child-inherited) and how it relates to Pino's native redact.
---

# Log Processors

Read this first: **processors are a functional, hot-path pipeline.**
Every registered `ILogProcessor` runs on every log line — through
Pino's `logMethod` hook, which is inherited by the root logger **and**
all child loggers. Each processor either **transforms** the record
(returns the modified object) or **drops** the log entirely (returns
`null`/`undefined`). Redaction has two working paths: Pino's native
`redact` option (recommended for simple path redaction) and a
`RedactionProcessor` (for arbitrary transform/drop logic).

## How the pipeline runs

`LoggerService` installs the pipeline as Pino's `logMethod` hook when it
builds the root logger
(`packages/titan/src/modules/logger/logger.service.ts:219-227`). Because
the hook lives on the root logger, **every child logger inherits it** —
processors apply everywhere, not just on the root.

For each log call the service builds the record the processors see,
runs each processor in order, and then either drops the log or forwards
the (possibly transformed) fields back to Pino
(`logger.service.ts:464-517`). The record shape is:

```typescript
{
  level: '<string label>',   // e.g. 'info' — pino-managed, re-emitted by pino
  time:  1715800000000,      // ms epoch — pino-managed, re-emitted by pino
  ...childBindings,          // bindings from base / setContext / child()
  ...perCallFields,          // the object you passed: logger.info({ id }, …)
  msg:   'the message',      // present when a message was passed
  // err: <Error>            // present only for a top-level Error argument
}
```

After the pipeline, `level`/`time`/`msg` are stripped before the call
because they are **pino-managed** — pino re-emits its own values
(`logger.service.ts:494-501`). A top-level `Error` is preserved as the
original object so Pino's native error serialiser still applies
(`logger.service.ts:502-511`).

**Fast path.** With no processors registered the hook is a single
length check and a passthrough (`logger.service.ts:221-224`), so the
common case keeps Pino's native overhead — zero added cost.

**Dynamic registration.** The processor list is read **by reference on
every log**, so `LoggerService.addProcessor()` after init takes effect
on the next log line (`logger.service.ts:449-451`, list consumed at
`:487-492`). You can also register at startup via
`LoggerModule.forRoot({ processors })`.

```typescript
import type { ILogProcessor } from '@omnitron-dev/titan/module/logger';

// Transform: enrich every line with a static field
const RegionProcessor: ILogProcessor = {
  process(record) {
    record.region = process.env.REGION ?? 'unknown';
    return record;            // return the (modified) record to keep it
  },
};

// Drop: suppress health-check noise entirely
const DropHealthChecks: ILogProcessor = {
  process(record) {
    if (record.path === '/healthz') return null;  // null/undefined → log dropped
    return record;
  },
};

LoggerModule.forRoot({ processors: [RegionProcessor, DropHealthChecks] });
```

## The `ILogProcessor` interface

```typescript
interface ILogProcessor {
  process(log: any): any | null;
}
```

A processor is a single `process(log)` method that returns a
transformed log object, or `null`/`undefined` to drop the record
(`logger.types.ts:67-69`). Processors run in registration order; the
first one to return `null`/`undefined` short-circuits the rest and
emits nothing (`logger.service.ts:487-492`).

## Redaction

Redaction has two working paths — pick by need:

- **`redact` option (recommended for simple path redaction).** Pino's
  own redaction, configured on the module option, runs inside Pino's
  serialisation on the hot path. It is pino-optimised and supports
  `*` wildcards and bracket notation. See below.
- **A processor (for arbitrary transform/drop logic).** Use the
  `ILogProcessor` pipeline when you need conditional redaction,
  cross-field logic, computed values, or dropping. The bundled
  `RedactionProcessor` (below) is the simple case.

### `redact` (Pino native)

Set the `redact` module option. `LoggerService` forwards it straight to
Pino when it builds the root logger (`logger.service.ts:195-204`):

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
(`logger.service.ts:368`). **Set the list per app** — Titan redacts
nothing by default (`redact: config.redact || []`,
`logger.service.ts:199`), because what counts as sensitive is
project-specific.

> **Redaction is defence-in-depth, not a primary control.** It catches
> a field that slips through; it is not a licence to log secrets.
> Don't put credentials into a log call in the first place.

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

// Registered as a processor, it now redacts every line on the log path:
LoggerModule.forRoot({ processors: [p] });
```

Registered via `forRoot({ processors })`, it **does** redact your logs —
it runs on the hot path like any processor. Prefer Pino's `redact`
option for plain path redaction (it is pino-optimised and supports
wildcards / custom censor); reach for the processor when you need the
processor pipeline's extra power (conditional logic, drop).

## Other shaping mechanisms

- **To enrich** every line with static fields, you can also use `base`
  (`forRoot({ base: { region, version } })`) or `setContext(...)`,
  both of which flow into Pino's bindings — lower-ceremony than a
  processor when the field is constant.
- **To add per-request context** (trace ID, user ID), bind a **child
  logger** — see [Child Loggers](./child-loggers.md). This is the
  idiomatic way to attach per-scope fields.
- **To filter by level**, set the level (`forRoot({ level })` or
  `setLevel`); Pino drops below-threshold records before serialising —
  cheaper than a dropping processor for a pure level cut.

## Pretty output

Human-readable dev output is a Pino concern, not a processor one. See
[Logging Overview](./overview.md) for the module's pretty-print handling
(via pino-pretty) and how JSON-vs-pretty is selected.

## Anti-patterns

- **A dropping processor where a level cut would do.** To suppress a
  whole level, set `level` — Pino drops below-threshold records before
  serialising, cheaper than running a processor that returns `null`.
- **Heavy work in `process()`.** It runs on every log line (after the
  level filter). Keep it cheap; offload expensive shipping to a
  [transport](./transports.md), which runs off the hot path.
- **Redaction as the only privacy guard.** It is defence-in-depth.
  Don't log secrets to begin with.
- **A processor for a constant field.** A static value belongs on
  `base` or `setContext`; a per-scope value belongs on a child logger,
  not a global transform.

→ Next: [Child Loggers](./child-loggers.md).
