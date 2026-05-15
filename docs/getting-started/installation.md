---
sidebar_position: 1
title: Installation
---

# Installation

Omnitron is a multi-package monorepo published under the `@omnitron-dev/`
scope. Install only the layers you need.

## Prerequisites

- **Node.js ≥ 20** (Bun and Deno are also supported via `@omnitron-dev/testing`)
- **pnpm ≥ 8** (the monorepo uses pnpm workspaces; npm and yarn work for consumers)

## Install Titan

The backend framework. This is the only package required to start.

```bash
pnpm add @omnitron-dev/titan
```

## Add an RPC transport

Titan's Netron module bundles every transport, but you choose which one to
expose. For browser clients you'll typically want `netron-browser`:

```bash
pnpm add @omnitron-dev/netron-browser
```

## Add a frontend

For React applications:

```bash
pnpm add @omnitron-dev/netron-react @omnitron-dev/prism
```

## Add the Omnitron CLI (optional)

The application supervisor and CLI. Install globally to use as a process
manager across projects:

```bash
pnpm add -g @omnitron-dev/omnitron
```

Or use it as a dev dependency in your project:

```bash
pnpm add -D @omnitron-dev/omnitron
```

## Verify

```bash
node -e "console.log(require('@omnitron-dev/titan/package.json').version)"
```

Next: [Quickstart](./quickstart.md) — your first Titan service.
