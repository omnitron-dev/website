---
sidebar_position: 2
title: Docker Compose
description: Deploy an Omnitron-supervised stack as a single docker-compose file.
---

# Docker Compose

The fastest path from `pnpm dev` to "running on a server".
Suitable for staging, single-host production, demo
environments, and dev parity.

## The minimal compose file

```yaml
# docker-compose.yml
version: '3.9'

services:
  app:
    image: my-platform:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://platform:${DB_PASS}@postgres:5432/platform
      REDIS_URL:    redis://redis:6379
      JWT_SECRET:   ${JWT_SECRET}
      OMNITRON_HOME: /var/lib/omnitron
    volumes:
      - omnitron-data:/var/lib/omnitron
      - app-logs:/var/lib/omnitron/logs
    ports:
      - '3001:3001'      # api HTTP
      - '9800:9800'      # webapp
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    command: ['omnitron', 'up', '--foreground']

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER:     platform
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB:       platform
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test:     ['CMD', 'pg_isready', '-U', 'platform']
      interval: 10s
      timeout:  5s
      retries:  5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test:     ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout:  5s
      retries:  5

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - app

volumes:
  pg-data:
  redis-data:
  omnitron-data:
  app-logs:
```

`omnitron up --foreground` keeps the daemon attached to the
container's foreground so Docker's restart policy works.

## The Dockerfile

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifests for cache efficiency
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages packages
COPY apps     apps
COPY omnitron.config.ts ./

# Install + build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---- Runtime stage ----
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@latest --activate

# Copy built artefacts only
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages      ./packages
COPY --from=builder /app/apps          ./apps
COPY --from=builder /app/omnitron.config.ts ./

# Non-root user
RUN addgroup -S omni && adduser -S omni -G omni && \
    mkdir -p /var/lib/omnitron && chown -R omni:omni /var/lib/omnitron
USER omni

ENV NODE_ENV=production
EXPOSE 3001 9800

ENTRYPOINT ['/sbin/tini', '--']
CMD ['pnpm', 'omnitron', 'up', '--foreground']
```

Key choices:

- **Multi-stage**: build artefacts left behind in the builder
  stage; runtime image stays small (~150 MB).
- **`tini` PID 1**: reaps zombie processes from forked workers;
  forwards signals correctly to the daemon.
- **Non-root user**: standard hardening.
- **No `npm install` at runtime**: predictable image.

## `.env` file

```bash
# .env (gitignored)
DB_PASS=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
```

`docker compose` auto-loads `.env` from the working directory.
For real deploys, source from a secret manager and inject as
env at container start.

## Volumes

Three persistent volumes:

| Volume | Mount | Purpose |
| ------ | ----- | ------- |
| `pg-data` | `/var/lib/postgresql/data` | Postgres data |
| `redis-data` | `/data` | Redis snapshots |
| `omnitron-data` | `/var/lib/omnitron` | Daemon state, secrets, logs |
| `app-logs` | `/var/lib/omnitron/logs` | Per-app log files |

**Back up `pg-data` regularly** — that's the only volume whose
loss is catastrophic. The rest can be reconstructed.

```bash
# Backup
docker compose exec postgres pg_dumpall -U platform > backup.sql

# Or use the built-in:
docker compose exec app omnitron backup create
```

## Build + ship

```bash
# Build local:
docker compose build

# Tag + push to a registry:
docker build -t registry.example.com/platform:$(git rev-parse --short HEAD) .
docker push registry.example.com/platform:$(git rev-parse --short HEAD)

# Deploy on the target host:
ssh server "cd /srv/platform && docker compose pull && docker compose up -d"
```

## Health checks

The compose `healthcheck` for the app container:

```yaml
services:
  app:
    healthcheck:
      test:         ['CMD', 'pnpm', 'omnitron', 'ping']
      interval:     30s
      timeout:      10s
      retries:      3
      start_period: 30s     # grace for cold start
```

`omnitron ping` returns 0 when the daemon is reachable.

## Logging

App logs go to stdout (pino JSON); compose forwards to its
logging driver:

```yaml
services:
  app:
    logging:
      driver: 'json-file'
      options:
        max-size: '50m'
        max-file: '10'
```

For production, ship to Loki / Datadog / Cloudwatch via the
docker logging driver:

```yaml
services:
  app:
    logging:
      driver: 'loki'
      options:
        loki-url: 'https://loki.example.com/loki/api/v1/push'
```

## Resource limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus:   '2.0'
          memory: 2G
        reservations:
          cpus:   '0.5'
          memory: 512M
```

`docker compose up` honours these as soft limits; `docker swarm
deploy` enforces them.

## Updating the stack

Zero-downtime rolling update on a single host:

```bash
# Pull the new image:
docker compose pull app

# Recreate just the app container (DB + Redis stay up):
docker compose up -d --no-deps app
```

For true zero-downtime, run the daemon in the container with
`omnitron reload` instead of restart:

```bash
docker compose exec app omnitron reload
```

This works because reload cycles workers within the running
daemon — no container restart.

## Compose for dev

A separate `docker-compose.dev.yml`:

```yaml
version: '3.9'

services:
  postgres:
    extends:
      file: docker-compose.yml
      service: postgres
    ports:
      - '5432:5432'      # expose to host for psql

  redis:
    extends:
      file: docker-compose.yml
      service: redis
    ports:
      - '6379:6379'

# No 'app' service — run the app locally via `pnpm dev`
```

Boot:

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm dev                                # app runs on host
```

## What this doesn't give you

- **Multi-host** — for that, `docker swarm deploy` or move to
  Kubernetes.
- **Per-app autoscaling** based on CPU/memory metrics —
  Omnitron's autoscaler works inside the daemon, not at the
  container level.
- **Managed TLS / DNS** — bring nginx-proxy / Caddy / Traefik
  in front, or a managed LB.
- **Multi-region** — deploy per region; coordinate via DNS or
  Omnitron cluster mode.

For those, see [Kubernetes](./kubernetes.md) or
[Cluster + Fleet](./../omnitron/cluster.md).

## See also

- [Deployment overview](./index.md)
- [Best practices](./../omnitron/best-practices.md)
- [Configuration](./../omnitron/configuration.md) — `omnitron.config.ts` reference
