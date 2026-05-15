---
sidebar_position: 1
title: Introduction
description: Omnitron — what it is, what it gives you, and how the pieces fit together.
---

# Introduction

**Omnitron** is a unified TypeScript stack for building, shipping, and operating
real systems. It is one toolchain across the full path from request handler to
running fleet:

| Layer            | Package                                | Purpose                                                   |
| ---------------- | -------------------------------------- | --------------------------------------------------------- |
| Backend framework| `@omnitron-dev/titan`                  | Decorator DI, lifecycle, validation, structured logging   |
| RPC plane        | `titan/netron` + `@omnitron-dev/netron-browser` | Transport-agnostic RPC across HTTP, WS, TCP, Unix |
| Frontend hooks   | `@omnitron-dev/netron-react`           | Type-safe React hooks driven by the service signatures    |
| Design system    | `@omnitron-dev/prism`                  | Tokens, layouts, blocks, forms, accessibility scaffolding |
| Operate          | `@omnitron-dev/omnitron`               | Application supervisor, CLI, web console                  |

The point is not "another framework". The point is that **every layer reuses the
same primitives**: a service signature on the server is the same TypeScript
type the React hook resolves to in the browser. A module declared with the
Titan DI grammar runs unchanged whether it's an in-process service or a
process supervised by Omnitron. There is no codegen step between the layers.

## Three claims

1. **One stack, end-to-end TypeScript.** The contract between server and
   client is the service interface itself. Refactor a method signature and
   the build fails on every caller — server, client, console, CLI.

2. **Pay only for what you use.** Each Titan module is opt-in. Each Netron
   transport is opt-in. Prism blocks are imported individually. The base
   framework does not ship a runtime that you cannot remove.

3. **Operate from the same primitives you developed in.** The Omnitron CLI
   talks to running Titan apps over the same Netron protocol your frontend
   uses. The web console aggregates dashboards over the same metrics module
   your services emit to.

## Where to go next

- [Installation](./getting-started/installation.md) — install Titan, scaffold a project.
- [Quickstart](./getting-started/quickstart.md) — service → module → app → client in five minutes.
- [Architecture](./foundations/architecture.md) — how the layers compose.
- [Titan overview](./titan/overview.md) — the backend framework in depth.
- [Frontend overview](./frontend/overview.md) — Prism + Netron React.
- [Omnitron app](./omnitron/overview.md) — the supervisor, CLI, and console.
