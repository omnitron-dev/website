---
sidebar_position: 2
title: CLI Reference
---

# CLI Reference

`omnitron <command>` — talk to a running Titan app or supervisor over
Netron.

## Lifecycle

| Command                       | Effect                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `omnitron dev <path>`         | Start the app at `<path>` with hot reload              |
| `omnitron start <path>`       | Start in production mode (no reload, structured logs)  |
| `omnitron stop <name>`        | Gracefully stop a running service                      |
| `omnitron restart <name>`     | Stop + start                                           |
| `omnitron status [name]`      | List services or show one                              |

## Observability

| Command                              | Effect                                              |
| ------------------------------------ | --------------------------------------------------- |
| `omnitron logs [name] [--follow]`    | Tail structured logs (one or all services)          |
| `omnitron logs --since 1h`           | Replay buffered logs from the last hour             |
| `omnitron metrics [name]`            | Snapshot of current metric values                   |
| `omnitron trace <traceId>`           | Pull a complete trace by ID                         |
| `omnitron health [name]`             | Run health indicators against a service             |

## Inspection

| Command                              | Effect                                              |
| ------------------------------------ | --------------------------------------------------- |
| `omnitron services`                  | List registered Netron services and versions        |
| `omnitron describe <service>`        | Print a service descriptor (methods, schemas)       |
| `omnitron call <service> <method>`   | Invoke a service method directly from the CLI       |
| `omnitron call users@1.0.0 findById --args '["u_42"]'` | Example with JSON args              |

## Modules and DLQ

| Command                                       | Effect                                       |
| --------------------------------------------- | -------------------------------------------- |
| `omnitron sched list`                         | Scheduled jobs across the fleet              |
| `omnitron sched run <id>`                     | Trigger a scheduled job now                  |
| `omnitron notify dlq list`                    | Dead-letter queue for notifications          |
| `omnitron notify dlq retry <id>`              | Re-deliver a DLQ entry                       |

## Project workflow

| Command                          | Effect                                                |
| -------------------------------- | ----------------------------------------------------- |
| `omnitron init`                  | Scaffold a new Titan project in the current directory |
| `omnitron generate service <n>`  | Generate a service + module skeleton                  |
| `omnitron build`                 | Build all packages in the workspace                   |
| `omnitron test`                  | Run the project's test suite                          |

## Remote operation

`omnitron` defaults to a local Unix socket. To target a remote host,
pass `--host`:

```bash
omnitron status --host production.internal:7000 --token $OPS_TOKEN
```

The remote endpoint is an Omnitron supervisor exposing the operator
service over Netron. Auth uses the same `titan-auth` JWT machinery as
your app services.

## Help

```bash
omnitron help                  # Top-level
omnitron help logs             # Per-command
omnitron help logs --follow    # Per-flag
```
