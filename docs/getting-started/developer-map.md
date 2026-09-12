---
title: Developer map
description: Direct routes from a development task to the guide, API reference and verification step.
---

# Developer map

Choose the task you are doing now. Each route connects a working guide to
the reference needed when the application becomes more complex.

## Build a backend

| Task | Guide | Verify |
| --- | --- | --- |
| Start a service | [Quickstart](./quickstart.md) · [Lifecycle](../titan/application/lifecycle.md) | Compile, make one RPC call, stop cleanly |
| Organise dependencies | [Module system](../titan/modules-system/defining-modules.md) · [DI](../titan/di/overview.md) | Resolve the graph and test overrides |
| Store data | [Database](../titan/modules/database.mdx) | Run migrations and test transaction rollback |
| Authenticate calls | [Token issuance](../auth/token-issuance.md) · [RPC auth](../titan/netron/authentication.md) | Test missing, expired and insufficient credentials |
| Isolate tenants | [Context guards](../titan/modules/rls.md) · [Database](../titan/modules/database.mdx) | Attempt a cross-tenant read and write |
| Coordinate work | [Locks](../titan/modules/lock.mdx) · [Scheduler](../titan/modules/scheduler.mdx) | Test lock loss, overlapping jobs and shutdown |
| Recover from dependencies | [Resilience](../titan/resilience/overview.md) | Exercise timeout, exhaustion and recovery |

## Build an interface

| Task | Guide | Verify |
| --- | --- | --- |
| Call RPC from any UI | [Browser client](../frontend/netron/browser.md) | Connect, call, handle a typed error, disconnect |
| Query from React | [React bindings](../frontend/netron/react.md) · [Caching](../frontend/netron/caching.md) | Loading, empty, error, mutation and invalidation |
| Compose a screen | [Prism components](../frontend/prism/components.md) · [Layouts](../frontend/prism/layouts.md) | Keyboard navigation and narrow viewport |
| Capture input | [Forms](../frontend/prism/forms.md) | Client validation and server rejection |
| Persist preferences | [State](../frontend/prism/state.md) · [Theme](../frontend/prism/theme.md) | Hydration and a persisted-state migration |
| Call a REST endpoint | [HTTP client](../frontend/prism/http.md) | Cancellation and explicit retry policy |
| Adapt component source | [Prism CLI](../frontend/prism/cli.md) | Review copied code and registry diff |
| Validate accessibility | [Accessibility](../frontend/prism/accessibility.md) | Focus, labels, both themes and zoom |

## Test and operate

| Task | Guide | Verify |
| --- | --- | --- |
| Test a module | [Testing](../testing/index.md) · [Test helpers](../testing/testing-package.md) | Await cleanup; isolate state and storage |
| Supervise applications | [Operations](../omnitron/overview.md) · [Configuration](../omnitron/configuration.md) | Health, restart and shutdown behaviour |
| Ship a release | [Release lifecycle](../omnitron/releases.md) | Build, gate, deploy, attest and rehearse rollback |
| Diagnose a deployment | [CLI](../omnitron/cli.md) · [Observability](../omnitron/observability.md) | Inspect the actual runtime and its diagnostic findings |
| Prepare production | [Readiness](../deployment/production-readiness.md) | Exercise failure and recovery procedures |

## Find the exact API

Use the [package index](../reference/packages.md) to choose a dependency
and the [API index](../reference/api-index.mdx) to find an export or import
path. The [module map](../titan/modules/module-map.mdx) explains composition.
The [glossary](../reference/glossary.md) resolves terminology.

Pages marked **Design RFC** describe application architecture that requires
additional implementation. Read the shipped module reference before
adopting an RFC's code shape.
