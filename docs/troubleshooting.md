---
sidebar_position: 4
title: FAQ + Troubleshooting
description: Common questions and stumbling blocks across the stack.
---

# FAQ + Troubleshooting

The questions and errors that come up most often. Per-module
pages each have an "Anti-patterns" section — this page collects
the cross-cutting ones.

## FAQ

### Why decorators?

Decorators describe **intent** declaratively. The container
reads the metadata and wires the rest. Alternatives (factory
functions, builder APIs, configuration files) move the same
information to a less discoverable place. Decorators put the
contract next to the code it controls.

Trade-off: decorator-based DI requires
`experimentalDecorators` + `emitDecoratorMetadata` in
`tsconfig.json`. Everyone shipping production TypeScript has
this enabled anyway; new projects can use TC39 stage-3
decorators (also supported).

### Why a custom DI container (Nexus)?

InversifyJS, TypeDI, tsyringe — each has its own ergonomics
constraint. Nexus needed:
- Class tokens **and** symbol tokens **and** factory tokens.
- Scopes (singleton, transient, request, scoped).
- **Contextual injection** — one token, different providers per
  request context (multi-tenant, multi-environment).
- Cycle detection at startup.
- Lifecycle hooks tied to dependency order.

No existing container does all five. Nexus does.

### Why MessagePack over JSON for the wire?

RPC must round-trip types exactly. JSON loses Date, Map, Set,
BigInt, Error, Buffer; MessagePack with the package's extensions
preserves all of them — and the wire is ~25% smaller. For
service-to-service calls this is non-negotiable.

For human-readable APIs (debugger, curl), JSON over HTTP still
works via a separate REST gateway.

### Why one daemon, not per-app sidecars?

Sidecar-per-app multiplies operator overhead by N. Omnitron's
single daemon:
- Owns one Unix socket; CLI calls cost nothing.
- Aggregates metrics / logs across all apps in one ring buffer.
- Survives app crashes — the daemon stays up, apps restart.
- Hosts the web console + MCP server at the same address.

For multi-tenant strict isolation, run one daemon per
`~/.omnitron/` home directory.

### Why monorepo?

The stack's value comes from cross-layer typing. A monorepo
with TypeScript references lets the frontend's `useService<T>`
import the backend's `interface T` directly — no codegen, no
publish step.

Polyrepo works (publish the shared interfaces as a package), but
costs an extra round-trip on every contract change.

### Is Titan production-ready?

Yes. The stack runs production workloads at meaningful scale.
The modules ship with anti-patterns docs because production
shaped them.

If "production-ready" means "wide adoption + many StackOverflow
answers" — not yet at the NestJS level. The reference is the
docs you're reading.

### Why isn't there X module?

Because the work-set was deliberate. We shipped the modules
that show up in **every** backend (cache, auth, db, queue,
scheduler, …). For everything else, the [authoring guide](./titan/modules-system/authoring-modules.md)
describes how to publish a `@your-scope/titan-*` package that
plugs into the same DI grammar.

Domain-specific modules (e-commerce, ML, telecom, …) belong
outside the core to keep the ecosystem focused.

### Can I use Bun or Deno?

- **Apps**: yes, where the runtime matches your dependencies.
  The utility packages (`common`, `cuid`, `eventemitter`,
  `msgpack`) are explicitly cross-runtime tested.
- **Omnitron daemon**: Node only — uses Node's `child_process`
  in a way Bun and Deno don't fully match.
- **Tests**: see [Cross-runtime testing](./testing/cross-runtime.md).

### How does pricing / licensing work?

MIT across every package. No commercial fork, no enterprise
tier, no support contracts. Use at any scale.

### When should I NOT use this stack?

- **Static sites / marketing pages** — overkill. Use Astro / Next.
- **Single-script automation** — overkill. Use plain TypeScript.
- **Languages other than TS** — the value is end-to-end TS. If
  the team writes Go on the backend, this gives nothing over a
  protobuf pipeline.
- **Edge-only workloads** — Workers / Pages don't run the Node
  process model Titan assumes.
- **You hate decorators** — the DI grammar is decorator-first.
  Alternatives (Hono, Fastify, raw Node) work fine.

## Troubleshooting

### "Cannot resolve token X"

The container couldn't find a provider for token `X`. Causes:

| Cause | Fix |
| ----- | --- |
| Module not imported | Add it to `imports: [...]` of the parent module |
| Provider missing | Add `{provide: TOKEN, useClass: ...}` to `providers: [...]` |
| Circular dependency | Restructure or use `@Optional()` + lazy resolution |
| Two `@omnitron-dev/titan` versions installed | `pnpm why @omnitron-dev/titan` — should report one resolved version |
| Wrong module reference (e.g., importing app `Foo` when service is in `Bar`) | Use `app.resolve(TOKEN)` to introspect, then trace declarations |

### "Container class identity mismatch"

You see this when launching an app under Omnitron's
module-worker mode:

```
The 'Container' class imported by the app's Titan modules is
not the same physical class as the daemon's 'Container'.
```

Cause: the app pinned a different `@omnitron-dev/titan` version
than the daemon, **or** the workspace has parallel
`node_modules` resolving differently.

Fix: `pnpm dedupe`, then `pnpm why @omnitron-dev/titan` — must
return one resolved version. If not, align peer-dependency
ranges across packages.

### App boots, but first request hangs

Likely a heavy service hasn't initialised yet. Eager-load in
`afterCreate`:

```typescript
hooks: {
  afterCreate: async (app) => {
    await app.container.resolveAsync(HEAVY_SERVICE_TOKEN);
    // ... auth wiring ...
  },
}
```

See [Best practices / Eager-loading heavy services](./omnitron/best-practices.md#eager-loading-heavy-services).

### Watcher fires constantly in dev

The file watcher is detecting writes to `dist/` or `node_modules`.

Fix: exclude them in `watch.ignore`:

```typescript
watch: {
  directory: './apps/api',
  ignore:    ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
}
```

Default ignores cover most cases but not project-specific paths
(`.turbo`, `coverage`, `.next`).

### "Daemon already running"

The PID file at `~/.omnitron/daemon.pid` exists and points to a
live PID. Either:

- Daemon is up: `omnitron status` to confirm; use it.
- Stale lock: previous daemon crashed without cleanup. `omnitron
  kill` removes the lock; then `omnitron up`.

### Heartbeat / discovery flapping

Nodes briefly disappear from `omnitron node check`.

Causes:
- `heartbeatInterval` too short (default 5 s is usually fine).
- Network briefly slow (TLS handshake to managed Redis).
- Redis cluster failover.

Fix: bump `heartbeatTTL` to `5 × heartbeatInterval` (default is
3×). See [titan-discovery / TTL tuning](./titan/modules/discovery.mdx#ttl-tuning-guide).

### Build fails with "broken anchor"

Docusaurus markdown links use kebab-cased anchor IDs derived
from headings. If you link to `#someAnchor` but the heading is
`## Some long heading`, the anchor is `#some-long-heading`.

Fix: match the auto-generated slug. Run the build; the warning
shows the resolved path.

### React component re-renders too often

Most common cause: `useQuery` running every render because args
change identity.

```tsx
// BAD — new array every render → cache miss every time
const { data } = users.getUser.useQuery([id, { include: ['profile'] }]);

// GOOD — memoise the args
const args = useMemo(() => [id, { include: ['profile'] }] as const, [id]);
const { data } = users.getUser.useQuery(args);
```

Or extract the options:

```tsx
const opts = useMemo(() => ({ include: ['profile'] }), []);
const { data } = users.getUser.useQuery([id, opts]);
```

### TypeScript "Type X is not assignable to type Y" after server change

Symptom of the win. The contract is the type — when the server
signature changes, every caller must update.

Fix: update the caller. Don't `as any` to silence — that's
exactly the bug end-to-end types are designed to catch.

### "Maximum call stack exceeded" in middleware

Recursive middleware — usually a middleware calling `next()`
that re-enters the same middleware (forgotten guard, infinite
retry).

Fix: cap retries, ensure `next()` is called exactly once per
invocation.

### Webapp shows ChunkLoadError after deploy

Old HTML cached in user's browser tries to fetch deleted JS chunks.

Fix: ship a `clientModule` that catches `ChunkLoadError` and
reloads once per session. The Omnitron webapp does this; copy
the pattern from
`apps/omnitron/webapp/src/clientModules/chunk-error-handler.ts`.

### Redis "ECONNREFUSED" on dev boot

The infrastructure container isn't up. Either:

- `omnitron up` (auto-provisions infra).
- `omnitron infra up` (just infra).
- Check `omnitron infra status` (alias `ps`).

### Database migration locked

Symptom: `MigrationLockError`. Cause: a previous deploy left the
advisory lock held — usually because the migration runner
crashed.

Fix:

```sql
SELECT pg_advisory_unlock_all();
```

Then re-run the migration. Investigate why it crashed before
running again in prod.

### "Health probe times out"

The health endpoint takes longer than `health.timeout`
(default 5 s).

Causes:
- Probe does a real DB query — should use the cached health
  summary.
- One indicator hangs — check `inspect <app>` for the slow
  indicator.

Fix: pre-cache the health result; set per-indicator timeouts.

### "JWT expired" but I just signed in

Clock skew between server and client > `clockTolerance`
(default 5 s).

Fix:
- Sync NTP on both.
- For pathological cases, bump `clockTolerance` to 30 s. Wider
  windows enable replay-after-expiry; don't go above 60 s in
  prod.

### CLI command returns nothing

Use `--json` to see the raw output. Most commands suppress
output if there's nothing to display.

```bash
omnitron --json status
```

### Pull-request fails CI on unrelated test

Check for shared state across tests. Common culprits:
- `vi.useFakeTimers()` not restored — leaks into next test.
- Singleton mock state — `vi.clearAllMocks()` in `beforeEach`.
- DB row left over from a non-rollback test.
- File-system writes outside `tmp/`.

Run failing test in isolation: `vitest run path/to/file.test.ts -t 'test name'`.

## Where to look next

If the question above didn't help:

| Symptom | Page |
| ------- | ---- |
| Module-specific issue | The module's page → "Anti-patterns" section |
| RPC / wire issue | [Netron transports](./frontend/netron/transports.md) + [errors](./frontend/netron/errors.md) |
| Auth issue | [Auth & RBAC](./omnitron/auth-rbac.md) |
| Daemon won't start | [Daemon](./omnitron/daemon.md) |
| Test issue | [Testing](./testing/index.md) |
| Slow / high CPU | [Observability](./omnitron/observability.md) |
| Infrastructure (Postgres/Redis) | [Infrastructure](./omnitron/infrastructure.md) |
| Component renders wrong | [Prism components](./frontend/prism/components.md) |
| Want to contribute a fix | [Contributing](./community/contributing.md) |

## See also

- [Comparison](./comparison.md) — context for "why this stack"
- [Best practices](./omnitron/best-practices.md) — patterns that
  prevent most of the issues above
- [Architecture](./foundations/architecture.md) — how the layers compose
