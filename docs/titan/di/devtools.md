---
sidebar_position: 9
title: DevTools
description: Inspect the container at runtime — dependency graph, performance, state snapshots.
---

# Container Introspection

> **History.** An experimental `DevToolsServer` / `DevToolsPlugin`
> debugger (with its own wire protocol) once lived in
> `src/nexus/devtools.ts`. It had zero consumers and was **removed**
> (NX-5); `NEXUS_FEATURES.DEVTOOLS` is `false`. There is no
> `@omnitron-dev/titan/nexus/devtools` subpath. What survived — and
> what this page documents — is the dependency-graph export plus the
> lifecycle-observer system, both of which ship from the main
> `@omnitron-dev/titan/nexus` barrel.

You can still introspect a running container: which providers are
registered, what depends on what, how long resolutions take, what the
in-memory graph looks like.

## Two things you can inspect

1. **The dependency graph** — `Container.exportGraph()` returns the
   provider/dependency graph, renderable as DOT, Mermaid, or JSON.
2. **Lifecycle events** — the observer system surfaces resolution
   timings, memory, and an audit trail.

## The dependency graph — `Container.exportGraph()`

The container exposes `exportGraph(options?)` directly. It walks the
container's registrations and returns a stable `DependencyGraph`
(defined in `src/nexus/dependency-graph.ts`):

```typescript
import { exportToMermaid, exportToDot, exportToJson } from '@omnitron-dev/titan/nexus';

const graph = container.exportGraph();        // { includeParent?: boolean }

interface DependencyGraph {
  nodes: Array<{ id: string; label?: string; type?: string }>;
  edges: Array<{ from: string; to: string; type?: 'dependency' | 'parent' }>;
  roots?: string[];
  leaves?: string[];
}

console.log(exportToMermaid(graph));          // also: exportToDot, exportToJson
```

The same export backs `omnitron inspect <app> --graph`. The three
formatters (`exportToDot` / `exportToMermaid` / `exportToJson`) are
exported from the nexus barrel, so you can render the graph with
Graphviz, Mermaid, or pipe the JSON anywhere.

## Observers

DevTools build on Nexus's lifecycle observation system. Three
built-in observers ship in `nexus/lifecycle.ts`:

| Observer                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `AuditObserver`         | Audit every provider lifecycle event                 |
| `MemoryObserver`        | Track memory growth per provider                     |
| `PerformanceObserver`   | Track resolution timing                              |

Attach observers via `LifecycleManager`:

```typescript
import {
  LifecycleManager,
  AuditObserver,
  PerformanceObserver,
  type LifecycleEvent,
  type LifecycleEventData,
  type LifecycleObserver,
} from '@omnitron-dev/titan/nexus';

const manager = new LifecycleManager();
manager.addObserver(new AuditObserver());
manager.addObserver(new PerformanceObserver());

manager.on(LifecycleEvent.BeforeResolve, (data: LifecycleEventData) => {
  // …
});
```

The resolution events are `BeforeResolve` (`'resolve:before'`),
`AfterResolve` (`'resolve:after'`), and `ResolveFailed`
(`'resolve:failed'`) — see the full `LifecycleEvent` map in
`src/nexus/lifecycle.ts` for container, instance, module, cache,
scope, and middleware events.

## Production guidance

Enable observers only when:

- Diagnosing a specific issue (slow boot, suspected leak,
  mystery resolution).
- Running in a controlled environment with extra headroom.
- For a bounded period, then disable.

Observers add per-resolution work and retain event data, so the
overhead is non-zero. Long-running production processes with verbose
observers attached will slowly accumulate memory — attach them for a
bounded window, then remove them.

## Anti-patterns

- **Leaving verbose observers on in production by default.**
  Diagnostic tooling, not a runtime requirement.
- **Using introspection data to drive runtime decisions.** The graph
  and observer data are for *humans diagnosing*, not for code reading.
  If your application needs to know about its own DI graph at runtime,
  you have probably reinvented configuration in a worse form.

→ Back to [DI Overview](./overview.md).
