---
id: "getting-started/project-structure"
slug: "/docs/getting-started/project-structure"
sidebar_position: 3
title: Project Structure
---

# Project Structure

A reference layout for a Titan-based project. The Omnitron monorepo itself
follows this shape; consumer projects do not need to be a monorepo to use
the same conventions.

## Single-app layout {#single-app-layout}

:::filetree{title="my-app/"}
- `src/`
  - `modules/`
    - `users/`
      - `users.service.ts`
      - `users.module.ts`
      - `users.types.ts`
    - `orders/`
  - `app.module.ts` — Root module that imports the rest
  - `main.ts` — Application.create + start
- `tsconfig.json`
- `package.json`
:::

## Monorepo layout {#monorepo-layout}

For multi-service projects, mirror the Omnitron monorepo:

:::filetree{title="my-monorepo/"}
- `apps/`
  - `api/` — Titan service exposed over HTTP/WS
  - `worker/` — Titan service exposed over TCP only
  - `web/` — React frontend (Prism + netron-react)
- `packages/`
  - `shared-types/` — Service interfaces shared by all apps
  - `shared-modules/` — Reusable Titan modules
- `pnpm-workspace.yaml`
- `turbo.json`
:::

### `pnpm-workspace.yaml` {#pnpm-workspaceyaml}

```yaml
packages:
  - apps/*
  - packages/*
```

### Sharing service types {#sharing-service-types}

Service interfaces should live in a shared package so both the server
implementation and the client `queryInterface<T>()` call see the same type:

:::filetree{title="packages/shared-types/"}
- `src/`
  - `users.contract.ts` — `interface UsersContract { … }`
  - `orders.contract.ts`
- `package.json`
:::

The server class implements the contract; the client parameterises
`queryInterface<UsersContract>()` against it.

## Configuration {#configuration}

Titan's `ConfigModule` reads from any combination of files, env vars, and
schema-validated overrides. A typical project:

:::filetree{title="my-app/"}
- `config/`
  - `default.yaml` — Defaults that apply everywhere
  - `development.yaml` — Local-dev overrides
  - `production.yaml` — Prod overrides
- `src/`
  - `app.module.ts` — Root module and configuration registration
:::

See [ConfigModule](../titan/modules/config.mdx) for configuration sources, validation and precedence.

## Conventions {#conventions}

- **Module per bounded context.** Group services, repositories, and
  schemas by domain, not by layer.
- **Contracts in a shared package.** Keep `*.contract.ts` files free of
  runtime imports so the browser bundle does not pull in the server.
- **One `main.ts` per app.** The root file boots `Application.create`;
  it should be the only entrypoint that performs side effects at import
  time.
