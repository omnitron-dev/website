---
sidebar_position: 4
title: PaaS (Fly.io / Railway / Render)
description: Opinionated PaaS deploys for fast time-to-prod.
---

# PaaS

For when you want shipping speed over operational control.
Three popular options covered below. All share the same shape:

1. Push your Dockerfile.
2. Configure env vars / secrets.
3. Provision managed Postgres + Redis from the same provider.
4. Done.

## Fly.io

`fly.toml`:

```toml
app = "platform"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV       = "production"
  OMNITRON_HOME  = "/var/lib/omnitron"

[mounts]
  source      = "omnitron_data"
  destination = "/var/lib/omnitron"

[http_service]
  internal_port = 9800
  force_https   = true
  auto_stop_machines  = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  internal_port = 3001                 # api
  protocol      = "tcp"
  [[services.ports]]
    handlers = ["http"]
    port     = 8080

[[vm]]
  cpu_kind = "shared"
  cpus     = 2
  memory_mb = 2048
```

```bash
# Provision DB:
fly postgres create --name platform-pg --region fra
fly postgres attach platform-pg

# Provision Redis:
fly redis create --name platform-redis --region fra
fly redis attach platform-redis

# Secrets:
fly secrets set JWT_SECRET=$(openssl rand -hex 48)

# Deploy:
fly deploy
```

Fly auto-injects `DATABASE_URL` and `REDIS_URL` env vars from
the attached resources. Persistent volume preserves
`~/.omnitron/` across deploys.

For multi-region:

```bash
fly scale count 3 --region fra,ams,lhr     # 3 machines, one per region
```

Each region's machine sees the local Postgres/Redis (Fly
replicates them). For Omnitron cluster mode, set `cluster.peers`
to the Fly internal DNS names.

## Railway

`railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build":   { "builder": "DOCKERFILE" },
  "deploy": {
    "startCommand":         "pnpm omnitron up --foreground",
    "healthcheckPath":      "/healthz",
    "healthcheckTimeout":   30,
    "restartPolicyType":    "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Workflow:

1. Push the repo to GitHub.
2. `railway up` or connect via dashboard.
3. Add Postgres + Redis from Railway templates (one click each).
4. Set `JWT_SECRET` via the dashboard.
5. Railway auto-detects the Dockerfile and deploys.

Env vars (auto-injected):

- `DATABASE_URL` — from the linked Postgres
- `REDIS_URL` — from the linked Redis
- `PORT` — Railway-assigned; map to `3001` in `omnitron.config.ts`
  or override via env in `defineSystem`.

For persistent volumes (Omnitron state), add a Volume in the
dashboard and mount at `/var/lib/omnitron`.

## Render

`render.yaml`:

```yaml
services:
  - type: web
    name: platform
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: standard
    region: oregon
    autoDeploy: true
    healthCheckPath: /healthz
    envVars:
      - { key: NODE_ENV, value: production }
      - { key: OMNITRON_HOME, value: /var/lib/omnitron }
      - { key: JWT_SECRET, generateValue: true }
      - { fromDatabase: { name: platform-pg, property: connectionString }, key: DATABASE_URL }
      - { fromService:  { name: platform-redis, type: redis, property: connectionString }, key: REDIS_URL }
    disk:
      name: omnitron-state
      mountPath: /var/lib/omnitron
      sizeGB: 5

databases:
  - name: platform-pg
    plan: standard
    region: oregon

  - type: redis
    name: platform-redis
    plan: standard
    region: oregon
```

```bash
# Or just connect the repo via the dashboard — render.yaml is auto-detected.
```

Render handles the rest. `generateValue: true` mints a JWT
secret on first deploy.

## Common patterns across PaaS

### Boot command

Always:

```bash
pnpm omnitron up --foreground
```

`--foreground` keeps Node attached so the PaaS supervisor sees a
running process; the daemon takes over signal handling.

### Health check path

Always `/healthz` (or `/readyz` if the PaaS distinguishes
startup from runtime checks).

### Persistent volume

Mount `~/.omnitron/` for the daemon's PID, state, and secrets
store. Without it, every deploy is a fresh daemon — fine for
stateless workloads, loses uptime history + secrets on restart.

### Secrets

Always via the PaaS secret manager. Never in `omnitron.config.ts`
or `config/default.json`.

### Database migrations

Most PaaS support a "pre-deploy" or "release" command:

```toml
# Fly.io fly.toml
[deploy]
  release_command = "pnpm omnitron infra migrate"

# Railway — separate one-off command
# Render — pre-deploy script in render.yaml
```

Runs once per deploy, before the new image takes traffic.

### Scaling

| PaaS | How |
| ---- | --- |
| Fly | `fly scale count N --region X` |
| Railway | Dashboard slider (replicas) |
| Render | Plan-based; auto-scaling on paid plans |

PaaS scaling is **horizontal** (more pods). Omnitron-level
scaling (worker pools within a pod) configured in
`defineSystem`'s `scaling` block.

### Logs

Each PaaS aggregates container stdout. For production:

- **Fly** — `fly logs` for live tail; ship to Datadog/Logtail.
- **Railway** — Dashboard live tail; webhook to external log
  aggregator.
- **Render** — Dashboard live tail; log streams to S3/SIEM.

Set `logging.level` to `'info'` in production; `'debug'` only
for time-bounded investigations.

## Multi-app on one PaaS service

A single Omnitron daemon can supervise multiple Titan apps in
one container. Configure in `omnitron.config.ts`:

```typescript
export default defineEcosystem({
  apps: [
    { name: 'api',    bootstrap: './apps/api/dist/bootstrap.js' },
    { name: 'worker', bootstrap: './apps/worker/dist/bootstrap.js' },
    { name: 'ws',     bootstrap: './apps/ws/dist/bootstrap.js' },
  ],
  // ...
});
```

Then expose ports for each via PaaS multi-port config (Fly) or
multiple services (Railway).

Single-container deployment is cheaper but losses isolation —
all apps share the container's resources.

## PaaS limitations

- **Filesystem ephemerality** — without explicit volumes,
  `~/.omnitron/` is reset on every deploy. Volumes are mandatory
  for production.
- **PostgreSQL hosting** — managed Postgres on each PaaS is
  fine for hundreds of req/s. For TB-scale data, move to AWS RDS
  / GCP Cloud SQL.
- **Compute limits** — PaaS billing tiers cap CPU / RAM. Heavy
  workloads outgrow them.
- **Cluster mode** — Omnitron's cluster + fleet patterns assume
  long-lived daemons with known addresses. PaaS often
  reschedules containers on different hosts. Use single-node
  daemon per region with managed Postgres / Redis instead.

For more control, see [Kubernetes](./kubernetes.md) or
[Docker Compose on a VM](./docker.md).

## Cost rough-order

Roughly per month for a small production setup:

| PaaS | Compute + DB + Redis | Total |
| ---- | ---------------------- | ----- |
| Fly | shared CPU, 2 GB + small DB + small Redis | $30–60 |
| Railway | starter tier + DB + Redis | $20–50 |
| Render | standard plan + DB + Redis | $50–100 |

Numbers vary widely by traffic. PaaS shines for $0–$300/mo
range; beyond that, Kubernetes catches up on cost.

## See also

- [Docker Compose](./docker.md) — single-host alternative
- [Kubernetes](./kubernetes.md) — when you outgrow PaaS
- [Bare-metal](./bare-metal.md) — own-server option
- [Configuration](./../omnitron/configuration.md)
