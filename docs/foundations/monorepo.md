---
sidebar_position: 3
title: Monorepo Layout
---

# Monorepo Layout

The Omnitron source tree at <https://github.com/omnitron-dev/omni>.

```text
omni/
├── apps/
│   └── omnitron/                 # The supervisor app + CLI
│       └── webapp/               # Web console (separate workspace)
├── packages/
│   ├── titan/                    # Backend framework (core)
│   ├── titan-auth/               # JWT authentication
│   ├── titan-cache/              # Multi-tier caching
│   ├── titan-database/           # Kysely + migrations
│   ├── titan-discovery/          # Service discovery
│   ├── titan-events/             # Event bus
│   ├── titan-health/             # Health checks
│   ├── titan-lock/               # Distributed locks
│   ├── titan-metrics/            # Counters, gauges, histograms
│   ├── titan-notifications/      # Multi-channel notifications
│   ├── titan-pm/                 # Process manager
│   ├── titan-ratelimit/          # Rate limiting
│   ├── titan-redis/              # Redis client
│   ├── titan-scheduler/          # Cron + intervals + timeouts
│   ├── titan-telemetry-relay/    # Store-and-forward telemetry
│   ├── prism/                    # Design system
│   ├── netron-browser/           # Browser RPC client
│   ├── netron-react/             # React hooks
│   ├── common/                   # Shared utilities
│   ├── cuid/                     # Unique IDs
│   ├── eventemitter/             # Sync/async emitter
│   ├── msgpack/                  # Extendable MessagePack
│   ├── testing/                  # Cross-runtime test utils
│   └── kb/                       # Knowledge base framework
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Workspace boundaries

`pnpm-workspace.yaml` declares three workspace globs:

```yaml
packages:
  - apps/*
  - apps/omnitron/webapp
  - packages/*
```

The web console is registered explicitly because it lives inside the
`omnitron` app's tree but is its own workspace.

## Build orchestration

`turbo.json` declares the dependency graph between package builds. A
typical command:

```bash
pnpm build       # turbo build + turbo build:titan
pnpm test        # turbo test
pnpm lint        # eslint across apps/ + packages/
```

## Package independence

Every package in `packages/` ships independently. A consumer pulls in
only what they need; nothing in `@omnitron-dev/titan` imports
`@omnitron-dev/prism` or vice versa.

The Titan modules (`titan-*`) all depend on `@omnitron-dev/titan` itself
but are independent of each other. You can use `titan-cache` without
ever touching `titan-database`.

## Internal symlinks

The repo uses an `internal/` directory of symlinks for cross-project
references during local development:

```text
omni/internal/
├── daos/      → /Users/.../dao/daos
├── holon/     → /Users/.../oldman/uhm-theory/holon
├── verum/     → /Users/.../oldman/verum-lang/verum
└── website/   → /Users/.../luxquant/omnitron-dev/website
```

These symlinks are developer-local; nothing in the published packages
depends on them.
