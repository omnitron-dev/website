---
id: "troubleshooting"
slug: "/docs/troubleshooting"
sidebar_position: 4
title: FAQ + Troubleshooting
description: Common questions and stumbling blocks across the stack.
---

# FAQ + Troubleshooting

The questions and errors that come up most often. Per-module
pages each have an "Anti-patterns" section — this page collects
the cross-cutting ones.

## FAQ {#faq}

### Why decorators? {#why-decorators}

Titan reads service, module and injection declarations from TypeScript decorators. For the published configuration, enable `experimentalDecorators` and `emitDecoratorMetadata` and import `reflect-metadata` before bootstrapping. Explicit tokens identify interfaces at runtime. [Quickstart](./getting-started/quickstart.md) · [Dependency injection](./titan/di/overview.md)

### Why a custom DI container (Nexus)? {#why-a-custom-di-container-nexus}

Nexus manages providers inside Titan. A token identifies what to resolve, a provider describes how to construct it, and the scope controls how long the instance lives. A database pool can live for the application’s lifetime while a request context belongs to one call. [Provider declarations](./titan/di/providers.md) · [Scopes](./titan/di/scopes.md)

### Why MessagePack over JSON for the wire? {#why-messagepack-over-json-for-the-wire}

Netron’s binary protocol uses MessagePack. Both ends must agree on extension types when a value needs more than a plain number, string, object or array. Titan registers codecs for values such as `Date`, `Map` and `BigInt`. Encoded size depends on the actual messages. [Wire types and extension codes](./titan/netron/serialization.md)

### Why one daemon, not per-app sidecars? {#why-one-daemon-not-per-app-sidecars}

Each node exposes one control plane for registered applications. The CLI and Console use Netron to read status and request lifecycle operations. With resident execution, the owner holds application processes and the guardian supervises the backend. This lets a backend replacement preserve running applications. [Illustrated node architecture](./omnitron/architecture.md) · [Backend replacement](./omnitron/backend-handoff.md)

### Why monorepo? {#why-monorepo}

The workspace lets maintainers change a service contract, its client and their tests together. Applications in separate repositories can publish their shared types as a package. Either layout still needs a compatibility plan when the client and server deploy independently. [Workspace layout](./foundations/monorepo.md)

### Is Titan production-ready? {#is-titan-production-ready}

Evaluate the paths your application depends on. Exercise startup, graceful shutdown, failed dependencies, migrations and recovery under representative load. The readiness guide lists the checks, and the compatibility page identifies supported runtimes. [Production readiness](./deployment/production-readiness.md) · [Compatibility](./reference/compatibility.md)

### Why isn't there X module? {#why-isnt-there-x-module}

The [module map](./titan/modules/module-map.mdx) lists the published integrations and their responsibilities. For an application-specific capability, declare its providers, dependencies and lifecycle as a Titan module. [Author a module](./titan/modules-system/authoring-modules.md)

### Can I use Bun or Deno? {#can-i-use-bun-or-deno}

The Omnitron daemon runs on Node.js. Some library packages also test selected APIs on Bun and Deno. Check the package and runtime pair your application imports. [Cross-runtime coverage](./testing/cross-runtime.md) · [Compatibility](./reference/compatibility.md)

### How does pricing / licensing work? {#how-does-pricing--licensing-work}

The public Omnitron repository is MIT-licensed. Its license grants the terms for using and distributing the code. Hosting, domains and any external services you enable are separate costs. [License](https://github.com/omnitron-dev/omni/blob/v0.4.17/LICENSE)

### When should I NOT use this stack? {#when-should-i-not-use-this-stack}

Choose the packages your project needs. Lumen can publish a static site to an ordinary web host. Xec can run a single automation independently. A browser can call Netron through `netron-browser` without React. The supervisor is relevant when you want a persistent control plane for processes and infrastructure. [Lumen use cases](./lumen/use-cases.md) · [Project starters](./omnitron/projects.md#choose-a-project) · [Compatibility](./reference/compatibility.md)

## Troubleshooting {#troubleshooting}

### "Cannot resolve token X" {#cannot-resolve-token-x}

The container couldn't find a provider for token `X`. Causes:

| Cause | Fix |
| ----- | --- |
| Module not imported | Add it to `imports: [...]` of the parent module |
| Provider missing | Add `{provide: TOKEN, useClass: ...}` to `providers: [...]` |
| Circular dependency | Inspect the dependency path and extract the shared provider or introduce an explicit boundary |
| Two `@omnitron-dev/titan` versions installed | `pnpm why @omnitron-dev/titan` — should report one resolved version |
| Wrong module reference (e.g., importing app `Foo` when service is in `Bar`) | Use `app.resolve(TOKEN)` to introspect, then trace declarations |

### "Container class identity mismatch" {#container-class-identity-mismatch}

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

### App boots, but first request hangs {#app-boots-but-first-request-hangs}

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

### Watcher fires constantly in dev {#watcher-fires-constantly-in-dev}

First identify the watcher. Bootstrap applications use esbuild's import graph;
command-based applications use the filesystem watcher. Test files, dependencies
and generated output directories are ignored by the filesystem watcher by
default, including `node_modules`, `dist`, `.turbo`, `coverage` and `.next`.

Additional ignores are **path segments**, not glob expressions:

```typescript
watch: {
  directory: './apps/api',
  ignore: ['generated-assets'],
}
```

Do not use `**/dist/**`: it is not a matching segment. Inspect the changed path in
the log and remove a redundant watcher rather than watching generated output
from a bootstrap application's external packages. See
[shared workspace development](./omnitron/recipes.md#12-dev-hot-reload-with-shared-workspace-deps).

### Source workspace package fails while reading a bootstrap definition {#source-workspace-package-fails-while-reading-a-bootstrap-definition}

If a source-exporting package imports a sibling `.js` module that exists only as
TypeScript, plain Node loading is insufficient. The definition reader must
compile that workspace graph with the same policy as the application bundler.
Decorators and parameter properties also require compilation; merely changing
an import extension does not resolve that contract.

Check the active owner as well as the backend with `omnitron backend status`.
A backend handoff preserves the owner's loaded code. Verify the development
source path against the exact owner runtime before starting workloads; keep any
required owner replacement behind a concrete pause and rollback plan. Do not
copy JavaScript files into source directories or substitute a fixed release while
claiming that backend source watching is enabled.

### "Daemon already running" {#daemon-already-running}

Run `omnitron backend status` and `omnitron status` to identify the serving backend, its owner and the running applications. A process identifier alone cannot establish ownership after a restart. For an interrupted runtime update, inspect the saved plan with `omnitron runtime update status`; its receipt identifies the supported recovery action. [Daemon lifecycle](./omnitron/daemon.md) · [Runtime updates](./omnitron/cli.md#local-runtime-updates)

### Heartbeat / discovery flapping {#heartbeat--discovery-flapping}

Identify the layer that reported the loss. `omnitron node check` tests the registered node connection. An application using Titan Discovery maintains its own heartbeat and TTL in its registry. Compare actual heartbeat gaps, registry latency and the configured TTL before changing its thresholds. [Discovery TTL tuning](./titan/modules/discovery.mdx#ttl-tuning-guide)

### Build fails with "broken anchor" {#build-fails-with-broken-anchor}

Lumen Markdown links use heading anchor IDs derived
from headings. If you link to `#someAnchor` but the heading is
`## Some long heading`, the anchor is `#some-long-heading`.

Fix: match the auto-generated slug. Run the build; the warning
shows the resolved path.

### React component re-renders too often {#react-component-re-renders-too-often}

First distinguish a React render from a network request using the browser’s Network panel. Netron React derives the cache key from the service, method and serialized arguments. A newly allocated array containing the same values can still identify the same query.

If a request repeats, check the key, component remounts, `staleTime`, invalidation and refetch settings. If the key and request count are stable, use the React profiler to find the state or parent render that changed. [Query cache and refetch options](./frontend/netron/caching.md#cache-key)

### TypeScript "Type X is not assignable to type Y" after server change {#typescript-type-x-is-not-assignable-to-type-y-after-server-change}

Compare the caller’s arguments and return type with the new service declaration. Update the consumer and its tests against the intended contract. If clients and servers deploy separately, introduce a compatible transition before requiring the new shape. [Service contracts](./titan/netron/services.md)

### "Maximum call stack exceeded" in middleware {#maximum-call-stack-exceeded-in-middleware}

Recursive middleware — usually a middleware calling `next()`
that re-enters the same middleware (forgotten guard, infinite
retry).

Fix: cap retries, ensure `next()` is called exactly once per
invocation.

### Webapp shows ChunkLoadError after deploy {#webapp-shows-chunkloaderror-after-deploy}

Old HTML cached in user's browser tries to fetch deleted JS chunks.

Fix: catch `ChunkLoadError` in the app shell (e.g. a global
`error`/`unhandledrejection` listener or a React error boundary)
and reload the page once per session so the browser fetches the
new HTML and chunk manifest.

### Redis "ECONNREFUSED" on dev boot {#redis-econnrefused-on-dev-boot}

The infrastructure container isn't up. Either:

- `omnitron up` (auto-provisions infra).
- `omnitron infra up` (just infra).
- Check `omnitron infra status` (alias `ps`).

### Database migration locked {#database-migration-locked}

The runner could not acquire its migration lock. Check the deployment already in progress and inspect migration status for the same database. In PostgreSQL, `pg_locks` identifies advisory lock holders and `pg_stat_activity` identifies their sessions. Session-level advisory locks are released when the holding connection ends. `pg_advisory_unlock_all()` affects only the session that calls it.

Let the active migration finish or use the owning deployment’s recovery procedure. Once the holder has finished, verify migration history and checksums before retrying. [Omnitron migrations](./omnitron/migrations.md) · [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)

### "Health probe times out" {#health-probe-times-out}

The health endpoint takes longer than `health.timeout`
(default 5 s).

Causes:
- Probe does a real DB query — should use the cached health
  summary.
- One indicator hangs — run `omnitron health-check <app>` for the
  detailed per-probe report and find the slow indicator.

Fix: pre-cache the health result; set per-indicator timeouts.

### "JWT expired" but I just signed in {#jwt-expired-but-i-just-signed-in}

Check the verifier’s time against the issuing service and compare the token’s expiry and start-of-validity claims with the configured skew tolerance. Keep the token in the application’s trusted tools. Correct clock drift first, then review access-token lifetime and refresh handling. [Token issuance and rotation](./auth/token-issuance.md)

### CLI command returns nothing {#cli-command-returns-nothing}

Use `--json` to see the raw output. Most commands suppress
output if there's nothing to display.

```bash
omnitron --json status
```

### Pull-request fails CI on unrelated test {#pull-request-fails-ci-on-unrelated-test}

Check for shared state across tests. Common culprits:
- `vi.useFakeTimers()` not restored — leaks into next test.
- Singleton mock state — `vi.clearAllMocks()` in `beforeEach`.
- DB row left over from a non-rollback test.
- File-system writes outside `tmp/`.

Run failing test in isolation: `vitest run path/to/file.test.ts -t 'test name'`.

## Where to look next {#where-to-look-next}

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

## See also {#see-also}

- [Comparison](./comparison.md) — context for "why this stack"
- [Best practices](./omnitron/best-practices.md) — patterns that
  prevent most of the issues above
- [Architecture](./foundations/architecture.md) — how the layers compose
