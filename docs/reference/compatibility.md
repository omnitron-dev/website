---
title: Compatibility and status
description: Runtime requirements, package boundaries, versioning, and the distinction between implemented APIs and design proposals.
---

# Compatibility and status

Use the package manifests for exact dependency ranges. The table below
describes the current source tree; pin the versions you deploy.

| Surface | Requirement or boundary |
| --- | --- |
| Titan and Omnitron | Node.js 22 or newer, ESM |
| Source workspace | pnpm 12.16.1; use the version in the root `packageManager` field |
| TypeScript applications | Legacy decorators and decorator metadata; see the [quickstart](../getting-started/quickstart.md) |
| Browser RPC | `netron-browser`; HTTP and WebSocket, independent of the UI framework |
| React integration | `netron-react` and Prism; consult their `peerDependencies` for React and UI dependencies |
| Other runtimes | [Cross-runtime tests](../testing/cross-runtime.md) cover selected packages; they do not establish daemon support on Bun or Deno |
| Daemon IPC | Unix sockets; validate your operating system and deployment target before adopting the daemon |
| Infrastructure provisioning | Docker for container-backed infrastructure; [bare-metal](../deployment/bare-metal.md) has separate requirements |
| Documentation site | A separate Docusaurus project with its own manifest, lockfile and TypeScript version |

## Implemented API versus design

The module references document exported APIs. **Design RFC** callouts mark
proposed composition or application-level behaviour. The
[authorisation section](../auth/index.md) includes such designs; it is not
a switch that installs a complete permissions system.

The daemon defines `admin`, `operator` and `viewer` operator roles. Access is
checked against each method's explicit role list. Control-plane credentials
use a separate service identity. See [Auth & RBAC](../omnitron/auth-rbac.md)
for the boundaries; applications define their own end-user roles.

## Versioning

Omnitron is pre-1.0. A minor release can change a public contract.
Before upgrading:

1. Read the [changelog](../community/changelog.md) and relevant migration guide.
2. Commit the package lockfile and build from that exact dependency graph.
3. Compile both server and client against the intended contract.
4. Exercise a real RPC call, authentication and your recovery procedure.
5. Keep the previous application artifact and a database recovery plan.

A shared type catches incompatible code during compilation. It cannot
prevent an older, already deployed client from calling a newer server.
Plan backward compatibility or a coordinated rollout for that case.

## Reporting a compatibility problem

Include the package version, Node.js version, operating system, transport,
compiler configuration and a small reproduction in an
[issue](https://github.com/omnitron-dev/omni/issues).
