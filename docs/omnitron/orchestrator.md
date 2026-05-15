---
sidebar_position: 3
title: Orchestrator
---

# Orchestrator

The orchestrator is the part of Omnitron that supervises multiple Titan
services as a single stack. It owns process lifecycles, port assignments,
restart policies, and health-driven traffic gating.

## What it manages

A stack is declared in `omnitron.yaml`:

```yaml
stack: my-app

services:
  api:
    path:    ./apps/api
    restart: on-failure
    netron:
      http: 3000
      ws:   3001
    health:
      path: /healthz
      timeout: 5s
    env:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}

  worker:
    path:    ./apps/worker
    restart: always
    netron:
      tcp:  4001
    depends_on: [api]

  console:
    path:     ./apps/console
    restart:  on-failure
    static:   true
    port:     8080
```

Bring it up:

```bash
omnitron up
omnitron up worker         # one service
omnitron down              # graceful shutdown of the whole stack
```

## Restart policies

| Policy        | Behaviour                                                    |
| ------------- | ------------------------------------------------------------ |
| `no`          | Never restart                                                |
| `on-failure`  | Restart if exit code ≠ 0, with exponential backoff           |
| `always`      | Restart on any exit                                          |
| `unless-stopped` | Restart unless explicitly `omnitron stop`'d              |

Backoff is the shared `computeBackoff` primitive used across Titan; see
`titan/computeBackoff` for the formula.

## Health-driven gating

The orchestrator polls each service's `/healthz` and `/readyz` (or the
custom paths declared in `omnitron.yaml`). A service that fails its
readiness probe is marked unready; the orchestrator stops routing
traffic to it until it recovers.

For services that participate in `titan-discovery`, the orchestrator
also strips them from the registry while unready, so other services
stop sending them work.

## Per-stack namespacing

Multiple stacks can run on the same host without colliding. Each stack
gets its own Unix socket namespace and Redis key prefix:

```
/run/omnitron/<stack-name>/admin.sock
omnitron:<stack-name>:discovery:*
```

The CLI defaults to the stack in `omnitron.yaml`; pass `--stack` to
target a different one.

## Read also

- [CLI](./cli.md) — commands that drive the orchestrator.
- [Web Console](./console.md) — the UI for the same operator surface.
