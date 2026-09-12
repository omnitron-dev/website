---
sidebar_position: 1
title: Principles
description: Shared contracts, explicit composition, visible lifecycle, and operational accountability.
---

# Principles

Omnitron brings application code and operations into one TypeScript
toolchain. Its value depends on boundaries that a developer can inspect,
test and change.

## Share contracts

Netron clients can compile against service interfaces without generating a
client SDK. Keep those types in a shared package or use type-only imports.
Version the contract when independently deployed callers need different
behaviour.

A TypeScript signature is a compile-time constraint. At runtime, validate
inputs, authenticate callers and authorise each protected operation.
Serialization does not replace those checks.

## Compose explicitly

Declare providers, imports and exports in modules. Use injection tokens
where implementations vary. Configuration and logging are registered as
core modules by default; additional capabilities are opt-in.

Module dependencies still matter. A distributed lock needs Redis; a
database module needs a driver and a live connection. Read the
[module map](../titan/modules/module-map.mdx) before composing a system.

Titan supports optional filesystem discovery, but explicit module
registration makes startup dependencies easier to review.

## Make lifecycle observable

Services acquire resources during initialization and startup, then release
them during shutdown. Set timeouts and make shutdown safe for in-flight
work. Test failed startup and interrupted shutdown as well as the happy path.

The [lifecycle reference](../titan/application/lifecycle.md) describes
ordering. Avoid relying on the exact interleaving of unrelated providers.

## Separate runtime from supervision

A Titan application is a normal process. Use a process supervisor appropriate
to your deployment. Add Omnitron when you need its project model,
infrastructure management, release workflow or remote operations.

The CLI and web console use the daemon's RPC services. Operational access
has its own identity and permissions; sharing a transport does not grant
the same authority to every caller.

## Report what happened

Return typed errors, log enough context to diagnose failures, and keep
sensitive details out of public responses. Readiness, successful process
startup and a successful deployment are different claims. Verify each at
the layer that owns it.

For deployment practice, continue with
[Production readiness](../deployment/production-readiness.md).
