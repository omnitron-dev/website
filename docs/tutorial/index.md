---
sidebar_position: 1
title: Overview
description: A 6-step tutorial — from empty folder to deployed app.
---

# Tutorial — from zero to deployed

A pragmatic 6-step walkthrough. Each step adds one layer of the
stack and ends with a working artefact you can commit.

By the end you'll have:
- A Titan backend with auth + database.
- A React + Prism + netron-react frontend.
- Tests across unit / integration / E2E.
- A production-ready Docker deploy.

## The steps

| Step | What you build | Time |
| ---- | -------------- | ---- |
| [1. Scaffold](./01-scaffold.md) | Empty monorepo → first Titan app saying hello | 10 min |
| [2. Service](./02-service.md) | A typed RPC service backed by a real database | 20 min |
| [3. Auth](./03-auth.md) | JWT sign-in, sessions, role-gated methods | 25 min |
| [4. Frontend](./04-frontend.md) | React + Prism + netron-react UI calling your service | 30 min |
| [5. Tests](./05-tests.md) | Unit / module / integration / E2E coverage | 25 min |
| [6. Deploy](./06-deploy.md) | Docker Compose stack to a server | 30 min |

Total: ~2.5 hours from cold start.

## Conventions

- Code blocks are runnable as-is. Copy and replace placeholders
  marked `<like this>`.
- Each step starts from where the previous one ended.
- The final code lives at `apps/api/` + `apps/web/` in your
  monorepo.

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for the deploy step)
- A code editor (VS Code recommended for TypeScript)

## What this tutorial assumes you know

- TypeScript at the level of "I've shipped a real app".
- React at the level of "useState + useEffect".
- A bit of SQL.
- Git basics.

What you **don't** need:

- DI experience (we'll introduce as needed).
- RPC frameworks (Netron will explain itself).
- Decorators (TypeScript-level, picked up by example).

## When you're done

You'll know how to:
- Define a Titan service and expose it over Netron.
- Use the DI container effectively.
- Wire authentication + RLS.
- Build a React UI with end-to-end types.
- Test at every layer.
- Ship to production.

Then deepen with the [reference docs](../intro.md) — every
module, every API, every recipe.

Ready? **[Step 1: Scaffold →](./01-scaffold.md)**
