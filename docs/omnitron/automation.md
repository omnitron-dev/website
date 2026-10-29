---
title: Xec automation
description: Author, review, execute and inspect bounded Xec pipelines through Console and CLI.
---

# Xec automation

Use **Pipelines** in Console to create an automation, review its source and targets, run it with parameters, and inspect each step. Definitions belong to the daemon; the section is available in the system workspace without selecting a project. A workspace selection does not restrict execution targets or provide an authorization scope. The CLI calls the same `OmnitronPipelines` service. Omnitron owns authority, persistent run state and presentation; `@xec-sh/ops` owns the execution graph, retries and cancellation; `@xec-sh/core` owns local and SSH process execution.

This executor is for trusted administrators. A separate child process prevents a script from blocking the daemon's JavaScript event loop, but does **not** sandbox its filesystem, network or operating-system privileges. Do not give an untrusted agent the local daemon socket or this executor. See the [agent integration design](./agents.md).

## First automation

Save this as `inspect.json`, replacing the working directory with an existing project directory:

```json
{
  "name": "inspect-runtime",
  "description": "Inspect a runtime before planning a change",
  "steps": [
    {
      "name": "runtime",
      "kind": "xec",
      "cwd": "/srv/projects/example",
      "timeout": 30000,
      "run": "const label: string = String(params.label ?? 'runtime'); console.log(label); await $target`node --version`;"
    }
  ]
}
```

```bash
omnitron pipeline save inspect.json
omnitron pipeline list
omnitron pipeline run <pipeline-id> --params-file parameters.json
omnitron pipeline status <run-id> --output
omnitron pipeline status <run-id> --json
omnitron pipeline cancel <run-id>
```

`parameters.json` contains a JSON object, for example `{"label":"candidate"}`. Keep private parameter files outside version control. Parameter values travel as data and are represented as `[provided]` in run history. This does not make deliberate printing or copying of a secret safe.

To update an existing automation without replacing its identity, use `omnitron pipeline save inspect.json --id <pipeline-id>`. Prefer IDs when names are ambiguous.

## Steps and targets

| Field | Meaning |
| --- | --- |
| `name` | Unique graph key, 1–80 letters, digits, `_`, `.` or `-` |
| `kind` | `shell` by default; `xec` for TypeScript |
| `run` | Shell source or TypeScript script |
| `cwd` | Existing working directory; module imports resolve relative to it |
| `nodeId` | Registered node ID; omission or `local` selects the local machine |
| `dependsOn` | Names of steps that must complete first |
| `timeout` | Step deadline in milliseconds; default five minutes, maximum 24 hours |
| `retries` | Additional attempts, 0–5; only use with repeatable operations |
| `env` | Explicit environment entries |
| `condition` | A small parameter expression, such as `params.enabled` or `params.stage == 'test'` |

An Xec script receives `params`, `$` for local commands and `$target` for the selected target. TypeScript runs in a local child process; selecting a remote node does not move that interpreter to the node. Use `$target` for remote commands. The server resolves SSH credentials from the node registry and vault and requires a trusted host key. The browser never receives credentials.

Shell steps receive parameters as `OMNITRON_PARAMS` JSON. `{{parameter}}` source substitution is rejected. Unsupported conditions and cron/webhook triggers are rejected rather than silently ignored; this release supports manual triggers. Xec validates the complete dependency graph before any step executes.

## Review and authority

Every public pipeline method requires `admin`. Invocation revalidates the human session, including its current account role. Sensitive mutations must write an audit intent before taking effect; a failed audit write denies the operation. The owner-only Unix socket remains an OS-authorized administrative interface.

The definition carries a SHA-256 `revision`. Console submits the revision displayed for review; the CLI fetches the selected definition immediately before admission. Direct RPC and MCP callers must supply `expectedRevision`. If source, targets, environment or other stored definition fields changed, admission fails before inserting a run. This is optimistic concurrency control, not a separate multi-person approval workflow.

Per-step history records a digest of the admitted definition, target ID, actor, attempts, timing, outcome and bounded stdout/stderr. It does not yet keep a complete immutable source archive. Do not treat the digest alone as recoverable source.

## Progress and failure

Console shows individual step states, elapsed time, attempt counts, exit codes and output. Open a run for details; the history table fetches summaries without downloading every run's output. A failed refresh is displayed as stale data. On narrow windows, details use the full viewport and long code/output remains inside its scroll area.

`omnitron pipeline cancel <run-id>` first records `cancelling`, signals active work and awaits executor termination before returning a terminal state. Dependent steps do not start after cancellation. A daemon restart marks unfinished runs `interrupted`; it never replays operations automatically. Inspect external effects before retrying an interrupted run.

Local process groups and Xec SSH channels participate in cancellation. A command that deliberately detaches a remote process can outlive its SSH channel; channel closure is not proof that every remote side effect stopped. Use managed Omnitron jobs or an explicitly reversible playbook for long-lived services.

## Resource bounds

| Resource | Bound |
| --- | --- |
| Steps per definition | 32 |
| Active runs per daemon | 8 |
| Concurrent steps per run | 4 |
| Source per step | 128 KiB |
| Parameters | 64 scalar JSON values, 16 KiB total |
| Retained stdout/stderr | 32 KiB per stream and step |
| History request | At most 200 summaries |

Output persistence is throttled and awaited, applying backpressure instead of starting unbounded database writes. Xec's SSH stream honors writable backpressure and avoids a second unbounded capture. History reports truncation explicitly. Known parameter/credential values and private-key blocks are redacted; redaction is best effort and does not replace secret isolation.

The daemon exposes bounded-label run counters and duration histograms through the existing Titan metrics path. Code, user parameters and run IDs are not metric labels. See [Observability](./observability.md) for querying signals and [Console access](./access.md) for effective grants.
