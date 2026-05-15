---
sidebar_position: 1
title: Package Index
---

# Package Index

Every package shipped from the `omni` monorepo, alphabetical.

## Backend framework

| Package                          | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `@omnitron-dev/titan`            | Core framework — DI, modules, lifecycle, Netron, validation |
| `@omnitron-dev/titan-auth`       | JWT authentication                                       |
| `@omnitron-dev/titan-cache`      | Multi-tier caching (LRU/LFU/TTL/Redis)                   |
| `@omnitron-dev/titan-database`   | Kysely + migrations + RLS                                |
| `@omnitron-dev/titan-discovery`  | Redis-backed service discovery                           |
| `@omnitron-dev/titan-events`     | In-process event bus                                     |
| `@omnitron-dev/titan-health`     | Health and readiness probes                              |
| `@omnitron-dev/titan-lock`       | Distributed Redis locks                                  |
| `@omnitron-dev/titan-metrics`    | Counters, gauges, histograms                             |
| `@omnitron-dev/titan-notifications` | Multi-channel notification delivery                   |
| `@omnitron-dev/titan-pm`         | Process manager / worker pools                           |
| `@omnitron-dev/titan-ratelimit`  | Token-bucket rate limiting                               |
| `@omnitron-dev/titan-redis`      | Redis client + clustering                                |
| `@omnitron-dev/titan-scheduler`  | Cron / interval / timeout scheduler                      |
| `@omnitron-dev/titan-telemetry-relay` | Store-and-forward telemetry                         |

## Frontend

| Package                          | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `@omnitron-dev/netron-browser`   | Browser Netron client (HTTP + WS)                        |
| `@omnitron-dev/netron-react`     | React hooks + cache + devtools                           |
| `@omnitron-dev/prism`            | Design system (tokens, layouts, blocks, forms)           |

## Application

| Package                          | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `@omnitron-dev/omnitron`         | Supervisor app, CLI, web console                         |

## Shared utilities

| Package                          | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `@omnitron-dev/common`           | Shared utility primitives                                |
| `@omnitron-dev/cuid`             | Collision-resistant unique IDs                           |
| `@omnitron-dev/eventemitter`     | Sync/async event emitter                                 |
| `@omnitron-dev/msgpack`          | Extendable MessagePack serializer                        |
| `@omnitron-dev/testing`          | Cross-runtime test utilities (Node, Bun, Deno)           |
| `@omnitron-dev/kb`               | Knowledge base / code intelligence framework             |
