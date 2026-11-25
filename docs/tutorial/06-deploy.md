---
id: "tutorial/deploy"
slug: "/docs/tutorial/deploy"
sidebar_position: 7
title: 6. Deploy
description: Package the tutorial API and portal, apply database migrations and serve both over one HTTPS origin.
---

# Step 6 — Deploy

Run the API and portal on one host. Caddy terminates TLS and routes requests under `/api` to Netron. Nginx serves the static React application. PostgreSQL keeps the application data and migration history in a named volume.

## Build the API {#build-the-api}

Pin pnpm in the root `package.json` with `"packageManager": "pnpm@12.21.0"`. Set `injectWorkspacePackages: true` in `pnpm-workspace.yaml`, add the migration CLI with `pnpm --dir apps/api add @omnitron-dev/omnitron@0.4.17` and commit the refreshed lockfile. In `.dockerignore`, exclude `.git`, `**/node_modules`, `**/dist`, `.env` and `**/.env*`.

`apps/api/Dockerfile` packages the application with its production dependencies.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build && pnpm --filter api deploy --prod /out

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /out/ ./
USER node
ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

Create `apps/api/omnitron.migrations.js` next to `migrations/`. Set `"files": ["dist", "migrations", "omnitron.migrations.js"]` in `apps/api/package.json` so `pnpm deploy` includes the compiled server, SQL and runner configuration. Each SQL file has a stable name and checksum. The runner records its completion in the application database.

```javascript
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createPostgresMigrationDatabase, defineMigrationConfig, defineSqlMigration } from '@omnitron-dev/omnitron/migration';

const migrations = await Promise.all(['001_users', '002_auth'].map(async name =>
  defineSqlMigration(name, await readFile(new URL(`./migrations/${name}.sql`, import.meta.url), 'utf8'))));

export default defineMigrationConfig({
  name: 'platform',
  migrations,
  async connect() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const db = createPostgresMigrationDatabase(pool);
    return { db, close: async () => { try { await db.destroy(); } finally { await pool.end(); } } };
  },
});
```

Use a fresh application volume for this deployment. For an existing database, reconcile its recorded migration history before adopting the runner. [Adopt an existing database](../omnitron/migrations.md#adopt-an-existing-application)

## Build the webapp {#build-the-webapp}

`apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps     apps
COPY packages packages
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
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
  location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## docker-compose.yml {#docker-composeyml}

```yaml
services:
  api:
    build:
      context:    .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV:     production
      DATABASE_URL: postgres://platform:${DB_PASS}@postgres:5432/platform
      API_HOST:     0.0.0.0
      JWT_SECRET:   ${JWT_SECRET}
      API_LOG_LEVEL: info
    depends_on:
      postgres: { condition: service_healthy }
      migrate:  { condition: service_completed_successfully }
    healthcheck:
      test:     ['CMD', 'wget', '-qO-', 'http://localhost:3001/health']
      interval: 30s
      timeout:  10s
      retries:  3

  migrate:
    build:
      context:    .
      dockerfile: apps/api/Dockerfile
    command: ['node_modules/.bin/omnitron', 'migrate', 'up', '--config', 'omnitron.migrations.js']
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
        VITE_API_URL: https://${APP_DOMAIN}/api
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

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    environment:
      APP_DOMAIN: ${APP_DOMAIN:?set APP_DOMAIN}
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
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

## Caddyfile (TLS auto-provisioned) {#caddyfile-tls-auto-provisioned}

```caddyfile
{$APP_DOMAIN} {
  encode gzip
  handle_path /api/* {
    reverse_proxy api:3001
  }
  handle {
    reverse_proxy web:80
  }
}
```

## .env (gitignored) {#env-gitignored}

Set `APP_DOMAIN`, `DB_PASS` and `JWT_SECRET` on the deployment host. Generate each secret separately with `openssl rand -hex 32`. A Compose `.env` file holds literal values. Protect it with mode `0600` and retain the same values when restarting the stack.

## Deploy {#deploy-script}

From the checked-out application revision on the target host, validate the Compose file, build and start the services. Its migration job must succeed before the API starts.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps --all
docker compose logs migrate
```

For centrally managed releases on enrolled nodes, Omnitron can build a pinned application, transfer verified artifacts and record startup receipts. [Deploy a qualified release](../omnitron/releases.md#deploy-a-qualified-release)

## DNS {#dns}

Point the domain in `APP_DOMAIN` to this host and allow inbound connections on ports 80 and 443. Caddy obtains and renews the certificate using its retained data volume.

## Verify {#verify}

Replace the example hostname with your configured domain. Check HTTP readiness, sign in through the portal, fetch the users list and sign out. Use a dedicated test account for this walkthrough.

```bash
curl --fail https://app.example.com/api/health
docker compose run --rm migrate node_modules/.bin/omnitron migrate verify --config omnitron.migrations.js
```

The session checks from [step 3](./03-auth.md#verify) exercise the same Netron endpoints under the public `/api` path.

## Updates {#updates}

Review new migration checksums and test the candidate against a disposable copy. Retain the currently deployed application revision. Apply the candidate with the same Compose project name, secrets and named volumes, then repeat the health and session checks. A single API container briefly interrupts requests while Compose replaces it. When new writes are incompatible with the preceding application, use a forward correction or a compatible recovery build.

## Backups {#backups}

Take a PostgreSQL custom-format dump before schema changes. Use a private destination on storage independent of the application volume. Restore it into a separate database and run the application checks there.

```bash
umask 077
docker compose exec -T postgres pg_dump -U platform -Fc platform > platform-before-update.dump
docker compose exec -T postgres pg_restore --list < platform-before-update.dump
```

## Monitoring {#monitoring}

- **Readiness.** Monitor the public `/api/health` endpoint and the API container's health check.
- **Logs.** Inspect recent startup and application events with `docker compose logs --tail 100 api migrate`.
- **Metrics.** Titan Metrics records application measurements. To expose its text format to a scraper, register and authorize an HTTP route that calls `getPrometheusText()`. [Titan Metrics](../titan/modules/metrics.mdx)

## What you have deployed {#what-youve-shipped}

The portal calls Netron through a single HTTPS origin. The API reads PostgreSQL, validates the session and applies role requirements. Database migrations and their history survive replacing the application containers.

## Where to go from here {#where-to-go-from-here}

- [Run application processes under supervision](../omnitron/overview.md)
- [Inspect a project in Console](../omnitron/console.md)
- [Operate a fleet of nodes](../omnitron/cluster.md)
- [Check production readiness](../deployment/production-readiness.md)

## Commit {#commit}

```bash
git add .
git commit -m "step 6: docker deploy + caddy TLS"
git tag v0.1.0
```

## Congratulations {#congratulations}

You have exercised the same API from a service, a browser and a deployed portal. The [reference](../intro.md) links to the contracts behind each step.
