---
id: "utilities/index"
slug: "/docs/utilities"
sidebar_position: 1
title: Overview
description: Choose a utility for promises, IDs, events, binary data or a searchable knowledge base.
---

# Utilities

These packages can be installed individually and share the Omnitron release version. Choose the one that fits your application.

| Task | Package | What it provides |
| --- | --- | --- |
| Coordinate asynchronous work | [Common](./common.md) | Promise helpers, bounded concurrency, type predicates and data structures |
| Generate a URL-safe identifier | [Cuid](./cuid.md) | Collision-resistant string IDs |
| Deliver an event inside a process | [EventEmitter](./eventemitter.md) | Listeners with parallel, serial and reduction modes |
| Encode a value for storage or transport | [MessagePack](./msgpack.md) | Binary serialization with registered extensions for additional types |
| Index a codebase for search | [KB](./kb.md) | Source extraction, indexing and queries |

## Where they're used {#where-theyre-used}

Titan Events uses EventEmitter for its event bus. Netron's packet serializer uses MessagePack for binary RPC. The Omnitron CLI exposes KB search and indexing to agents through `omnitron kb mcp`.

## Standalone use {#standalone-use}

To round-trip a value in a Node.js project, install the codec and import its two operations.

```bash
pnpm add @omnitron-dev/msgpack
```

```typescript
import { encode, decode } from '@omnitron-dev/msgpack';

const bytes = encode({ status: 'ready' });
const record = decode(bytes);
```

The package manager installs the codec's runtime dependencies, including Common. The [package index](../reference/packages.md) lists the other platform packages and their roles.
