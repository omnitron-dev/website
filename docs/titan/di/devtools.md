---
sidebar_position: 9
title: DevTools
description: Inspect the container at runtime — graph rendering, resolution timing, memory usage.
---

# DevTools

The Nexus DevTools let you introspect a running container: which
providers are registered, what depends on what, how long resolutions
take, what the in-memory graph looks like.

DevTools are **opt-in**. They add observability overhead and should
not be enabled in production unless you are diagnosing a specific
issue.

## Setup

```typescript
import { Container, ContainerDevtools } from '@omnitron-dev/titan/nexus';

const container = new Container();
const devtools = new ContainerDevtools(container, {
  trackResolutions: true,        // record per-resolution timing
  trackMemory:      true,        // periodic snapshots of provider count + memory
  snapshotIntervalMs: 30_000,    // memory snapshot frequency
});
```

DevTools attach as a passive observer. They do not change container
behaviour.

## Graph rendering

```typescript
const mermaid = devtools.renderGraph({ format: 'mermaid' });
console.log(mermaid);
```

Output is a Mermaid `flowchart` definition you can paste into Markdown
or a Mermaid renderer. Each node is a provider; each edge is a
constructor dependency.

Other formats:

| Format     | Output                                              |
| ---------- | --------------------------------------------------- |
| `mermaid`  | Mermaid flowchart (Markdown-friendly)               |
| `dot`      | Graphviz dot                                        |
| `json`     | Raw graph object (for custom tooling)               |
| `text`     | Indented ASCII tree                                 |

## Resolution timing

```typescript
const stats = devtools.getResolutionStats();

stats.forEach((s) => {
  console.log(`${s.token.padEnd(30)} count=${s.count.toString().padStart(5)} avgMs=${s.avgMs.toFixed(2).padStart(6)} maxMs=${s.maxMs.toFixed(2).padStart(6)}`);
});
```

Output:

```
DatabaseService                count=    1 avgMs= 124.30 maxMs= 124.30
LoggerService                  count=    1 avgMs=   8.10 maxMs=   8.10
UsersService                   count=    1 avgMs=   0.40 maxMs=   0.40
RequestContext                 count= 4231 avgMs=   0.02 maxMs=   1.10
```

Use to find:

- **Slow construction.** A `Singleton` with a high `avgMs` means
  startup is paying a one-time cost; a `Request` with a high `avgMs`
  pays it per request.
- **Unexpected resolution count.** A "singleton" being resolved
  thousands of times means the scope is wrong, or the consumer is
  calling `container.resolve` in a hot path instead of constructor-
  injecting.

## Memory snapshots

```typescript
const snapshots = devtools.getMemorySnapshots();

snapshots.forEach((s) => {
  console.log(`${new Date(s.timestamp).toISOString()}  providers=${s.providerCount}  heapMB=${(s.heapUsed / 1024 / 1024).toFixed(1)}`);
});
```

Per snapshot:

```
2026-05-15T20:00:00.000Z  providers=42   heapMB=128.4
2026-05-15T20:00:30.000Z  providers=42   heapMB=130.1
2026-05-15T20:01:00.000Z  providers=42   heapMB=131.5
```

If `providerCount` grows over time, you have a leak — likely a
`Transient` or `Request` provider holding a reference that the GC
cannot collect.

## Live inspection

```typescript
const snapshot = devtools.snapshot();
//
// snapshot:
//   { providers:
//     [{ token: 'UsersService',
//        scope: 'Singleton',
//        instanceCount: 1,
//        dependencies: ['Database', 'LoggerService'],
//        dependents:   ['OrdersService', 'AuthService'] },
//      …] }
```

Useful in REPL sessions or one-off diagnostics — "what depends on
this provider?", "how many instances exist?".

## Integrating with the Omnitron Console

The Omnitron web console exposes container devtools as a panel — same
graph, same stats, no manual instrumentation. Enable in the console's
settings (DevTools → Container).

## Production guidance

Enable DevTools only when:

- Diagnosing a specific issue (slow boot, suspected leak, mystery
  resolution).
- Running in a controlled environment with extra headroom.
- For a bounded period, then disable.

DevTools overhead is small (a few microseconds per resolution,
~10 KB per provider for tracked metadata) but it is non-zero.
Long-running production processes with full DevTools enabled will
slowly accumulate memory.

## Anti-patterns

- **Leaving DevTools on in production by default.** Diagnostic
  tooling, not a runtime requirement.
- **Using DevTools data to drive runtime decisions.** The data is
  for *humans diagnosing*, not for code reading. If your application
  needs to know about its own DI graph at runtime, you have probably
  reinvented configuration in a worse form.
- **Grep'ing the rendered graph instead of `git grep`.** The static
  graph in your code is the source of truth. DevTools shows the
  *runtime* graph after conditional providers have been resolved.

→ Back to [DI Overview](./overview.md).
