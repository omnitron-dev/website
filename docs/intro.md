---
id: "intro"
slug: "/docs/intro"
sidebar_position: 1
title: Introduction
description: Meet the privacy-first, self-hosted full-stack platform and follow its path from application code to operation.
---

# Build the system you control

Omnitron is an open-source, **self-hosted full-stack platform** for engineers
who want control over both their software and its operation. Build the backend,
connect services, create the interface, publish documentation and manage the
machines that run it — within infrastructure and access boundaries you choose.

**Privacy and operational independence are the starting point.** Running the
platform does not require an Omnitron cloud account or a vendor-hosted control
plane. Application data and operational records go to your configured storage.
The [privacy and ownership guide](./foundations/privacy.md) explains the actual
data flows, external connections and responsibilities.

The name has two scopes: **Omnitron the platform** is the full stack described
here; **the Omnitron supervisor** is its operations layer. A Titan application
can run without the supervisor. You can adopt individual packages or use the
complete system.

## Choose a starting point {#choose-a-starting-point}

- **Build a service.** Compile a Titan service and call it over HTTP in the [quickstart](./getting-started/quickstart.md). To add authentication, a React interface and tests, follow the [application tutorial](./tutorial/index.md).
- **Operate your own infrastructure.** Trace a request from Console to a supervised process in the [node architecture explorer](./omnitron/architecture.md). The [privacy guide](./foundations/privacy.md) shows where data travels and which connections you control.
- **Create a project or work with agents.** Choose Xec, Kysera or a supervised service in the [project starter](./omnitron/projects.md#choose-a-project). Connect local adapters and share work in an [Agent Studio room](./omnitron/studio.md#team-room).
- **Automate a host.** Draw and preview a working [disk-space flow](./omnitron/flows.md#disk-space), then review the actions your controller can take.
- **Look up a contract.** The [API index](./reference/api-index.mdx) links package exports to the matching declarations. The [developer map](./getting-started/developer-map.md) pairs common tasks with a way to verify them.

## The stack {#the-stack}

| Layer | Package | Boundary |
| --- | --- | --- |
| Runtime | `@omnitron-dev/titan` | Dependency injection, modules, lifecycle, validation, logging and server-side Netron |
| Browser client | `@omnitron-dev/netron-browser` | HTTP and WebSocket RPC; independent of the UI framework |
| React bindings | `@omnitron-dev/netron-react` | Providers and typed query, mutation and subscription hooks |
| Interface | `@omnitron-dev/prism` | React components, layouts, themes and forms |
| Documentation | `@omnitron-dev/lumen` | Static publishing, local search, interactive examples and machine-readable documents |
| Operations | `@omnitron-dev/omnitron` | Daemon, process supervision, infrastructure, CLI, web console and MCP |

Server-side Netron ships inside Titan. A Titan process can run directly under
Node.js; installing the Omnitron supervisor is optional. Prism and the React
bindings are also optional. See the [architecture](./foundations/architecture.md)
for the runtime relationships.

## Contracts across the wire {#contracts-across-the-wire}

A client can import a service's TypeScript type and call its methods through a
Netron proxy. Sharing that type catches incompatible calls **when both sides
compile against the same contract**. It does not synchronise independently
deployed versions or validate an arbitrary request at runtime.

Use [validation](./titan/validation/overview.md) for untrusted inputs,
[authentication](./titan/netron/authentication.md) for access control and
[service versioning](./titan/netron/services.md) when contracts evolve.
The [quickstart](./getting-started/quickstart.md) shows the complete registration
and transport setup.

## Add capabilities deliberately {#add-capabilities-deliberately}

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

## Read implementation status before adopting a design {#read-implementation-status-before-adopting-a-design}

The module and API references describe shipped code. Pages labelled
**Design RFC** describe architectural proposals and application patterns that
may need your own implementation. In particular, the
[authorisation design](./auth/index.md) goes beyond the daemon's
[operator roles](./omnitron/auth-rbac.md).

The project is pre-1.0. Pin package versions, read the
[release notes](./community/changelog.md), and test server/client combinations
before upgrading. See [compatibility](./reference/compatibility.md) for runtime
requirements and support boundaries.

## Work from source {#work-from-source}

The framework, packages and supervisor live in the
[Omnitron repository](https://github.com/omnitron-dev/omni). This manual has its
own [documentation repository](https://github.com/omnitron-dev/website).
Both use the MIT license. See [Contributing](./community/contributing.md)
for reproducible setup and verification commands.
