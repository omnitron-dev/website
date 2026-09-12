---
sidebar_position: 1
title: Introduction
description: Choose the Omnitron layers you need, understand their boundaries, and build your first service.
---

# Build the system you control

Omnitron is a TypeScript stack for building and operating services. **Titan**
provides the application runtime. **Netron** connects services and clients.
**Prism** supplies React interface components. The **Omnitron supervisor**
manages applications and infrastructure.

Start with a Titan application. Add the client, interface and supervision
layers when your system needs them.

## Choose a starting point

| Your goal | Start here | What you will produce |
| --- | --- | --- |
| Run your first service | [Quickstart](./getting-started/quickstart.md) | A compiled application and a typed HTTP client |
| Understand the boundaries | [Titan vs Omnitron](./foundations/titan-vs-omnitron.md) | A decision about runtime and supervision |
| Build a complete application | [Tutorial](./tutorial/index.md) | A backend, authentication, interface and tests |
| Connect an existing interface | [Browser client](./frontend/netron/browser.md) | HTTP calls or WebSocket connections |
| Prepare a deployment | [Production readiness](./deployment/production-readiness.md) | A release and recovery plan |
| Find an API | [API index](./reference/api-index.mdx) | A symbol, supported import path, guide and implementation |

Use the [developer map](./getting-started/developer-map.md) for task-based
routes through the manual, including a verification step for each route.

## The stack

| Layer | Package | Boundary |
| --- | --- | --- |
| Runtime | `@omnitron-dev/titan` | Dependency injection, modules, lifecycle, validation, logging and server-side Netron |
| Browser client | `@omnitron-dev/netron-browser` | HTTP and WebSocket RPC; independent of the UI framework |
| React bindings | `@omnitron-dev/netron-react` | Providers and typed query, mutation and subscription hooks |
| Interface | `@omnitron-dev/prism` | React components, layouts, themes and forms |
| Operations | `@omnitron-dev/omnitron` | Daemon, process supervision, infrastructure, CLI, web console and MCP |

Server-side Netron ships inside Titan. A Titan process can run directly under
Node.js; installing the Omnitron supervisor is optional. Prism and the React
bindings are also optional. See the [architecture](./foundations/architecture.md)
for the runtime relationships.

## Contracts across the wire

A client can import a service's TypeScript type and call its methods through a
Netron proxy. Sharing that type catches incompatible calls **when both sides
compile against the same contract**. It does not synchronise independently
deployed versions or validate an arbitrary request at runtime.

Use [validation](./titan/validation/overview.md) for untrusted inputs,
[authentication](./titan/netron/authentication.md) for access control and
[service versioning](./titan/netron/services.md) when contracts evolve.
The [quickstart](./getting-started/quickstart.md) shows the complete registration
and transport setup.

## Add capabilities deliberately

Titan modules are separate packages. Their dependency and lifecycle contracts
are documented alongside their configuration.

| Capability | Reference |
| --- | --- |
| Persistence, migrations, transactions and RLS | [Database](./titan/modules/database.mdx) |
| JWT verification and token transport | [Authentication](./titan/modules/auth.mdx) · [Token issuance](./auth/token-issuance.md) |
| Caching and distributed coordination | [Cache](./titan/modules/cache.mdx) · [Redis](./titan/modules/redis.mdx) · [Locks](./titan/modules/lock.mdx) |
| Background work | [Scheduler](./titan/modules/scheduler.mdx) · [Process management](./titan/modules/pm.mdx) |
| Operational signals | [Health](./titan/modules/health.mdx) · [Metrics](./titan/modules/metrics.mdx) |
| A complete module inventory | [Module map](./titan/modules/module-map.mdx) |

## Read implementation status before adopting a design

The module and API references describe shipped code. Pages labelled
**Design RFC** describe architectural proposals and application patterns that
may need your own implementation. In particular, the
[authorisation design](./auth/index.md) goes beyond the daemon's
[operator roles](./omnitron/auth-rbac.md).

The project is pre-1.0. Pin package versions, read the
[release notes](./community/changelog.md), and test server/client combinations
before upgrading. See [compatibility](./reference/compatibility.md) for runtime
requirements and support boundaries.

## Work from source

The framework, packages and supervisor live in the
[Omnitron repository](https://github.com/omnitron-dev/omni). This manual has its
own [documentation repository](https://github.com/omnitron-dev/website).
Both use the MIT license. See [Contributing](./community/contributing.md)
for reproducible setup and verification commands.
