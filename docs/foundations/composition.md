---
title: Composition and build boundaries
description: Select small primitives first, then add transports, user interfaces and infrastructure deliberately.
---

# Composition and build boundaries

Choose packages by responsibility. A shared domain policy should run without a
server container; a browser component should not import database or JWT code.
Keep application catalogs, business invariants and data ownership in the
application. Add framework adapters at the boundary that needs them.

| Need | Smallest relevant surface | Add when required |
| --- | --- | --- |
| Roles and permission decisions | `@omnitron-dev/access` | Platform preset, session verifier, resource adapters |
| Browser RPC | `@omnitron-dev/netron-browser/client` | React bindings and devtools |
| React interface primitives | `@omnitron-dev/prism/ui` | Maps, editors, knowledge graphs and their CSS entry points |
| Service process and DI | `@omnitron-dev/titan/application` | Authentication, database, cache and other modules |
| Object bytes | `@omnitron-dev/titan-storage` | Application metadata, quotas, ownership and sharing |
| Process supervision | `@omnitron-dev/omnitron` | Deployment, telemetry and operational workflows |

## Keep policy portable

Place a role definition and permission catalog in a shared application package.
The server uses it for enforcement; the UI uses it for affordances. A token
issuer and verifier use the same expansion. Separate rank from inheritance so
independent capabilities do not become a single ladder. The
[access policy guide](../auth/access-policy.md) contains the runnable primitives.

Adapters translate authenticated context and domain state into that policy.
They own tenant isolation, transaction boundaries, cache invalidation and
failure behavior. A failed lookup must not accidentally produce an unrestricted
permission set. Do not make application service names or schemas framework defaults.

## Keep expensive features behind an import boundary

Import Prism UI primitives from `/ui`. Load a map, research editor or knowledge
graph from its own public entry point where that feature is used. Import its
stylesheet explicitly. The [Prism guide](../frontend/prism/index.md) and
[API index](../reference/api-index.mdx) list supported paths.

Use `import type` for shared contracts. Avoid a shared barrel that re-exports
both browser policy and Node adapters: evaluating that barrel can pull server
code into a browser build. A package manifest's `exports` is the supported
boundary; a source directory is not automatically a public import path.

## Verify the artifact

A typecheck proves type compatibility. Also build the actual browser and server
entry points, inspect their contributing modules and test the packed package in
consumers. Measure isolated fixtures and whole application chunks separately.
Keep a regression budget for small primitives and confirm tree shaking rather
than assuming that `sideEffects: false` guarantees every consumer's bundle.

Use workspace dependencies during framework development. For a consumer before
registry publication, a checked-in package archive with a content digest and
lockfile is portable across machines. A local absolute symlink is a development
convenience, not a reproducible release dependency.
