---
sidebar_position: 2
title: Glossary
---

# Glossary

**Application** — The root Titan object created by `Application.create`.
Owns the DI container, the Netron transports, and the lifecycle.

**Container** — The DI registry that resolves and caches providers.
One per application by default.

**Descriptor** — Typed metadata about a `@Service` (name, version,
methods, parameter schemas). What `queryInterface<T>()` resolves
against.

**FailureTracker** — A primitive that suppresses log spam during
repeated failures (used in `titan-lock`, `titan-pm`).

**Module** — A unit of composition. Declares providers, imports, and
exports.

**Netron** — Titan's transport-agnostic RPC plane. Same service
surface over HTTP, WS, TCP, Unix.

**Orchestrator** — The Omnitron supervisor's runtime. Manages process
lifecycles for a stack of services.

**Provider** — A class the container can instantiate. Marked
`@Injectable()` (or implied by `@Service`).

**Service** — A class marked `@Service('name@version')`. Public
methods are exposed over Netron.

**Stack** — A group of services supervised together by the
orchestrator. Declared in `omnitron.yaml`.

**Tier** — Cache eviction strategy: `lru`, `lfu`, `ttl`, `redis-lru`.

**Transport** — A wire format Netron speaks: HTTP, WebSocket, TCP,
Unix. Each transport is independently opt-in.
