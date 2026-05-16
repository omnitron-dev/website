---
sidebar_position: 7
title: Configuration
description: Every field of omnitron.config.ts, defineEcosystem(), defineSystem().
---

# Configuration

Omnitron is driven by two files:

| File | Purpose | Imports |
| ---- | ------- | ------- |
| `omnitron.config.ts` (repo root) | **Ecosystem** — what apps exist, stacks, infrastructure | `defineEcosystem({ ... })` |
| `apps/<name>/src/bootstrap.ts` (per-app) | **System** — what processes the app runs | `defineSystem({ ... })` |

Both files export their result as `default`. The CLI auto-locates
the ecosystem config from CWD upward; the daemon hands each app's
bootstrap to the orchestrator at launch.

Verified against `apps/omnitron/src/config/` (types.ts, define-ecosystem.ts,
define-system.ts, defaults.ts).

## `defineEcosystem(config)` — `omnitron.config.ts`

```typescript
import { defineEcosystem } from '@omnitron-dev/omnitron';

export default defineEcosystem({
  project: 'my-monorepo',
  apps:    [/* IEcosystemAppEntry[] */],
  stacks:  { /* StackName → IStackConfig */ },
  infrastructure: { /* ... */ },
  gateway: { /* ... */ },
  supervision: { /* ... */ },
  monitoring:  { /* ... */ },
  logging:     { /* ... */ },
});
```

### Top-level fields — `IEcosystemConfig`

| Field          | Type                                                       | Required | Default                              |
| -------------- | ---------------------------------------------------------- | :------: | ------------------------------------ |
| `project`      | `string`                                                   |          | —                                    |
| `apps`         | `IEcosystemAppEntry[]`                                     |    ✓     | —                                    |
| `stacks`       | `Record<StackName, IStackConfig>`                          |          | —                                    |
| `infrastructure` | `InfrastructureConfig`                                   |          | —                                    |
| `gateway`      | `{ port?, configDir?, image? }`                            |          | port `8080`, image `openresty/openresty:alpine` |
| `supervision`  | `{ strategy, maxRestarts, window, backoff }`               |    ✓     | one_for_one / 5 / 60 000 ms / expo  |
| `monitoring`   | `{ healthCheck, metrics }`                                 |    ✓     | 15 s / 5 s                           |
| `logging`      | `{ level, maxSize, maxFiles, compress }`                   |    ✓     | info / 50 MB / 10 / true             |

`StackName` is `'dev' | 'test' | 'staging' | 'prod' | string`.

### `IEcosystemAppEntry`

Each entry in `apps[]`:

```typescript
interface IEcosystemAppEntry {
  name:           string;
  bootstrap?:     string;      // bootstrap mode (preferred)
  script?:        string;      // classic mode (legacy)
  enabled?:       boolean;     // default true
  critical?:      boolean;     // daemon shuts down if this crashes past maxRestarts
  dependsOn?:     string[];    // start order
  instances?:     number;
  env?:           Record<string, string>;
  cwd?:           string;      // auto-stamped to project dir
  restartPolicy?: IRestartPolicy;
  startupTimeout?: number;
  watch?:         string | IWatchConfig | false;
}
```

| Field           | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `name`          | Unique app id — used by every CLI command                                 |
| `bootstrap`     | Absolute path to compiled `bootstrap.js` (bootstrap mode)                |
| `script`        | Path to a classic `main.ts` (legacy single-process apps)                 |
| `enabled`       | `false` skips during `startAll`                                          |
| `critical`      | Crashing past `maxRestarts` brings the **daemon** down                   |
| `dependsOn`     | Wait until these apps report healthy before starting this one            |
| `instances`     | Override `defineSystem` process count (overrides app-internal value)     |
| `env`           | App-level env merged over process env                                    |
| `cwd`           | Base for relative paths; auto-stamped to the config's directory          |
| `restartPolicy` | Per-app override of ecosystem `supervision`                              |
| `startupTimeout`| Max ms for ready handshake before treated as failed                     |
| `watch`         | Dev-mode file watching: string=directory; full config; or `false`        |

### `IWatchConfig`

```typescript
interface IWatchConfig {
  directory: string;        // relative to cwd or absolute
  include?:  string[];      // additional directories
  ignore?:   string[];      // glob patterns; merged with defaults
  debounce?: number;        // default 300 ms
}
```

Default ignored patterns include `node_modules`, `dist`, `.git`,
log files, and source maps. Add to `ignore` rather than replace.

### `IStackConfig`

A stack scopes an environment within a project:

```typescript
interface IStackConfig {
  type:               'local' | 'remote' | 'cluster';
  watch?:             boolean;
  nodes?:             IStackNode[];
  infrastructure?:    Partial<InfrastructureConfig>;
  settings?:          IStackSettings;
  apps?:              string[] | 'all';
  portRange?:         { start: number; end: number };
  serviceOverrides?:  Record<string, IServiceOverride>;
}
```

| Field             | Effect                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| `type`            | `local` — single host; `remote` — single remote host; `cluster` — multi-node       |
| `watch`           | Default `true` for `dev`, `false` otherwise                                        |
| `nodes`           | For `remote`/`cluster`: list of `IStackNode` participants                          |
| `infrastructure`  | Per-stack override of ecosystem `infrastructure`                                   |
| `settings`        | Container prefix, port offsets, env, log level                                     |
| `apps`            | `'all'` or explicit list — which ecosystem apps run in this stack                  |
| `portRange`       | Auto-allocate ports for stack services within this window                          |
| `serviceOverrides`| Per-service override of declared infrastructure (point at external host, etc.)     |

### `IStackNode`

```typescript
interface IStackNode {
  host:   string;
  port?:  number;                                  // daemon port; default 9700
  role:   'app' | 'database' | 'cache' | 'gateway' | 'worker' | 'master';
  apps?:  string[];                                // default 'all'
  ssh?:   { user?; privateKey?; port? };
  label?: string;
}
```

Each remote node runs its own omnitron daemon (typically as a
**slave**). The master daemon coordinates state replication via
the `OmnitronSync` service.

### `IStackSettings`

```typescript
interface IStackSettings {
  redisDbOffset?:    number;   // stack gets non-overlapping Redis DB range
  containerPrefix?: string;    // default `${project}-${stack}`
  env?:             Record<string, string>;
  logLevel?:        'fatal'|'error'|'warn'|'info'|'debug'|'trace';
  portOffsets?:     { postgres?, redis?, minio? };
}
```

Port offsets let you run `dev` and `staging` stacks side-by-side
on the same host:

```typescript
stacks: {
  dev:     { type: 'local', settings: { redisDbOffset: 0,  portOffsets: { postgres: 0,  redis: 0,  minio: 0 } } },
  staging: { type: 'local', settings: { redisDbOffset: 5,  portOffsets: { postgres: 10, redis: 10, minio: 10 } } },
}
```

### `supervision` — restart policy

```typescript
supervision: {
  strategy:     'one_for_one' | 'one_for_all' | 'rest_for_one';
  maxRestarts:  number;
  window:       number;            // ms
  backoff:      IBackoffOptions;   // from titan-pm
}
```

| Strategy        | Behaviour                                                          |
| --------------- | ------------------------------------------------------------------ |
| `one_for_one`   | Restart only the crashed app; others continue                      |
| `one_for_all`   | Restart all apps when one crashes (atomic stack restart)           |
| `rest_for_one`  | Restart the crashed app + every app started after it (cascade fix) |

Defaults: `one_for_one` / `5` restarts / `60 000` ms window /
exponential backoff `{ initial: 1 000, max: 30 000, factor: 2 }`.

### `monitoring`

```typescript
monitoring: {
  healthCheck: { interval: 15_000, timeout: 5_000 },
  metrics:     { interval: 5_000,  retention: 3_600 },
}
```

| Field                     | Effect                                          |
| ------------------------- | ----------------------------------------------- |
| `healthCheck.interval`    | How often probes run (default 15 s)             |
| `healthCheck.timeout`     | Per-probe deadline (default 5 s)                |
| `metrics.interval`        | Sample cadence (default 5 s)                    |
| `metrics.retention`       | In-memory ring buffer depth in seconds          |

### `logging`

```typescript
logging: {
  level:    'info',         // fatal | error | warn | info | debug | trace
  maxSize:  '50mb',         // per-app file size threshold
  maxFiles: 10,             // rotated files to keep
  compress: true,           // gzip rotated files
}
```

Per-app overrides live in `IAppDefinition.observability.logging`
(see `defineSystem` below).

### `gateway`

```typescript
gateway: {
  port:      8080,
  configDir: 'infra/nginx',
  image:     'openresty/openresty:alpine',
}
```

When configured, Omnitron provisions an OpenResty/Lua gateway
container per stack — reverse proxy, maintenance mode (driven
from Redis), rate limiting, future PoW captcha.

## `defineSystem(definition)` — per-app `bootstrap.ts`

```typescript
import { defineSystem } from '@omnitron-dev/omnitron';

export default defineSystem({
  name:    'api',
  version: '1.0.0',
  processes: [
    {
      name:   'http',
      module: './modules/http.module.js',
      transports: { http: { port: 3000 } },
      health:     { enabled: true },
    },
    {
      name:   'worker',
      module: './modules/worker.module.js',
      instances: 3,
      scaling: { strategy: 'auto', maxInstances: 10, targetCPU: 70 },
    },
  ],
  observability: { metrics: true, logging: { level: 'info' } },
});
```

### Top-level fields — `IAppDefinition`

| Field            | Type                                                                                                                                | Required |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | :------: |
| `name`           | `string`                                                                                                                            |    ✓     |
| `version`        | `string`                                                                                                                            |    ✓     |
| `processes`      | `IProcessEntry[]` — must contain ≥ 1                                                                                                |    ✓     |
| `requires`       | `IAppRequirements` *(deprecated; use `omnitronConfig.infrastructure` in `config/default.json`)*                                    |          |
| `auth`           | App-level auth manager / JWT config                                                                                                 |          |
| `config`         | `{ sources?, envPrefix? }`                                                                                                          |          |
| `shutdown`       | `{ timeout?, priority?, drainConnections? }`                                                                                       |          |
| `hooks`          | `beforeCreate`, `afterCreate`, `beforeStart`, `afterStart`, `beforeStop`, `afterStop`, `onHealthCheck`                              |          |
| `omnitronConfig` | `OmnitronAppConfig` — declarative infra (database, redis, s3, custom services)                                                      |          |
| `env`            | `Record<string, string>`                                                                                                            |          |
| `cwd`            | `string`                                                                                                                            |          |
| `dev`            | `{ port?, logLevel?, sourceMaps?, env? }` — applied with `omnitron dev`                                                            |          |
| `observability`  | `{ metrics?, tracing?, logging? }`                                                                                                  |          |

### `IProcessEntry` — the heart of `defineSystem`

Each entry becomes exactly one fork (or a pool of N forks when
`instances > 1`).

```typescript
interface IProcessEntry {
  name:            string;
  module:          string;     // path to the @Module file
  critical?:       boolean;
  instances?:      number;     // > 1 = PM pool with load balancing
  topology?:       { expose?: boolean; access?: string[] };
  transports?:     { http?: IHttpTransportConfig; websocket?: IWebSocketTransportConfig };
  auth?:           IAppDefinition['auth'] | false;
  health?:         { enabled?, interval?, timeout?, retries? };
  startupTimeout?: number;     // default 30_000
  scaling?:        { strategy?, maxInstances?, targetCPU?, targetMemory?, queueThreshold?, cooldownPeriod? };
  restartPolicy?:  IRestartPolicy;
  env?:            Record<string, string>;
  customRoutes?:   Array<{ method, pattern, handler }>;
  hooks?:          /* same shape as IAppDefinition.hooks */;
  observability?:  { metrics?, logging? };
}
```

#### Topology — cross-process service mesh

```typescript
processes: [
  // Worker exposes its @Service to other processes:
  { name: 'aggregator', module: './aggregator.module.js',
    topology: { expose: true } },

  // Consumer injects proxies to specific sibling services:
  { name: 'gateway', module: './gateway.module.js',
    topology: { access: ['AggregatorService'] } },
]
```

- `expose: true` — Omnitron auto-discovers `@Service` metadata
  from this process and registers a load-balanced proxy on daemon
  Netron (pool processes only).
- `access: [...]` — list of Netron service names this process
  needs. Bootstrap injects proxies into DI under
  `createToken('topology:{ServiceName}')`.

`access` is a DI convenience, not a security boundary — all
processes managed by omnitron share the daemon's Unix socket.

#### Transports

```typescript
interface IHttpTransportConfig {
  port: number;
  host?: string;
  cors?: any;
  // ...
}

interface IWebSocketTransportConfig {
  port: number;
  host?: string;
  path?: string;
  // ...
}
```

Set `transports.http.port` or `.websocket.port` to expose Netron
on those protocols from this specific process.

#### Scaling (pool mode, `instances > 1`)

```typescript
scaling: {
  strategy:        'auto' | 'fixed',
  maxInstances:    10,
  targetCPU:       70,         // % per instance
  targetMemory:    80,         // % heap
  queueThreshold:  100,        // pending RPC calls before scale-up
  cooldownPeriod:  60_000,
}
```

`auto` strategy uses `titan-pm` autoscaler — the orchestrator
adds / removes workers based on the targets. `fixed` keeps the
declared `instances` count regardless of load.

#### Per-process auth

```typescript
processes: [
  // Inherit app-level auth:
  { name: 'http', module: './http.js' },

  // Override:
  { name: 'metrics', module: './metrics.js', auth: false },  // explicitly no auth
  { name: 'admin',   module: './admin.js',
    auth: { jwt: { enabled: true, tokenCacheTtl: 60 } } },
]
```

`auth: false` explicitly disables; omitted inherits the app's
auth.

### `OmnitronAppConfig` — declarative infrastructure (per-app `config/default.json`)

Lives in `config/default.json` under the `omnitron` key (not in
`bootstrap.ts`):

```json
{
  "omnitron": {
    "database": true,
    "redis":    true,
    "s3":       { "bucket": "uploads", "quota": "10gb" },
    "services": {
      "discovery":     true,
      "notifications": true
    },
    "infrastructure": {
      "search": {
        "type": "daemon",
        "ports": { "http": 9200 },
        "env":   { "SEARCH_URL": "http://${host}:${port:http}" },
        "docker": { "image": "elasticsearch:8.11.0" }
      }
    }
  }
}
```

| Field             | Type                                                          |
| ----------------- | ------------------------------------------------------------- |
| `database`        | `boolean \| { dialect?, pool?, extensions?, dedicated? }`     |
| `redis`           | `boolean \| { prefix?, dedicated? }`                          |
| `s3`              | `boolean \| { bucket?, quota? }`                              |
| `services`        | `{ discovery?, notifications?, ... }`                         |
| `infrastructure`  | `Record<string, IServiceRequirement>` — custom containers     |

Omnitron reads these, provisions missing infrastructure, and
injects resolved env vars (`DATABASE_URL`, `REDIS_URL`,
`SEARCH_URL`) into the app at startup. The app never hardcodes
infrastructure addresses.

→ Full reference: [Infrastructure](./infrastructure.md).

### Dev-mode overrides

```typescript
dev: {
  port:       3001,            // override HTTP port
  logLevel:   'debug',
  sourceMaps: true,
  env:        { NODE_ENV: 'development' },
}
```

Applied only when running via `omnitron dev` or with
`NODE_ENV !== 'production'`. Per-process `dev` is not yet
supported — overrides apply app-wide.

### Lifecycle hooks

App- and process-level `hooks` carry the same shape:

```typescript
hooks: {
  beforeCreate?: () => Promise<void>;
  afterCreate?:  (app: any) => Promise<void>;
  beforeStart?:  (app: any) => Promise<void>;
  afterStart?:   (app: any) => Promise<void>;
  beforeStop?:   (app: any) => Promise<void>;
  afterStop?:    () => Promise<void>;
  onHealthCheck?: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy' }>;
}
```

Process-level hooks override app-level. Use `beforeStart` for
schema sanity checks, `afterStart` for cache priming,
`onHealthCheck` to surface custom checks to the health probe.

### Custom routes

```typescript
processes: [{
  name: 'http',
  module: './http.module.js',
  transports: { http: { port: 3000 } },
  customRoutes: [
    { method: 'GET', pattern: '/healthz',
      handler: async () => new Response('ok', { status: 200 }) },
    { method: 'POST', pattern: '/webhooks/github',
      handler: async (req) => handleGithub(req) },
  ],
}]
```

Custom routes sit alongside the Netron-exposed services on the
same HTTP transport.

## Daemon config — `IDaemonConfig` (not project-config)

The daemon's own config — paths, ports, role, cluster, secrets,
health-monitor — is **not** in `omnitron.config.ts`. Defaults
are baked in (see [Daemon / config defaults](./daemon.md#daemon-configuration)).
Override via CLI flags on `omnitron up` or environment variables.

```typescript
interface IDaemonConfig {
  socketPath:  string;     // ~/.omnitron/daemon.sock
  port:        number;     // TCP, default 9700
  host:        string;     // default 0.0.0.0
  httpPort:    number;     // default 9800
  pidFile:     string;     // ~/.omnitron/daemon.pid
  stateFile:   string;     // ~/.omnitron/state.json
  logDir:      string;     // ~/.omnitron/logs
  role:        'master' | 'slave';
  master?:     { host: string; port: number };
  sync?:       ISyncConfig;
  cluster?:    { enabled, discovery, peers?, electionTimeout?, heartbeatInterval? };
  secrets?:    { provider: 'file'|'env'; path?; passphrase? };
  auth?:       { jwtSecret? };
  healthMonitor?: { intervalMs?, concurrency?, offlineTimeoutMs?, ...retentionDays? };
}
```

## Runtime DTOs (returned by RPC)

These shapes appear in `omnitron status` JSON output and in
webapp data.

### `ProcessInfoDto`

```typescript
interface ProcessInfoDto {
  name:       string;
  pid:        number | null;
  status:     'stopped' | 'starting' | 'online' | 'stopping' | 'errored' | 'crashed';
  cpu:        number;
  memory:     number;
  uptime:     number;
  restarts:   number;
  instances:  number;
  port:       number | null;
  mode:       'classic' | 'bootstrap';
  critical:   boolean;
  processes?: SubProcessInfoDto[];   // bootstrap mode
}
```

### `DaemonStatusDto`

```typescript
interface DaemonStatusDto {
  version:      string;
  pid:          number;
  uptime:       number;
  apps:         ProcessInfoDto[];
  totalCpu:     number;
  totalMemory:  number;
}
```

### `AggregatedMetricsDto`, `AggregatedHealthDto`, `LogEntryDto`, `AppDiagnosticsDto`

Defined in `src/config/types.ts` — refer there for exact field
shapes. The CLI and webapp consume them directly through the
typed `DaemonClient`.

## Validation

`defineSystem()` validates synchronously at module load:

| Check                                         | Throws                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `name` missing or non-string                  | `DefineSystemError`                             |
| `processes` empty                             | `DefineSystemError('At least one process must be defined')` |
| Process without `name`                        | `DefineSystemError('Every process must have a name')` |
| Process without `module`                      | `DefineSystemError('Process X must have a module path')` |
| Duplicate process name                        | `DefineSystemError('Duplicate process name X')` |
| HTTP port not integer 1–65535                 | `DefineSystemError('Process X has invalid HTTP port N')` |
| WebSocket port not integer 1–65535            | `DefineSystemError('Process X has invalid WebSocket port N')` |

Invalid configs fail at `import('bootstrap.js')` — the daemon
surfaces the error and marks the app `errored`.

## Loader behaviour

`loader.ts` auto-detects `omnitron.config.ts` from CWD upward
when the CLI runs. Resolution order:

1. Explicit `--config <path>` on `omnitron up`.
2. `omnitron.config.ts` in CWD.
3. `omnitron.config.ts` walking parents up to the filesystem root.

`cwd` on `IEcosystemAppEntry` is auto-stamped to the directory of
the config that declared the app — relative paths inside the app
entry resolve against the project root, not the daemon's working
directory. Manual override is rarely needed.

## Recommended layout

```text
my-monorepo/
├── omnitron.config.ts            # defineEcosystem({...})
├── apps/
│   ├── api/
│   │   ├── src/bootstrap.ts      # defineSystem({...})
│   │   ├── src/modules/http.module.ts
│   │   ├── src/modules/worker.module.ts
│   │   ├── config/default.json   # OmnitronAppConfig
│   │   └── dist/bootstrap.js     # compiled artefact
│   └── ingest/
│       └── ...
├── infra/
│   └── nginx/                    # gateway configs (referenced by ecosystem.gateway)
└── package.json
```

## Anti-patterns

- **Putting secrets in `omnitron.config.ts`.** The file is
  committed. Use `omnitron secret set` and read via `process.env`
  inside the app.
- **Mixing `bootstrap` and `script` on the same app.** Pick one:
  `bootstrap` for new code, `script` only for legacy classic
  apps.
- **Hardcoding port numbers across stacks.** Use `portOffsets` so
  dev / staging can coexist on one host.
- **`instances > 1` without `topology.expose`.** Pool workers
  are invisible to siblings without `expose`. Either add it or
  drop the pool.
- **`critical: true` everywhere.** Then any crash brings the
  daemon down. Reserve `critical` for the one app whose absence
  truly invalidates the deployment.
- **Hand-editing `config/default.json` to add infrastructure**
  instead of using `OmnitronAppConfig`. The schema is
  validated — declarative is the right path.

## See also

- [Architecture](./architecture.md) — what these configs drive
- [Daemon](./daemon.md) — own config and lifecycle
- [Orchestrator](./orchestrator.md) — what `defineSystem` becomes
  at launch
- [Infrastructure](./infrastructure.md) — `OmnitronAppConfig` deep dive
- [CLI](./cli.md) — commands that read this config
