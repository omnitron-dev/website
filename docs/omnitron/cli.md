---
sidebar_position: 3
title: CLI reference
description: Every command, every flag, every command group.
---

# CLI reference

`omnitron <command>` is the single binary. Management commands use Netron RPC
through `~/.omnitron/daemon.sock`. Local build, configuration and migration
commands execute in the CLI process; application migrations can run without a
running daemon.

Verified against `src/cli/omnitron.ts` and `src/commands/*`.

## Global options

| Option / Env                              | Effect                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `--json` / `OMNITRON_OUTPUT=json`         | Machine-readable JSON; suppresses spinners and styling |
| `--version`                               | Print CLI version                                      |
| `--help`                                  | Per-command help                                       |

Commands that support `--json` return a structured result. A command without
machine-readable output rejects the flag with a structured error and a nonzero
exit code; do not parse its human-readable table. Finite commands drain stdout
and stderr before exiting, so large log exports remain complete when piped
into another process. Check both the JSON result and the exit status.

## Command index

| Group | Commands |
| ----- | -------- |
| **Daemon lifecycle** | `up`, `down`, `ping`, `kill` |
| **Backend installation and replacement** | `backend status`, `backend install`, `backend installation`, `backend select`, `backend upgrade`, `backend abort`, `backend recover` |
| **Project** | `project add`, `project list`, `project remove`, `project scan`, `project topology` |
| **Stack** | `stack list`, `stack create`, `stack delete`, `stack status`, `stack start`, `stack stop`, `stack runtime` |
| **App lifecycle** | `start`, `stop`, `restart`, `reload` |
| **Information** | `list` (alias `ls`), `status`, `config`, `init` |
| **Monitoring** | `logs`, `monit`, `health`, `metrics`, `health-check`, `discover` |
| **Scaling** | `scale` |
| **Diagnostics** | `doctor`, `inspect`, `exec`, `env` |
| **Database schema** | `migrate status`, `migrate verify`, `migrate up`, `migrate down` |
| **Remote** | `remote add`, `remote remove`, `remote list`, `remote status` |
| **Fleet** | `fleet status`, `fleet health`, `fleet metrics` |
| **Cluster** | `cluster status`, `cluster step-down` |
| **Secrets** | `secret set`, `secret get`, `secret list`, `secret delete` |
| **Deployment** | `deploy app`, `deploy build`, `rollback` |
| **Infrastructure** | `infra up`, `infra down`, `infra status` (`ps`), `infra logs`, `infra psql`, `infra redis-cli`, `infra migrate`, `infra reset` |
| **Pipelines** | `pipeline list`, `pipeline save`, `pipeline run`, `pipeline status`, `pipeline cancel` |
| **Backup** | `backup create`, `backup list`, `backup restore` |
| **Kubernetes** | `k8s pods`, `k8s deploy scale` |
| **Nodes** | `node list`, `node add`, `node update`, `node remove`, `node check`, `node reconcile`, `node ssh-keys` |
| **Access** | `access show`, `access users`, `access create`, `access role`, `access revoke` |
| **SSH** | `node ssh-key`, `node ssh`, `terminal list`, `terminal close` |
| **Webapp** | `webapp build`, `webapp start`, `webapp stop`, `webapp status`, `webapp open` |
| **Tor** | `tor` |
| **Knowledge base** | `kb mcp`, `kb index`, `kb status`, `kb query` |

## Database migrations

`omnitron migrate [status|verify|up|down]` uses `omnitron.migrations.ts` by
default. `--config` selects a configuration; `--daemon` explicitly selects the
daemon database. `up --dry-run` previews, `up --to NAME` selects a prefix, and
`down --steps N` rolls back a suffix. `verify` exits with 2 when integrity is
unknown or mismatched. See [migration configuration and recovery](./migrations.md).

## Backend replacement

`backend status --json` reports whether the running daemon supports resident
execution. `backend upgrade <sealed-dist> --check` validates a candidate and
rollback artifact. Without `--check` it replaces only a resident-mode backend.
`backend abort <checkpoint>` cancels preparation before retirement;
`backend recover <checkpoint>` refuses to preempt an unrelated live backend; it can reconcile a verified successor when startup-selection publication was interrupted.

`omnitron backend install <sealed-runtime>` copies a verified release into permanent storage without activation. `omnitron backend installation --json` reports its startup selection and unfinished activation. `omnitron backend select <sha256>` selects an installed release only while the backend and execution owner are stopped. Running installations use `backend upgrade`; it commits the selection after readiness and preserves the rollback. The stable launcher is `$OMNITRON_HOME/runtime/bin/omnitron`.

For independent user services, `omnitron backend guardian prepare <sealed-runtime>` records a private transition plan. `omnitron backend guardian apply <plan>` applies or resumes it while retaining the execution owner and application processes. The existing backend release is restored under the updated guardian.

`omnitron backend schema prepare <sealed-runtime>` reads the master database and saves a plan for explicitly reviewed compatible additions. `omnitron backend schema apply <plan>` applies or resumes it under the shared migration lock. `omnitron backend upgrade <sealed-dist> --schema-plan <plan>` requires that exact applied plan for an upgrade or rollback between its two sealed releases. Legacy bridges, changed definitions, foreign databases and local node schema transitions are refused.

See [requirements, first transition and recovery](./backend-handoff.md).

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
| `--no-watch`                 | Disable file watching daemon-wide                     |
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

### `omnitron service install|uninstall|status`

Hand supervision of the daemon itself to the operating system.
Omnitron supervises apps and infrastructure; without this, nothing
supervises the daemon, so a daemon crash — disk full, a load spike,
a container-runtime hiccup — leaves every managed app down until
someone runs `omnitron up` by hand.

| Command | Effect |
| ------- | ------ |
| `omnitron service install` | Register OS supervision; resident mode requires a stopped backend and owner |
| `omnitron service install --prepare` | Prepare independent owner/backend service definitions without stopping processes |
| `omnitron service uninstall` | Stop the supervised daemon and remove the service |
| `omnitron service status` | Whether the OS is supervising, and what it reports |

| Platform | What is written |
| -------- | --------------- |
| macOS | LaunchAgent at `~/Library/LaunchAgents/dev.omnitron.daemon.plist` |
| Linux | systemd user unit at `~/.config/systemd/user/omnitron-daemon.service` |

**Restarts are crash-only**, so `up` and `down` keep meaning what
they meant. A graceful `omnitron down` exits 0 and stays down; a
crash or a `SIGKILL` exits abnormally and is respawned
(`KeepAlive={SuccessfulExit:false}` on launchd, `Restart=on-failure`
on systemd). Installing the service does not take `down` away from
you.

In coupled mode, the supervisor runs the same `daemon-entry.js` that `omnitron up`
forks — one daemon codepath with two launchers — and that entry
point holds a single-instance pid guard, so the two can never both
bind.

## Project management

A *project* is a named directory containing an
`omnitron.config.ts`. Register many projects to one daemon;
operate on them by name.

| Command | Effect |
| ------- | ------ |
| `omnitron project add <name> <path>` | Register a seed project |
| `omnitron project topology` (optional project, `--stack <name>`) | Configured dependencies and coverage warnings; supports global `--json` |
| `omnitron project list` (alias `proj list`) | List registered projects |
| `omnitron project remove <name>` | Unregister (does not delete files) |
| `omnitron project scan` | Scan app bootstraps and report their infrastructure requirements |

Aliases: `omnitron proj` works the same as `omnitron project`.

## Stack management

A *stack* is a named environment within a project (typical
values: `dev`, `staging`, `prod`). Stacks scope deployments and
infrastructure to a subset of the project's apps.

| Command | Effect |
| ------- | ------ |
| `omnitron stack list [-p project]` (alias `stacks list`) | All stacks across all projects (filter with `-p, --project`) |
| `omnitron stack create <project> <stack> [-t type] [-a apps]` | Create a new stack (`-t, --type local\|remote\|cluster`, default `local`; `-a, --apps` comma-separated names or `all`, default `all`) |
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
| `omnitron list` (alias `ls`) | One row per app, then one per topology process |
| `omnitron status` | Daemon-wide overview (apps, uptime, leader, infra) |
| `omnitron config [--json]` | Print the resolved ecosystem config |
| `omnitron init` | Scaffold `omnitron.config.ts` in the CWD |

**Reading the child rows of `omnitron list`.** Each indented row is
one entry of the app's process topology, and two of its columns say
something a single number cannot.

A pool entry — one declaring `instances > 1` — runs several
processes and the row prints one of their pids, so it also prints
its live worker count: `transform (worker) ×2`. When that count has
drifted from what the topology declares it is shown as `×1/2` in
yellow; `doctor` reports the same drift as a finding.

`RST` shows `-`, not `0`, when nothing counts that row's restarts.
The supervisor keeps a restart count per child, and a pool is not a
supervisor child, so for a pool row the honest answer is that it is
not tracked. `0` would leave "never restarted" and "not counted"
looking identical.

`UPTIME` is the uptime of the process whose pid the row prints —
not the app's. A child that restarted an hour ago under an app that
has been up for a week reads one hour.

## Monitoring

Resident mode uses independent owner and backend guardian services. See [backend replacement](./backend-handoff.md#independent-os-supervision) for preparation, crash recovery, system scope and owner-failure boundaries.

### `omnitron logs [app]`

Tail logs. Omit `[app]` to read the daemon's own log.

| Option | Effect |
| ------ | ------ |
| `-f, --follow` | Stream new entries |
| `-n, --lines <N>` | Show last N entries (default `50`) |
| `-l, --level <lvl>` | Min level: `trace|debug|info|warn|error|fatal` |
| `-g, --grep <pattern>` | Filter by message regex |
| `--file` | Read from log files (auto-fallback when daemon offline) |
| `--node <name-or-id>` | Read replicated records from one registered remote node; never falls back to local files |

Use the full application handle for production diagnostics:

```bash
omnitron logs sample/production/mail --node worker-1 -n 100
omnitron --json logs sample/production/api --node worker-1 --grep 'auth\.login'
```

`--node` resolves a node name or unique ID prefix through the registry and uses
the same `OmnitronLogs.streamLogs` contract as Console. `--node` and `--file`
are mutually exclusive. Omit `--node` for the local machine. JSON output records
the source and node; an empty result does not establish that no request occurred.

### `omnitron monit`

Live TUI dashboard — terminal app showing per-process CPU /
RSS / restart counts in real time. Quit with `q`.

### `omnitron health [app]`

Composite health report from `titan-health` indicators.

### `omnitron metrics [app]`

Snapshot of current CPU / memory / latency / RPC counters.

### `omnitron health-check [app]`

Checks application-reported health, declared readiness and HTTP/TCP availability.
A live process or HTTP 200 cannot override a failed application check. Without an
app name, includes every local application and declared stack infrastructure.

Use `omnitron --json health-check [app]` for the same structured report. Both
human and JSON modes exit with status 1 when any check is degraded or unhealthy;
JSON output retains the individual checks and their reasons.

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

### `omnitron doctor`

One pass over the whole installation, reporting problems with the
evidence that identifies them and the command that fixes them.

It reads the database directly rather than through the daemon,
because a daemon whose schema has gone missing still answers RPCs
perfectly well.

**What it examines.** Every finding's `id` begins with the area it
came from, so this table is the same list the output uses:

| Area | What it looks at |
| ---- | ---------------- |
| `daemon` | Whether it answers, how fast, whether it restarted recently, whether it is aggregating metrics |
| `app` | Managed apps and their sub-processes, and the ports they claim against the ports they answer on |
| `infra` | Infrastructure containers, their health, their published ports, and containers detached from the stack |
| `db` | Reachability, the tables the daemon needs, pending migrations, and a table that is bloated rather than merely large |
| `build` | Sources newer than their build output, sources never built, and a daemon older than the build it is running |
| `webapp` | Whether the console is being served and whether its proxy reaches the daemon |
| `logs` | One message dominating the day's errors; repetition dominating while no single message does; lines stored twice; an operation being retried without limit |
| `alerts` | Enabled alert rules whose expression can never fire |
| `metrics` | Whether any CPU or memory reading is arriving at all |
| `project` | Every registered project's config, read from the file rather than from the daemon |
| `auth` | Which RPC methods answer without credentials, and whether the daemon is reachable off this host |
| `doctor` | A check that failed on its own account, so a gap is never silent |

| Option | Effect |
| ------ | ------ |
| `--json` | Machine-readable output (see below) |

Exit code is `1` when any finding has severity `error`, so it
works as a CI gate.

**What "no problems found" means.** A check that cannot run is
reported separately from one that ran and found nothing:

```
[?] 5 area(s) not examined:
      db.pending-migrations — not checked: whether every migration
        has been applied — the database stopped answering
      ...
```

An unreachable database takes five checks down with it and a
daemon that is not answering takes seven. Without that section a
silent gap and a clean result print identically, and they point an
operator in opposite directions.

In `--json` the same distinction is two fields:

```json
{
  "ok": false,
  "complete": false,
  "worst": "error",
  "findings": [ { "id": "db.unreachable", "severity": "error", "title": "…",
                  "evidence": ["…"], "remedy": "…" } ],
  "skipped":  [ { "id": "logs.*", "reason": "not checked: … — the database stopped answering" } ]
}
```

`ok` is "nothing was found"; `complete` is "everything was
looked at". A gate that reads only `ok` cannot tell a healthy
installation from an unexamined one.

Findings carry a stable `id` — `db.unreachable`,
`app.port-unreachable`, `infra.detached`, `build.stale-sources`,
`auth.anonymous-surface`, `logs.retry-loop`,
`project.config-unloadable` and so on. A `skipped` entry names the
id its check would have reported under, or `prefix.*` where a check
reports several.

`project.config-unloadable` is worth knowing about before you need
it: the daemon refuses to start against a config it cannot load,
rather than starting with no apps, so this finding is what a failed
`omnitron up` in that project's directory would have told you. The
check reads the files rather than asking the daemon, because a
daemon holding a config it loaded hours ago cannot tell you the
file has been edited since.

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

## Tor

### `omnitron tor`

Show the Tor hidden-service onion addresses for the running
stack. Top-level command; no flags.

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

## Pipelines (Xec automation)

| Command | Effect |
| ------- | ------ |
| `omnitron pipeline list` | List all pipelines |
| `omnitron pipeline save <file> [--id <id>]` | Validate and create a JSON definition, or replace the selected definition |
| `omnitron pipeline run <id> [--params-file <file>]` | Read the current revision and submit it for execution |
| `omnitron pipeline status <runId> [--json] [--output]` | Inspect steps, attempts, status and optionally retained output |
| `omnitron pipeline cancel <runId>` | Request cancellation and await the owned execution |

All pipeline RPC methods require `admin`. Parameters are data, not source substitutions. Failed, cancelled and interrupted runs produce a nonzero status-command exit code. See [Xec automation](./automation.md) for definitions, limits and recovery behavior.

## Backups

| Command | Effect |
| ------- | ------ |
| `omnitron backup create [database]` | Back up one database, or every running-stack database with no argument |
| `omnitron backup full` | **Everything**: all stack databases plus MinIO storage, Tor keys and the daemon's own state |
| `omnitron backup list` | List available backups |
| `omnitron backup restore <id>` | Restore from a backup |
| `omnitron backup schedule <target> <cron>` | Schedule a backup; `<target>` may be `all` |
| `omnitron backup schedules` | List configured schedules |
| `omnitron backup unschedule <target>` | Remove a schedule |

**`full` is not a bigger `create`.** `create` backs up databases; `full` also
takes the object storage, the Tor keys and the daemon state — the three things
that are not in any database and that a restored stack is useless without. It
reports per target, so a partial result is visible rather than aggregated into
one success or failure, and it says so plainly when there is nothing to back up
because no stack is running.

Schedules live in the daemon and survive its restarts, so `schedule` is not a
substitute for host cron in one respect only: nothing runs while the daemon is
down. `<target>` takes `all` to mean every database of every running stack.

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
| `omnitron node reconcile <node>` | Inspect historical unverified metrics; administrator only |

`node reconcile` is read-only unless `--restore` is supplied. It compares retained
source samples with PostgreSQL using the original timestamp, value and normalized
labels. Matching samples are reused; missing samples are restored through Titan's
durable storage transaction. The source accepts proof only after that commit.

```bash
omnitron --json node reconcile edge-1
omnitron --json node reconcile edge-1 --restore --pages 20
```

`--pages` defaults to `1` and accepts `1..2000`; a page contains at most 256 entries
and 2 MiB. JSON output includes counts, unresolved source rows and a `continuation`
object. Resume its `after`, `through` and `epoch` using `--after`, `--through` and
`--epoch`. After a failed acknowledgement, retry the same cursor. Repeating a
completed repair makes no new samples.

The source must support the reconciliation protocol. An older node with no
unverified entries answers as a no-op. For an older node with gaps, prepare a
compatible update or a reviewed maintenance worker; the command does not silently
execute SSH code. See [historical reconciliation](./cluster.md#reconcile-historical-metric-receipts).

### `omnitron node add` flags

| Flag | Required | Default |
| ---- | -------- | ------- |
| `--name <name>` | yes | — |
| `--host <host>` | yes | — |
| `--ssh-port <port>` | — | `22` |
| `--ssh-user <user>` | — | `root` |
| `--ssh-auth <method>` | — | `key` (or `password`) |
| `--ssh-key <path>` | — | — |
| `--ssh-secret-stdin` | — | Hidden terminal prompt, or read from a pipe |
| `--runtime <node|bun>` | — | `node` |
| `--daemon-port <port>` | — | `9700` |
| `--tags <a,b,c>` | — | — |

With `--ssh-secret-stdin`, an interactive terminal displays a masked prompt: **Enter**
submits the password or key passphrase, and **Ctrl+C** cancels without changing the node.
A pipe is read until EOF; one final LF/CRLF is removed, while spaces are preserved.
Input is limited to 64 KiB. Secrets are never command-line arguments.

```bash
omnitron node add --name production --host server.example.org \
  --ssh-key ~/.ssh/id_ed25519 --ssh-secret-stdin
omnitron node update production --ssh-secret-stdin
```

On `node update`, the secret belongs to the node's registered authentication method unless
`--ssh-auth` explicitly changes it. Thus an existing key-authenticated node receives a key
passphrase without needing to repeat `--ssh-auth key`.

## Webapp (console UI)

| Command | Effect |
| ------- | ------ |
| `omnitron webapp build` | Build the React + Vite bundle |
| `omnitron webapp start [-f]` | Start nginx container serving static + gateway (`-f, --force` recreates a running container) |
| `omnitron webapp stop` | Stop the webapp nginx container |
| `omnitron webapp status` | Show webapp status |
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

## Releases

`omnitron release` builds and verifies artifacts from project and runtime
commits. See [Releases and verification](./releases.md) for build, attestation,
artifact-store transfer and retention commands.

## Additional operational commands

| Command | Behaviour and important options |
| --- | --- |
| `omnitron stack account <project> <stack>` | Runs the project's account tool on a remote stack. `--username` creates an account and stores its generated password in the vault; `--show` and `--census` inspect it. `--remove` requires the account id. The project supplies its role model and tool implementation. |
| `omnitron stack maintenance <project> <stack> [action]` | Reads the gateway maintenance lock by default. `on --minutes 15` sets a bounded lock; `off` releases it. |
| `omnitron remote restart <alias> <app>` | Restarts the named application on a registered remote daemon. |
| `omnitron fleet upgrade [nodes...]` | Builds and installs Omnitron on registered nodes. Start with `--dry-run`; `--keep` controls retained versions. A dirty working tree requires `--allow-dirty`. |
| `omnitron secret generate <key>` | Generates a vault secret without printing its value. `--bytes` accepts 16–1024, default 32; `--encoding` accepts base64, base64url or hex. |
| `omnitron secret copy <from> <to>` | Copies a value between vault keys without printing it. |
| `omnitron secret rotate-rpcauth <passwordKey>` | Generates a paired RPC password and bitcoind authentication value. Requires `--user-key` and `--auth-key`. |
| `omnitron infra inspect <project/stack>` | Inspects remote host services without changing them. Optional repeatable selectors: `--unit`, `--path`, `--snap`, `--config`. Credential configuration keys are refused. |
| `omnitron audit` | Lists control-plane changes, newest first. Filter with `--action`, `--resource`, `--actor` and `--before`; `--limit` accepts 1–500, default 50. |

Account cleanup modes belong to the project's tool: `--leftovers` performs a
census, `--leftovers rehearse` previews removal in rolled-back transactions,
and `--leftovers apply` requests committed removal. Inspect the census and
project policy before applying cleanup.

## Fleet recovery and host ingress

`omnitron fleet recover <node> <receipt>` asks the selected node to recover a
bundle activation from its receipt. Use the receipt produced by the relevant
operation; recovery is not a fresh release or a command to deploy arbitrary files.

`omnitron infra ingress` manages host-owned ingress independently of application
stacks. `status` reads configured and observed generation; `recover` recovers an
interrupted publication. Manifest-driven operations use the expected generation
for compare-and-swap checks, so a stale plan cannot overwrite a newer owner state.
Consult `omnitron infra ingress --help` for the available operations and supply
the JSON manifest belonging to the intended host and owner.

## Console access and interactive SSH

`omnitron access` and `omnitron terminal` use the same services and policy as Console.

```bash
omnitron access show
omnitron access users
omnitron access create observer --role viewer --password-stdin
omnitron access role <id> operator --expect viewer
omnitron access revoke <id>
omnitron node ssh-key edge-1
omnitron node ssh edge-1
omnitron terminal list
omnitron terminal close <id>
```

See [Console access](./access.md) for password input, account pagination and atomic role changes. See [SSH workspace](./terminal.md) for independently verified host pins, session ownership and `Ctrl+]` disconnect.

| Command | Result |
| --- | --- |
| `omnitron access show` | Effective RPC permissions from the running daemon |
| `omnitron access users` | Safe account directory, with continuation cursor |
| `omnitron access create` | Create an account with a password read from a hidden prompt or stdin |
| `omnitron access role` | Compare-and-swap role change and session revocation |
| `omnitron access revoke` | Revoke an account's sessions |
| `omnitron node ssh-key` | Inspect or explicitly trust a host fingerprint |
| `omnitron node ssh` | Interactive shell through Xec |
| `omnitron terminal list` | List sessions owned by this caller |
| `omnitron terminal close` | Close an owned terminal |


## File workspace

`omnitron files` shares the audited Console file service. Commands include `roots`, `list`, `stat`, `read`, `save`, `mkdir`, `rename`, `trash`, `trash-list`, `restore`, `copy`, `transfers`, `pause`, `resume`, `cancel`, `upload`, `download`, `upload-status`, `upload-finish` and `upload-abort`. All support `--json`; checked mutations use an observed `--version`. See [File workspace](./files.md) for flags, examples, ownership, limits and recovery.
