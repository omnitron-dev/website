---
sidebar_position: 3
title: CLI reference
description: Every command, every flag, every command group.
---

# CLI reference

`omnitron <command>` is the single binary. It is a thin Netron
client — every command opens a connection to `~/.omnitron/daemon.sock`,
makes an RPC call, and exits. The daemon does the real work.

Verified against `src/cli/omnitron.ts` and `src/commands/*`.

## Global options

| Option / Env                              | Effect                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `--json` / `OMNITRON_OUTPUT=json`         | Machine-readable JSON; suppresses spinners and styling |
| `--version`                               | Print CLI version                                      |
| `--help`                                  | Per-command help                                       |

> The `--json` flag is honoured by **every** command. Use it from
> CI / scripts / agent bots so output is parseable.

## Command index

| Group | Commands |
| ----- | -------- |
| **Daemon lifecycle** | `up`, `down`, `ping`, `kill` |
| **Project** | `project add`, `project list`, `project remove`, `project scan` |
| **Stack** | `stack list`, `stack create`, `stack delete`, `stack status`, `stack start`, `stack stop`, `stack runtime` |
| **App lifecycle** | `start`, `stop`, `restart`, `reload` |
| **Information** | `list` (alias `ls`), `status`, `config`, `init` |
| **Monitoring** | `logs`, `monit`, `health`, `metrics`, `health-check`, `discover` |
| **Scaling** | `scale` |
| **Diagnostics** | `inspect`, `exec`, `env` |
| **Remote** | `remote add`, `remote remove`, `remote list`, `remote status` |
| **Fleet** | `fleet status`, `fleet health`, `fleet metrics` |
| **Cluster** | `cluster status`, `cluster step-down` |
| **Secrets** | `secret set`, `secret get`, `secret list`, `secret delete` |
| **Deployment** | `deploy app`, `deploy build`, `rollback` |
| **Infrastructure** | `infra up`, `infra down`, `infra status` (`ps`), `infra logs`, `infra psql`, `infra redis-cli`, `infra migrate`, `infra reset` |
| **Pipelines** | `pipeline list`, `pipeline run`, `pipeline status` |
| **Backup** | `backup create`, `backup list`, `backup restore` |
| **Kubernetes** | `k8s pods`, `k8s deploy scale` |
| **Nodes** | `node list`, `node add`, `node update`, `node remove`, `node check`, `node ssh-keys` |
| **Webapp** | `webapp build`, `webapp start`, `webapp open` |
| **Knowledge base** | `kb mcp`, `kb index`, `kb status`, `kb query` |

## Daemon lifecycle

### `omnitron up`

Start the daemon in the background. Auto-detects
`omnitron.config.ts` at the current working directory or any
ancestor.

| Option                       | Effect                                                |
| ---------------------------- | ----------------------------------------------------- |
| `-c, --config <path>`        | Explicit path to `omnitron.config.ts`                 |
| `-p, --project <name>`       | Initial project name (default: auto-detect from CWD)  |
| `-f, --foreground`           | Block the terminal — useful for `tail -F` style use   |
| `--no-infra`                 | Skip Docker infrastructure provisioning               |
| `--no-watch`                 | Disable file watching for dev stacks                  |
| `--master`                   | First-run: configure as master in a cluster          |
| `--slave [host:port]`        | First-run: configure as slave; optional master address |
| `--webapp` / `--no-webapp`   | Toggle automatic console UI start                     |

### `omnitron down`

Stop the daemon — gracefully stops every project, stack, and
infrastructure container.

### `omnitron ping`

Probe whether the daemon is alive. Exit code `0` = up, non-zero =
down.

### `omnitron kill`

Force-kill the daemon process. Use only when `down` doesn't
respond.

## Project management

A *project* is a named directory containing an
`omnitron.config.ts`. Register many projects to one daemon;
operate on them by name.

| Command | Effect |
| ------- | ------ |
| `omnitron project add <name> <path>` | Register a seed project |
| `omnitron project list` (alias `proj list`) | List registered projects |
| `omnitron project remove <name>` | Unregister (does not delete files) |
| `omnitron project scan` | Auto-discover projects in known paths |

Aliases: `omnitron proj` works the same as `omnitron project`.

## Stack management

A *stack* is a named environment within a project (typical
values: `dev`, `staging`, `prod`). Stacks scope deployments and
infrastructure to a subset of the project's apps.

| Command | Effect |
| ------- | ------ |
| `omnitron stack list` (alias `stacks list`) | All stacks across all projects |
| `omnitron stack create <project> <stack>` | Create a new stack |
| `omnitron stack delete <project> <stack>` | Drop a stack |
| `omnitron stack status <project> <stack>` | Per-app status within the stack |
| `omnitron stack start <project> <stack>` | Start everything in the stack |
| `omnitron stack stop <project> <stack>` | Stop everything in the stack |
| `omnitron stack runtime <project> <stack>` | Show runtime details (containers, ports) |

## App lifecycle

These commands accept an `[app]` argument. With no app, they
operate on **all** managed apps.

| Command | Effect |
| ------- | ------ |
| `omnitron start [app]` | Start app(s); auto-starts the daemon if needed |
| `omnitron stop [app] [-f]` | Graceful stop; `-f`/`--force` to SIGKILL |
| `omnitron restart [app]` | Stop + start |
| `omnitron reload [app]` | Zero-downtime reload — workers cycle one at a time |

## Information

| Command | Effect |
| ------- | ------ |
| `omnitron list` (alias `ls`) | One-line summary per process |
| `omnitron status` | Daemon-wide overview (apps, uptime, leader, infra) |
| `omnitron config [--json]` | Print the resolved ecosystem config |
| `omnitron init` | Scaffold `omnitron.config.ts` in the CWD |

## Monitoring

### `omnitron logs [app]`

Tail logs. Omit `[app]` to read the daemon's own log.

| Option | Effect |
| ------ | ------ |
| `-f, --follow` | Stream new entries |
| `-n, --lines <N>` | Show last N entries (default `50`) |
| `-l, --level <lvl>` | Min level: `trace|debug|info|warn|error|fatal` |
| `-g, --grep <pattern>` | Filter by message regex |
| `--file` | Read from log files (auto-fallback when daemon offline) |

### `omnitron monit`

Live TUI dashboard — terminal app showing per-process CPU /
RSS / restart counts in real time. Quit with `q`.

### `omnitron health [app]`

Composite health report from `titan-health` indicators.

### `omnitron metrics [app]`

Snapshot of current CPU / memory / latency / RPC counters.

### `omnitron health-check [app]`

Detailed composable health report — runs HTTP/TCP probes against
declared endpoints.

### `omnitron discover`

Scan Docker + SSH on known hosts for Omnitron-managed processes
not yet in the registry. Useful when migrating in an existing
fleet.

## Scaling

### `omnitron scale <app> <count>`

Scale an app's worker pool to `<count>` instances. The pool
respects the app's `IProcessEntry.scaling` constraints
(`maxInstances`, `targetCPU`, etc.).

## Diagnostics

### `omnitron inspect <app>`

Deep diagnostics for an app — services exposed, memory
breakdown, pending requests.

| Option | Effect |
| ------ | ------ |
| `--graph` | Render live DI dependency graph instead of memory/services |
| `--format <mermaid|dot|json>` | Graph format (default `mermaid`) |
| `--focus <token>` | Restrict the graph to one token + its closure |
| `--direction <ancestors|descendants|both>` | Closure direction (default `both`) |

### `omnitron exec <app> <service> <method> [args...]`

Invoke an RPC method on a managed app:

```bash
omnitron exec api users findById u_42
```

Arguments are parsed as JSON when they look like JSON, otherwise
strings.

### `omnitron env <app>`

Show resolved environment variables for an app (after merging
project / stack / per-app overrides).

## Remote daemons

Register remote daemons as named aliases and address them via
`omnitron remote <alias>`.

| Command | Effect |
| ------- | ------ |
| `omnitron remote add <alias> <host> [-p port] [-t tags]` | Register a remote (default port `9700`) |
| `omnitron remote remove <alias>` | Unregister |
| `omnitron remote list` | List registered remotes |
| `omnitron remote status <alias>` | Check connectivity |

## Fleet operations

Aggregate across all remotes (and the local daemon).

| Command | Effect |
| ------- | ------ |
| `omnitron fleet status` | Status across the fleet |
| `omnitron fleet health` | Health across the fleet |
| `omnitron fleet metrics` | Aggregated metrics across the fleet |

## Cluster (leader election)

| Command | Effect |
| ------- | ------ |
| `omnitron cluster status` | Current leader, follower list, election term |
| `omnitron cluster step-down` | Force the current leader to step down |

Cluster operations require `cluster.enabled: true` in the
daemon config.

## Secrets (encrypted at rest)

| Command | Effect |
| ------- | ------ |
| `omnitron secret set <key> <value>` | Store an encrypted secret |
| `omnitron secret get <key>` | Read a decrypted secret |
| `omnitron secret list` | List all keys (values hidden) |
| `omnitron secret delete <key>` | Delete a secret |

Backed by `~/.omnitron/secrets.enc` (file provider) or an
external secret manager when configured.

## Deployment

### `omnitron deploy app <app>`

Deploy an app with a strategy.

| Option | Effect |
| ------ | ------ |
| `-s, --strategy <strategy>` | `rolling | all-at-once | blue-green | canary` (default `all-at-once`) |
| `-v, --version <version>` | Version label (git SHA / tag) |
| `-t, --target <server>` | Target server alias or tag |

### `omnitron deploy build <app>`

Build a deployment artifact: a tarball of the app + its
workspace dependencies, suitable for shipping to remote nodes.

### `omnitron rollback <app>`

Rollback an app to its previous deployed version.

| Option | Effect |
| ------ | ------ |
| `-t, --target <server>` | Target server alias or tag |

## Infrastructure

Manage infrastructure containers (Postgres / Redis / MinIO /
custom) provisioned per app's `omnitronConfig.infrastructure`.

| Command | Effect |
| ------- | ------ |
| `omnitron infra up` | Provision and start all infra services |
| `omnitron infra down [--volumes]` | Stop containers; `--volumes` also removes data |
| `omnitron infra status` (alias `infra ps`) | Container status |
| `omnitron infra logs [service] [-f] [-n N]` | View logs for one or all infra services |
| `omnitron infra psql [database]` | Open `psql` shell |
| `omnitron infra redis-cli` | Open `redis-cli` shell |
| `omnitron infra migrate [app]` | Run database migrations |
| `omnitron infra reset [--yes]` | **DESTRUCTIVE** — drop and recreate all data |

## Pipelines (CI/CD)

| Command | Effect |
| ------- | ------ |
| `omnitron pipeline list` | List all pipelines |
| `omnitron pipeline run <id>` | Execute a pipeline by ID |
| `omnitron pipeline status <runId>` | Check a run's status |

## Backups

| Command | Effect |
| ------- | ------ |
| `omnitron backup create [database]` | Create a database backup |
| `omnitron backup list` | List available backups |
| `omnitron backup restore <id>` | Restore from a backup |

## Kubernetes

| Command | Effect |
| ------- | ------ |
| `omnitron k8s pods [namespace]` | List Kubernetes pods |
| `omnitron k8s deploy scale <name> <replicas> [-n namespace]` | Scale a deployment |

## Nodes (infrastructure machines)

Register physical / virtual machines for fleet operations and
remote deploys. Different from `remote daemons` — nodes are SSH
targets that may or may not run a daemon.

| Command | Effect |
| ------- | ------ |
| `omnitron node list` (alias `ls`) | All registered nodes |
| `omnitron node add ...` | Register a node (see flags below) |
| `omnitron node update <id> ...` | Update a node |
| `omnitron node remove <id>` (alias `rm`) | Remove a node |
| `omnitron node check [id]` | Connectivity check (all nodes if omitted) |
| `omnitron node ssh-keys` | List available SSH keys from `~/.ssh/` |

### `omnitron node add` flags

| Flag | Required | Default |
| ---- | -------- | ------- |
| `--name <name>` | yes | — |
| `--host <host>` | yes | — |
| `--ssh-port <port>` | — | `22` |
| `--ssh-user <user>` | — | `root` |
| `--ssh-auth <method>` | — | `key` (or `password`) |
| `--ssh-key <path>` | — | — |
| `--runtime <node|bun>` | — | `node` |
| `--daemon-port <port>` | — | `9700` |
| `--tags <a,b,c>` | — | — |

## Webapp (console UI)

| Command | Effect |
| ------- | ------ |
| `omnitron webapp build` | Build the React + Vite bundle |
| `omnitron webapp start [-f]` | Start nginx container serving static + gateway |
| `omnitron webapp open` | Open the webapp in the system browser |

## Knowledge base (MCP)

| Command | Effect |
| ------- | ------ |
| `omnitron kb mcp` | Start MCP stdio server for AI assistants |
| `omnitron kb index [--full] [--watch]` | Reindex the knowledge base |
| `omnitron kb status` | KB index health and statistics |
| `omnitron kb query <question>` | Test a query against the KB |

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Success |
| `1`  | General failure (RPC error, config error, etc.) |
| `2`  | Daemon not reachable |
| `3`  | Authorization failed |

Combined with `--json` output, this is enough to drive any CI or
agent pipeline.

## Tips

- **`omnitron --json status | jq ...`** — pipe to jq for any
  scriptable check.
- **`omnitron logs my-app -f --grep error`** — narrow follow on a
  hot pattern.
- **`omnitron exec my-app users findById '"u_42"'`** — note the
  quoted JSON string for the arg.
- **`omnitron status` before `up`** — checking what's already
  running prevents accidental double-start.
- **`omnitron --json`** in agent workflows — never parse the
  styled output; it's not stable.

## See also

- [Architecture](./architecture.md) — what each component does
- [Daemon](./daemon.md) — what `up` / `down` actually do
- [Services reference](./services-reference.md) — the RPC surface every
  CLI command targets
- [Console](./console.md) — the GUI equivalent
