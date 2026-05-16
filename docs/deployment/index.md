---
sidebar_position: 1
title: Overview
description: How to deploy Omnitron-supervised apps — Docker, k8s, PaaS, bare-metal.
---

# Deployment

How to take a Titan app from `pnpm dev` to production. Four
paths covered in detail, plus the cross-cutting concerns.

## Choose your path

| Where | Use |
| ----- | --- |
| **One box, you own it** | [Docker Compose](./docker.md) — daemon + apps + infra in one stack |
| **Container orchestrator** | [Kubernetes](./kubernetes.md) — daemon as a stateful pod, apps as deployments |
| **Platform-as-a-Service** | [Fly.io / Railway / Render](./paas.md) — opinionated, fast to ship |
| **Bare-metal / VM** | [systemd](./bare-metal.md) — daemon as a system service |

For dev / staging / prod parity, run the same `omnitron.config.ts`
across environments. Only secrets + scale parameters change per
deploy target.

## Cross-cutting concerns

### What you ship

A production deployment carries:

1. **Compiled app code** — `dist/` for each app.
2. **`omnitron.config.ts`** — the ecosystem config.
3. **Per-app `config/default.json`** — declarative infra.
4. **Static webapp bundle** (optional) — `apps/omnitron/webapp/dist/`.
5. **Migrations** — `migrations/*.sql`.

That's it. No generated client code, no schema sync artefacts,
no shipped node_modules.

### What you provide at the target

- **Node.js 22+**.
- **PostgreSQL** (managed or self-hosted) — connection string in
  env.
- **Redis** (managed or self-hosted) — connection string in env.
- **Object storage** (S3 / MinIO) — credentials in env.
- **Secrets manager** (optional) — Omnitron's encrypted store
  works standalone; for prod prefer a real secret manager.

### Environment variables — the canonical set

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | `'production'` |
| `OMNITRON_HOME` | Override `~/.omnitron/` location |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Signing key — long random; from secret manager |
| `OMNITRON_TOKEN` | Operator token for remote daemon ops (optional) |
| `<APP>_*` | Per-app overrides (matches `envPrefix` in `bootstrap.ts`) |

Anything in `omnitron.config.ts` can be derived from env at
boot via `ConfigService` — favour env over config files for
per-environment values.

### Logs and metrics

- **Logs** stream to stdout (pino JSON) — ingest with your log
  aggregator's stdin-tail or sidecar.
- **Metrics** scrape via the Omnitron daemon's `/metrics`
  endpoint or push to a backend via `titan-telemetry-relay`.
- **Health probes** — point your platform's liveness/readiness
  at `/healthz` / `/readyz` served by `titan-health`.

### Secrets

Three options, in order of preference:

1. **Cloud secret manager** (AWS Secrets Manager, GCP Secret
   Manager, Vault) — inject as env at pod / container boot.
2. **Encrypted file** (`~/.omnitron/secrets.enc`) — works
   without external dependencies; rotate the passphrase via
   env.
3. **Plain env vars** — fine for non-sensitive config, not for
   credentials.

Never commit secrets to `omnitron.config.ts` or
`config/default.json`.

### Migrations

```bash
# In the deploy script, before starting the daemon:
omnitron infra migrate
# or for one app:
omnitron infra migrate api
```

Migrations run inside a Postgres advisory lock — concurrent
deploys are safe; only one will run, others wait.

### Backups

```bash
# Manual:
omnitron backup create

# Scheduled (in omnitron.config.ts or via CLI):
omnitron backup schedule create main --cron '0 2 * * *'
```

Backups land in `~/.omnitron/backups/` by default; configure
S3 destination in the daemon config for off-host storage.

### Zero-downtime deploys

The `reload` command cycles workers one-by-one:

```bash
omnitron reload api
```

In **module-worker mode**, the worker pool maintains capacity
throughout the reload. In **classic mode**, a new bootstrap is
forked side-by-side; the old one drains.

For blue/green or canary, the [deploy](./../omnitron/cli.md#deployment) command supports
`--strategy blue-green` and `--strategy canary`.

### Multi-region

| Strategy | Pattern |
| -------- | ------- |
| **One cluster per region** (recommended) | Each region elects its own leader; cross-region calls via ingress |
| **Single global cluster** | All daemons peer; sensitive to partition |
| **Fleet without cluster** | Each daemon independent; addressed by alias |

See [Cluster + Fleet / Multi-region patterns](./../omnitron/cluster.md#multi-region-patterns).

### Observability checklist

- [ ] Logs → SIEM / log aggregator.
- [ ] Metrics → Prometheus / managed metrics backend.
- [ ] Traces → OTel collector (if `titan-tracing` configured).
- [ ] Health probes → load balancer.
- [ ] Uptime monitoring → external pinger of `/healthz`.
- [ ] Error reporting → Sentry via netron-browser middleware.
- [ ] Alerts → `OmnitronAlerts` with delivery webhooks.

### Security checklist (deploy time)

- [ ] TLS terminated at the gateway / load balancer (not the app).
- [ ] Strong `JWT_SECRET`, rotated quarterly.
- [ ] Omnitron TCP port (9700) firewalled to internal only.
- [ ] Database password from secret manager, never env literal.
- [ ] CORS allowlist limited to known origins.
- [ ] CSP header on webapp.
- [ ] Rate limits configured per public endpoint.
- [ ] Audit logs going to append-only sink.

See [Auth & RBAC](./../omnitron/auth-rbac.md) and the per-module
[Security checklist](./../titan/modules/security-checklist.mdx).

### Rollback

```bash
# Roll back the last deploy:
omnitron rollback api

# Or to a specific version:
omnitron rollback api --version v1.4.2
```

Configure retention of previous deploy artefacts in
`omnitron.config.ts`:

```typescript
deployment: {
  retain: 5,           // keep last 5 versions for rollback
  versionTag: 'git-sha',  // 'git-sha' | 'semver' | 'timestamp'
}
```

## Read the per-target guides

- [Docker Compose](./docker.md) — single-host development + staging
- [Kubernetes](./kubernetes.md) — production at scale
- [PaaS](./paas.md) — Fly.io / Railway / Render quickstart
- [Bare-metal / systemd](./bare-metal.md) — own-server deploys

## See also

- [Best practices](./../omnitron/best-practices.md) — production patterns
- [Recipes](./../omnitron/recipes.md) — concrete topologies
- [Architecture](./../omnitron/architecture.md) — what runs where
- [Cluster + Fleet](./../omnitron/cluster.md) — multi-node
