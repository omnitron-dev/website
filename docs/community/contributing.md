---
sidebar_position: 1
title: Contributing
---

# Contributing

Omnitron is an open monorepo at <https://github.com/omnitron-dev/omni>.

## Setup

```bash
git clone https://github.com/omnitron-dev/omni
cd omni
pnpm install
pnpm build
pnpm test
```

The repo uses pnpm workspaces and Turborepo. Building one package
implicitly builds its workspace dependencies.

## Working in a single package

```bash
cd packages/titan-cache
pnpm dev          # tsup --watch
pnpm test --watch
```

## Tests

Three layers:

- **Unit** — `vitest` per package.
- **Integration** — `pnpm test:up` brings up the docker-compose
  fixture (Postgres, Redis, MinIO).
- **E2E** — Playwright for UI packages (`prism`, `omnitron/webapp`).

## Style

- TypeScript strict mode is non-negotiable.
- ESLint config is in `eslint.config.cjs`. `pnpm lint:fix` autofixes.
- Prettier formatting via `pnpm fm:fix`.

## PR conventions

- Small, single-purpose PRs.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
  `chore:`).
- A bug fix gets a regression test.
- A new module gets a doc page in `internal/website/docs/`.

## Code of conduct

Be patient with reviewers. Be patient with contributors. Read
`CODE_OF_CONDUCT.md` if it exists; if it doesn't, the same applies.
