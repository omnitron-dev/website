---
sidebar_position: 1
title: Overview
description: Five utility packages the rest of the stack is built on.
---

# Utilities

Five small, focused packages that every other package in the
ecosystem depends on. Each is independently versioned, has zero
peer-dependencies on the rest of the stack, and is usable in
non-Omnitron projects.

| Package | Purpose | Footprint |
| ------- | ------- | --------- |
| [`@omnitron-dev/common`](./common.md) | Type predicates, promise helpers, object tools, data structures | ~12 kB gz |
| [`@omnitron-dev/cuid`](./cuid.md) | Collision-resistant URL-safe IDs | <1 kB gz |
| [`@omnitron-dev/eventemitter`](./eventemitter.md) | Async event emitter with parallel/serial/reduce patterns | ~3 kB gz |
| [`@omnitron-dev/msgpack`](./msgpack.md) | Extensible MessagePack with custom types + streaming | ~8 kB gz |
| [`@omnitron-dev/kb`](./kb.md) | Knowledge-base framework for code intelligence | server-side |

## Where they're used

- **`common`** — anywhere primitives are needed. `isPlainObject`,
  `delay`, `omit` show up in every module.
- **`cuid`** — Omnitron's IDs (process IDs, run IDs, request IDs)
  + `titan-database` repository defaults.
- **`eventemitter`** — `titan-events`'s emitter base,
  `titan-telemetry-relay` internal bus, Omnitron daemon's
  scheduler.
- **`msgpack`** — Netron's default wire format. Why your typed
  errors survive the wire.
- **`kb`** — backs `omnitron kb mcp` MCP server + KB index used
  by AI agents.

## Standalone use

Each works without the rest of the stack:

```typescript
import { delay, retry, isPlainObject } from '@omnitron-dev/common';
import { cuid }                          from '@omnitron-dev/cuid';
import { EventEmitter }                  from '@omnitron-dev/eventemitter';
import { encode, decode }                from '@omnitron-dev/msgpack';
```

Pick the one you need; ignore the rest. No transitive Omnitron
runtime gets pulled in.
