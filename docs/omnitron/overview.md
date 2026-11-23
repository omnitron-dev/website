---
id: "omnitron/overview"
slug: "/docs/omnitron/overview"
sidebar_position: 1
title: Operations overview
description: Use the supervisor to run projects, manage nodes, automate work and recover applications on infrastructure you control.
---

# Operating with Omnitron

Omnitron’s supervisor manages projects, processes, releases and infrastructure on machines you control. Its CLI, Console and agent integrations use the same control plane. A Titan application can also run directly under Node.js. [Runtime and supervisor responsibilities](../foundations/titan-vs-omnitron.md)

In resident mode, backend, owner and guardian have separate jobs. The
[illustrated architecture](./architecture.md) follows a command through them,
explains Console's execution fields and shows how nodes form a private fleet.
The [ownership guide](../foundations/privacy.md) describes data boundaries.

```bash
pnpm add -g @omnitron-dev/omnitron
omnitron up                          # start daemon + all configured apps
omnitron status                      # see what's running
omnitron logs --grep error           # tail filtered logs
omnitron webapp open                 # open the web console
```

## What you get {#what-you-get}

| Layer | Responsibility |
| ----- | -------------- |
| **CLI** | One `omnitron` entry point for applications, stacks, deployments, infrastructure, diagnostics and backend updates. |
| **Daemon** | Typed Netron control plane with durable local state. Coupled mode owns applications directly; resident mode keeps them in an independent owner. |
| **Orchestrator** | Per-app launch pipeline: TS compile / module load / fork process / wire DI / start lifecycle / watch files in dev |
| **Process tree** | One OS process per `IProcessEntry` you declare; ≥ 1 instances per process; auto-restart with exponential backoff |
| **Services** | Role-protected daemon RPC for authentication, deployment, fleet inventory, secrets, infrastructure and diagnostics. Availability depends on daemon role. |
| **Agent Studio** | Connect adapters to a project room, assign work and retain shared notes. [Work with a team](./studio.md#team-room) |
| **Flows** | Preview events, review a graph revision and inspect its deliveries. [Build a disk-space monitor](./flows.md#disk-space) |
| **Webapp** | React + Vite single-page console — same RPC surface; lives at `apps/omnitron/webapp/` |
| **Infrastructure** | Provisions Postgres / Redis / S3-compatible / custom containers via Docker (dev) or bare-metal hooks (prod) |
| **MCP** | Built-in Model Context Protocol surface — let agents (IDE assistants, CI bots) read state and trigger operations |

## When you reach for Omnitron {#when-you-reach-for-omnitron}

- **Run a project.** Register a repository, choose its applications and declare a stack for each environment. [Projects and stacks](./projects.md)
- **Manage a node or a fleet.** Follow a lifecycle command through the backend and owner, then inspect the host that actually ran it. [Node architecture](./architecture.md)
- **Delegate or automate work.** Give a project team a bounded task in [Studio](./studio.md#team-room), or connect a host event to an explicitly reviewed [flow](./flows.md).
- **Investigate a failure.** Check application health, runtime observations and the last recorded operation. [Operational diagnostics](./diagnostics.md)

## The mental model {#the-mental-model}

```mermaid
flowchart TB
  CLI["CLI"] -->|Unix socket| RPC
  Console["Console"] -->|Netron over HTTP / WebSocket| RPC
  Agent["Agent via MCP"] -->|MCP adapter and local RPC| RPC

  subgraph Instance["Omnitron instance (one per node)"]
    RPC["Backend: Netron RPC services"]
    State[("SQLite state and registries")]
    Guardian["Resident backend guardian"]
    Owner["Application owner"]
    RPC --> State
    Guardian -->|Supervise backend| RPC
    RPC -->|Lifecycle commands| Owner
  end

  Owner -->|Supervise| AppA["Application: API"]
  Owner -->|Supervise| AppB["Application: ingestion"]
  RPC -->|Provision declared resources| Infra
  subgraph Infra["Infrastructure (Docker / bare-metal)"]
    PG[("PostgreSQL")]
    Redis[("Redis")]
    S3[("S3-compatible storage")]
  end
  AppA -. Uses .-> PG
  AppA -. Uses .-> Redis
  AppB -. Uses .-> PG
  AppB -. Uses .-> S3
```

The diagram shows **resident mode**: the owner retains applications while the
guardian replaces the backend. In default coupled mode, the backend also owns
the application lifecycle. Moving from coupled to resident mode requires an
initial application restart; later compatible backend handoffs can preserve
those processes. See [backend replacement](./backend-handoff.md).

Ordinary CLI invocations are short-lived RPC clients. Follow and watch commands
keep their connection or polling loop for as long as the operator needs it.

## Filesystem layout {#filesystem-layout}

By default, Omnitron stores its control-plane files in `~/.omnitron/`.
`OMNITRON_HOME` selects another instance directory. This is a selected layout:

:::filetree{title="~/.omnitron/"}
- `daemon.sock` — Private management socket
- `daemon.pid` — Backend process identity
- `data/`
  - `daemon-state.db` — Registries, execution intent and persisted state
  - `application-logs.sqlite` — Application log delivery journal
  - `backend-logs.sqlite` — Backend log delivery journal
- `runtime/`
  - `releases/` — Verified, installed backend runtimes
- `execution/` — Resident owner and guardian control files
- `secrets.enc` — Encrypted file-provider secrets
- `logs/`
  - `omnitron.log` — Backend log
  - `omnitron.error.log` — Backend errors
- `projects/` — Project and stack state, including application log archives
- `backups/` — Database dumps and captured resource archives
:::

The current state store is SQLite; `state.json` is only an import source for
older installations. Backups use `backups/` under the selected `OMNITRON_HOME`;
there is no separate backup-directory setting. Project builds, container volumes
and native service definitions have their own locations. The
[observability guide](./observability.md#putting-it-together--what-the-daemon-stores)
distinguishes query storage from delivery journals and log archives.

## Default endpoints {#default-endpoints}

| Plane | Endpoint | Purpose |
| ----- | -------- | ------- |
| Management | `unix://~/.omnitron/daemon.sock` (mode `0o600`, owner-only) | CLI ↔ daemon — `OmnitronDaemon` service + the rest of the built-in services |
| TCP | `tcp://127.0.0.1:9700` by default | Authenticated daemon RPC; configure the bind address for remote access |
| Console | `http://localhost:9800` by default | Browser interface; publication and backend endpoints follow the configured gateway |

The Unix socket is the **trust boundary** — owner-only file
permissions make local CLI calls implicit-auth. TCP and HTTP
require JWT.

## A minimal `omnitron.config.ts` {#a-minimal-omnitronconfigts}

The single configuration file at the repo root:

```typescript
import { defineEcosystem } from '@omnitron-dev/omnitron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineEcosystem({
  apps: [
    {
      name:        'api',
      bootstrap:   path.join(__dirname, 'apps/api/dist/bootstrap.js'),
      cwd:         path.join(__dirname, 'apps/api'),
      env:         { NODE_ENV: 'production' },
    },
    {
      name:        'worker',
      bootstrap:   path.join(__dirname, 'apps/worker/dist/bootstrap.js'),
      cwd:         path.join(__dirname, 'apps/worker'),
    },
  ],
  supervision: {
    strategy: 'one_for_one',
    maxRestarts: 5,
    window: 60_000,
    backoff: { type: 'exponential', initial: 1_000, max: 30_000, factor: 2 },
  },
});
```

Each app's `bootstrap.ts` exports a `defineSystem(...)` that
declares the **processes** (one OS process per `IProcessEntry`).

## How an app launches {#how-an-app-launches}

```mermaid
sequenceDiagram
  participant Op as Operator (CLI)
  participant D  as Daemon
  participant Orch as Orchestrator
  participant Boot as bootstrap.js
  participant Child as Child process

  Op->>D: start api
  D->>Orch: launch(app: 'api')
  Orch->>Orch: locate bootstrap.js
  Orch->>Boot: import('bootstrap.js')
  Boot-->>Orch: defineSystem({processes: [...]})
  loop per process
    Orch->>Child: fork(module-worker-process.js)
    Child->>Child: Application.create(module)
    Child->>Child: onInit → onStart
    Child-->>Orch: ready handshake
  end
  Orch-->>D: ProcessInfoDto
  D-->>Op: { status: 'running', pid: 1234, ... }
```

Each `IProcessEntry` declared in `defineSystem(...)` becomes
exactly one fork (or a pool when `instances > 1`). The child
imports **only** that module's file — no full bootstrap re-load —
so dependencies stay process-isolated.

## Multi-project / multi-stack {#multi-project--multi-stack}

A **project** owns one or more **stacks**. Each stack selects application
configuration, infrastructure and placement for an environment:

| Project | Stack | Applications |
| --- | --- | --- |
| `monorepo-A` | `dev` | `api`, `worker` |
| `monorepo-A` | `staging` | `api`, `worker`, `batch` |
| `monorepo-A` | `prod` | `api`, `worker`, `batch`, `scheduler` |
| `monorepo-B` | `prod` | `gateway`, `events` |

Stack-aware commands (`omnitron stack status <project> <stack>`)
operate on that stack. Environments can share a node or target different
nodes; they remain configurations of the same project. See
[projects and stacks](./projects.md) for placement and lifecycle commands.

## Built-in observability {#built-in-observability}

The supervisor captures process state and output. Additional signals depend on
application instrumentation and configured collectors:

| Signal | Where |
| ------ | ----- |
| Application output and structured logs | Durable capture and rotated per-application files; see [logs](./observability.md#logs) |
| Per-process metrics | aggregated by daemon, exposed via RPC + Prometheus text |
| Health probes | Application-provided checks and declared readiness probes |
| Crash tracking | Restart count, last error, backoff state |
| Distributed traces | Configured application tracing and collectors |

Both the CLI and webapp read these through the daemon — there's no
separate metrics agent to deploy.

## Webapp (Omnitron Console) {#webapp-omnitron-console}

The console is a React + Vite + MUI SPA that lives at
`apps/omnitron/webapp/` and talks to the daemon via the
`@omnitron-dev/netron-react` integration and browser client. It gives you:

- Project + stack view with per-app status cards
- Live log streams with filtering
- Metric charts (CPU / RSS / event-loop lag / RPC latency)
- Health probes and restart history
- Infrastructure inventory (Docker containers)
- Secret editor (against the daemon's encrypted store)
- Fleet view across remote daemons

The published package includes Console assets. `omnitron webapp start`
reconciles the serving gateway; `omnitron webapp open` opens the configured
address. `omnitron webapp build` is for a source checkout. For development, run `pnpm dev` in `apps/omnitron/webapp/`
for a Vite dev server with HMR.

→ Full webapp reference: [console](./console.md).

## Compatibility {#compatibility}

| Component | Requirement |
| --------- | ----------- |
| Node.js | Use a supported runtime from the [compatibility reference](../reference/compatibility.md); native dependencies are qualified for the target Node and OS |
| OS | macOS, Linux. Windows works for CLI + non-supervisor commands; daemon assumes Unix sockets |
| Docker | Required for `infra` commands (provisioning Postgres / Redis / etc.) |
| Bun / Deno | Apps may run on Bun/Deno individually, but the daemon expects Node |

## Where to go next {#where-to-go-next}

- **Architecture deep-dive:** [Architecture](./architecture.md) —
  every component, every plane, every data flow.
- **CLI reference:** [CLI](./cli.md) — every command, every flag.
- **Daemon internals:** [Daemon](./daemon.md) — PID, state-store,
  scheduler, lifecycle.
- **Orchestrator:** [Orchestrator](./orchestrator.md) —
  bootstrap, file watcher, dependency resolver.
- **RPC services:** [Services reference](./services-reference.md) —
  all built-in services and their methods.
- **Console UI:** [Console](./console.md).
