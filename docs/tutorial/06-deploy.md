---
sidebar_position: 7
title: 6. Deploy
description: Package everything into Docker; ship to a server.
---

# Step 6 — Deploy

By the end: a `docker-compose.yml` running the api + webapp +
Postgres + Redis on a single server, with TLS via nginx.

## Build the api

`apps/api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps     apps
COPY packages packages
RUN pnpm install --frozen-lockfile
RUN pnpm -F api build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@latest --activate
COPY --from=build /app/node_modules         ./node_modules
COPY --from=build /app/apps/api/dist        ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages              ./packages
COPY --from=build /app/apps/api/migrations  ./apps/api/migrations

RUN addgroup -S app && adduser -S app -G app
USER app

ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ['/sbin/tini', '--']
CMD ['node', '/app/apps/api/dist/main.js']
```

## Build the webapp

`apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps     apps
COPY packages packages
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL=https://api.example.com
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm -F web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`apps/web/nginx.conf`:

```nginx
server {
  listen 80 default_server;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Static-asset caching
  location ~* \.(?:js|css|woff2?|svg|png|jpg|jpeg|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## docker-compose.yml

```yaml
version: '3.9'

services:
  api:
    build:
      context:    .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV:     production
      DATABASE_URL: postgres://platform:${DB_PASS}@postgres:5432/platform
      REDIS_URL:    redis://redis:6379
      JWT_SECRET:   ${JWT_SECRET}
      API_LOG_LEVEL: info
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
      migrate:  { condition: service_completed_successfully }
    healthcheck:
      test:     ['CMD', 'wget', '-qO-', 'http://localhost:3001/healthz']
      interval: 30s
      timeout:  10s
      retries:  3

  migrate:
    build:
      context:    .
      dockerfile: apps/api/Dockerfile
    command: ['sh', '-c', 'cat /app/apps/api/migrations/*.sql | psql ${DATABASE_URL}']
    environment:
      DATABASE_URL: postgres://platform:${DB_PASS}@postgres:5432/platform
    depends_on:
      postgres: { condition: service_healthy }
    restart: 'no'

  web:
    build:
      context:    .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: https://api.example.com
    restart: unless-stopped

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
    healthcheck:
      test:     ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout:  5s
      retries:  5

  caddy:
    image: caddy:alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - api
      - web

volumes:
  pg-data:
  caddy-data:
  caddy-config:
```

## Caddyfile (TLS auto-provisioned)

```
api.example.com {
  reverse_proxy api:3001
  encode gzip
}

app.example.com {
  reverse_proxy web:80
  encode gzip
}
```

Caddy auto-provisions Let's Encrypt certs on first start —
no certbot setup needed.

## .env (gitignored)

```bash
DB_PASS=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
```

## Deploy script

```bash
#!/bin/bash
# deploy.sh
set -euo pipefail

SERVER="${1:?usage: deploy.sh user@host}"

echo "→ Building images locally..."
docker compose build

echo "→ Saving images..."
docker save \
  $(docker compose config --images) \
  | gzip > /tmp/images.tar.gz

echo "→ Shipping to $SERVER..."
ssh "$SERVER" 'mkdir -p /srv/platform'
scp /tmp/images.tar.gz docker-compose.yml Caddyfile "$SERVER:/srv/platform/"
scp .env "$SERVER:/srv/platform/.env"

echo "→ Loading + deploying..."
ssh "$SERVER" '
  cd /srv/platform
  docker load < images.tar.gz
  docker compose up -d --remove-orphans
'

echo "✓ Deployed."
```

Use:

```bash
chmod +x deploy.sh
./deploy.sh admin@your-server.example.com
```

## DNS

Point `api.example.com` and `app.example.com` to your server's
IP. Caddy will auto-provision Let's Encrypt certificates on
first request.

## Verify

After ~1 minute (TLS cert acquisition):

```bash
curl https://api.example.com/healthz
# {"status":"healthy"}

open https://app.example.com
# Webapp loads; sign in works.
```

## Updates

```bash
./deploy.sh admin@your-server.example.com
```

Re-runs the deploy. Docker Compose detects new images and
recreates the api/web containers; Postgres + Redis stay up.

For zero-downtime API updates use:

```bash
ssh admin@your-server.example.com 'cd /srv/platform && docker compose exec api kill -USR2 1'
```

If your api had multiple workers (via `instances > 1`), they'd
cycle one-by-one without dropping traffic.

## Backups

Daily Postgres dump:

```bash
# /etc/cron.d/platform-backup
30 2 * * *  admin  docker exec platform-postgres-1 pg_dump -U platform platform | gzip > /backups/platform-$(date +\%Y\%m\%d).sql.gz
```

For object storage of backups, push to S3 (or any S3-compatible)
in a follow-up step.

## Monitoring

- **Logs** — `docker compose logs -f --tail 100`. For real
  aggregation, ship to Loki via the docker logging driver.
- **Metrics** — scrape `api:3001/metrics` from a Prometheus
  container.
- **Uptime** — external ping of `/healthz`.

## What you've shipped

| Layer | Implementation |
| ----- | -------------- |
| Backend | Titan app with auth + Postgres + Redis |
| Frontend | React + Prism + netron-react |
| Wire | Netron HTTP with MessagePack + JWT |
| Persistence | Postgres + Redis |
| Reverse proxy | Caddy with auto-TLS |
| Container orchestration | Docker Compose |
| Tests | Unit + integration + E2E with Vitest + Playwright |
| Deploy | One-command shell script |

## Where to go from here

| Want | Where |
| ---- | ----- |
| Multi-app supervision | Add `@omnitron-dev/omnitron` daemon — [Omnitron overview](../omnitron/overview.md) |
| Web console UI | [Console](../omnitron/console.md) |
| Multi-node fleet | [Cluster + Fleet](../omnitron/cluster.md) |
| K8s deployment | [Kubernetes guide](../deployment/kubernetes.md) |
| More modules | [Module catalogue](../titan/modules) |
| Production patterns | [Best practices](../omnitron/best-practices.md) + [Recipes](../omnitron/recipes.md) |

## Commit

```bash
git add .
git commit -m "step 6: docker deploy + caddy TLS"
git tag v0.1.0
```

## Congratulations

Six steps, ~2.5 hours, full-stack production-shaped TypeScript
app with zero codegen. Now go build something real with it.

→ [Reference docs](../intro.md)
