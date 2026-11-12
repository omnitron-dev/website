---
id: "foundations/monorepo"
slug: "/docs/foundations/monorepo"
sidebar_position: 3
title: Monorepo Layout
---

# Monorepo Layout

The Omnitron source tree at <https://github.com/omnitron-dev/omni>.

:::filetree{title="omni/"}
- `apps/`
  - `omnitron/` — Supervisor, CLI and control plane
    - `webapp/` — Console, registered as its own workspace
- `packages/`
  - `titan/` — Application lifecycle, dependency injection and Netron core
  - `titan-auth/` — Authentication
  - `titan-cache/` — Caching
  - `titan-database/` — Kysely integration and migrations
  - `titan-discovery/` — Service discovery
  - `titan-events/` — Event bus
  - `titan-health/` — Health indicators
  - `titan-lock/` — Distributed locks
  - `titan-lumen/` — Authorized document services and durable authoring
  - `titan-mailer/` — Email delivery
  - `titan-metrics/` — Metric collection and persistence
  - `titan-notifications/` — Notification channels
  - `titan-pm/` — Process management
  - `titan-ratelimit/` — Rate limiting
  - `titan-redis/` — Redis integration
  - `titan-scheduler/` — Scheduled tasks
  - `titan-storage/` — Storage contracts and adapters
  - `titan-telemetry-relay/` — Durable telemetry delivery
  - `prism/` — Shared React components and design system
  - `lumen/` — Documentation builds, CLI and static site generation
  - `lumen-ast/` — Document compiler and HTML, Markdown and Typst output
  - `lumen-ui/` — Document navigation and interactive components
  - `lumen-migrate/` — Documentation migration tools
  - `netron-browser/` — Browser RPC client
  - `netron-http-core/` — Shared HTTP transport contracts
  - `netron-protocol/` — Shared wire protocol
  - `netron-react/` — React RPC integration
  - `access/` — Shared access-control primitives
  - `common/` — Shared utilities
  - `cuid/` — Unique identifiers
  - `eventemitter/` — Synchronous and asynchronous events
  - `msgpack/` — MessagePack serialization
  - `testing/` — Test helpers and runtime adapters
  - `kb/` — Knowledge base tools
- `.xec/` — Repository and release commands
- `pnpm-workspace.yaml` — Workspace and dependency policies
- `turbo.json` — Task graph and cache configuration
- `package.json` — Repository entry points
:::

## Workspace boundaries {#workspace-boundaries}

`pnpm-workspace.yaml` declares three workspace globs:

```yaml
packages:
  - apps/*
  - apps/omnitron/webapp
  - packages/*
```

The web console is registered explicitly because it lives inside the
`omnitron` app's tree but is its own workspace.

## Build orchestration {#build-orchestration}

Xec orchestrates repository qualification and releases. Turbo supplies the
package task graph and build cache declared in `turbo.json`. Package scripts
remain available for focused development:

```bash
pnpm build       # turbo build + turbo build:titan
pnpm test        # turbo test
pnpm lint        # eslint across apps/ + packages/
```

## Package independence {#package-independence}

Every package in `packages/` ships independently. A consumer pulls in
only what they need; nothing in `@omnitron-dev/titan` imports
`@omnitron-dev/prism` or vice versa.

Titan modules declare their own dependencies and peer requirements. Select
the integrations an application needs; for example, `titan-cache` does not
require `titan-database`. See each package manifest for its exact contract.

