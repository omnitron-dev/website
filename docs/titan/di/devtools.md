---
sidebar_position: 9
title: DevTools
description: Inspect the container at runtime — dependency graph, performance, state snapshots.
---

# DevTools

The Nexus DevTools let you introspect a running container: which
providers are registered, what depends on what, how long
resolutions take, what the in-memory graph looks like.

DevTools are **experimental** (`@experimental` JSDoc marker in the
source) and exported wholesale from
`@omnitron-dev/titan/nexus/devtools` via
`@omnitron-dev/titan/nexus`'s `export *`. The exact public class
names live in `src/nexus/devtools.ts`; the patterns shown here are
the canonical use cases.

```typescript
import {
  // From the devtools wildcard re-export. Check the source for
  // the precise class / function names in your version.
} from '@omnitron-dev/titan/nexus';
```

## Three things DevTools tell you

1. **The dependency graph** — what depends on what, who has cycles,
   who is reachable from where.
2. **Performance** — resolution timings per token; total time
   spent constructing each provider.
3. **State** — current scopes, in-flight resolutions, observer
   events.

## The `DependencyGraph` shape

DevTools' graph output uses a simple, stable shape:

```typescript
interface DependencyGraph {
  nodes: Array<{ id: string; label?: string; type?: string }>;
  edges: Array<{ from: string; to: string; type?: 'dependency' | 'parent' }>;
  roots?: string[];
  leaves?: string[];
}
```

You can render this with any graph library (Mermaid, Graphviz,
D3, etc.) — it isn't tied to a specific renderer.

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

manager.on(LifecycleEvent.ResolutionStart, (data: LifecycleEventData) => {
  // …
});
```

## DevTools messages

DevTools internally use a typed message protocol:

```typescript
interface DevToolsMessage {
  type:        MessageType;
  timestamp:   number;
  containerId: string;
  data:        any;
}
```

Useful for piping container events to an external panel (e.g. the
Omnitron web console).

## Production guidance

Enable DevTools only when:

- Diagnosing a specific issue (slow boot, suspected leak,
  mystery resolution).
- Running in a controlled environment with extra headroom.
- For a bounded period, then disable.

The overhead is small (a few microseconds per resolution,
~10 KB per provider for tracked metadata) but non-zero. Long-running
production processes with full DevTools enabled will slowly
accumulate memory.

## Anti-patterns

- **Leaving DevTools on in production by default.** Diagnostic
  tooling, not a runtime requirement.
- **Using DevTools data to drive runtime decisions.** The data is
  for *humans diagnosing*, not for code reading. If your
  application needs to know about its own DI graph at runtime, you
  have probably reinvented configuration in a worse form.

→ Back to [DI Overview](./overview.md).
