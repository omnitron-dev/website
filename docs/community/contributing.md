---
sidebar_position: 1
title: Contributing
description: Dev setup, PR process, code style, release flow.
---

# Contributing

The stack is an open monorepo at
[github.com/omnitron-dev/omni](https://github.com/omnitron-dev/omni).
PRs welcome at every layer — module, framework, docs, examples.

## Dev environment

### Prerequisites

- Node.js 22+ (24 also tested in CI)
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker (for integration tests)
- A Unix-like shell (macOS / Linux). Windows works via WSL.

### Clone + bootstrap

```bash
git clone https://github.com/omnitron-dev/omni
cd omni
pnpm install
pnpm build
```

This builds every package in dependency order via Turborepo;
takes ~30–60 s cold, ~10 s warm.

### Run the test suite

```bash
pnpm test                          # all packages, unit + module
pnpm -F titan-cache test           # one package
pnpm -F titan-cache test --watch   # watch mode
pnpm test:integration              # docker-backed integration suite
pnpm test:e2e                       # Playwright (webapp + prism)
```

`pnpm test:integration` starts a Docker Compose stack with
Postgres + Redis + MinIO. First run pulls images; subsequent
runs reuse the containers.

### Run the docs site locally

```bash
cd internal/website
pnpm install
pnpm dev          # http://localhost:3000
```

## Workspace layout

```text
omni/
├── apps/
│   └── omnitron/            # supervisor + webapp + CLI
├── packages/
│   ├── titan/               # backend framework
│   ├── titan-*/             # 14 official modules
│   ├── netron-browser/      # browser RPC client
│   ├── netron-react/        # React hooks
│   ├── prism/               # design system
│   ├── common, cuid, …      # utilities
│   ├── kb/                  # knowledge base
│   └── testing/             # cross-runtime test helpers
├── internal/
│   └── website/             # docs site (Docusaurus)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Working on a single package

```bash
cd packages/titan-cache
pnpm dev          # tsup --watch — rebuilds on save
pnpm test --watch # vitest --watch
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

Changes in a dependent package surface through pnpm workspace
symlinks — you don't need to publish or `pnpm install` between
edits.

## Code style

### TypeScript

- **Strict mode is non-negotiable** — `strict`, `noImplicitAny`,
  `strictNullChecks`, all of them.
- **Decorator support required** —
  `experimentalDecorators` + `emitDecoratorMetadata`.
- **No `any` without comment.** If you must, write
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any — reason`.
- **`unknown` over `any`** for inputs.
- **Generics over union of overloads** when shape varies.
- **`type` for compositions, `interface` for extensible
  contracts** — but consistency within a file beats either.

### Formatting

ESLint + Prettier; configured at the workspace root:

```bash
pnpm lint           # check
pnpm lint:fix       # autofix
pnpm fm             # check formatting
pnpm fm:fix         # apply formatting
```

CI runs both on every PR.

### Imports

- **Named over default** — `import { foo } from './foo.js'` not
  `import foo from './foo.js'`.
- **Type-only imports** explicit — `import type { Foo } from
  './types.js'`.
- **`.js` extension in TS imports** — mandatory for ESM
  resolution.
- **Relative paths within a package**; **package names** across
  packages.

### Naming

- Classes: `PascalCase` — `UserService`, `TitanAuthModule`.
- Interfaces: `PascalCase` with `I` prefix for service contracts
  — `IUserService`. Plain `PascalCase` for non-contract types
  (e.g., `UserOptions`).
- Functions / methods: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for token-level globals;
  `camelCase` for local consts.
- File names: `kebab-case.ts`. One main export per file when
  possible.

### Comments

Default to **no comments**. Add when:

- The "why" is not obvious from the code.
- A workaround references a specific bug / version.
- An invariant must hold (document it inline).

Avoid:

- Comments restating what the code does.
- TODO / FIXME without a tracking issue.
- Commented-out code.

## Tests

### Coverage expectations

| Layer | Coverage |
| ----- | -------- |
| Public API | 90%+ |
| Internal helpers | 70%+ |
| Error paths | 100% (every `throw` has a test) |
| New module | requires tests at the same coverage as the rest of the package |

### Test categories

| Tier | What | Location |
| ---- | ---- | -------- |
| Unit | Plain class / function | `src/__tests__/*.test.ts` |
| Module | DI graph with mocks | `src/__tests__/*.test.ts` |
| Integration | Real Application + in-memory infra | `<package>/test/*.test.ts` |
| E2E | Real daemon / browser | `apps/omnitron/webapp/e2e/` |
| Cross-runtime | Node + Bun + Deno | per-package `test/cross/*.test.ts` |

See [Testing](../testing/index.md) for patterns.

### Writing a regression test

When you fix a bug:

1. Add a failing test reproducing the bug.
2. Apply the fix.
3. Test passes.
4. PR description references the issue.

Without a regression test, the bug returns within 6 months.

## PR process

### Before opening a PR

- Branch from `main`.
- Run `pnpm lint && pnpm fm && pnpm test` locally.
- For docs: `cd internal/website && pnpm build`.
- Commit with conventional-commits format:
  - `feat(titan-cache): add LFU eviction strategy`
  - `fix(omnitron): handle SIGTERM during stack start`
  - `docs(prism): expand <DataGridBlock> example`
  - `refactor(netron-browser): extract auth middleware`
  - `test(titan-auth): cover cnf.fp verification`
  - `chore(deps): bump zod`

### PR description template

```markdown
## What

Brief description of the change.

## Why

The motivation — a bug, a feature request, an architectural
improvement. Link the issue if there is one.

## How

Implementation summary if non-obvious. Skip if the diff is
self-explanatory.

## Verification

- [ ] Tests added / updated
- [ ] Docs updated (`internal/website/docs/...`)
- [ ] No breaking change OR breaking change documented in
      release notes
- [ ] CI green
```

### Code review

- Single-purpose PRs review faster.
- Maintainers may push small fixes (typos, formatting) directly
  to your branch.
- Comments use the Conventional Comments format
  (`nitpick:`, `suggestion:`, `question:`).
- "Approved with nits" is approval — the nits aren't blockers.

### Merging

We use **squash merge** for feature PRs (one commit per PR
into main). For multi-author refactors that benefit from
preserved history, **rebase and merge** is allowed.

The squashed commit message uses the PR title; ensure the title
follows conventional commits.

## Release process

### Versioning

Each package versions independently. We follow semver strictly:

- **MAJOR**: breaking change to public API (any export).
- **MINOR**: new feature, no breaks.
- **PATCH**: bug fix, no API change.

Pre-1.0 packages may have breaks in minor versions; documented
in release notes.

### Cutting a release

Maintainers run:

```bash
pnpm changeset                    # describe the change
pnpm changeset version            # bump versions per the changes
pnpm changeset publish            # publish to npm
git push --follow-tags
```

The `changeset` flow batches changes from multiple PRs into a
single release. PRs that need a version bump must include a
changeset file (`pnpm changeset`).

### Release notes

Each release publishes:

- GitHub Release with the auto-generated changelog.
- Updated package on npm.
- A blog post (for significant releases).

## Adding a new module

If you're building a new official module:

1. Read [Authoring a module](../titan/modules-system/authoring-modules.md).
2. Open an issue first to discuss scope + naming.
3. Implement following the conventions of existing
   `titan-*` packages.
4. Write the doc page in `internal/website/docs/titan/modules/`.
5. Wire into the cross-cutting refs (module-map, options-patterns,
   lifecycle-reference, tokens-reference, observability-matrix,
   security-checklist, errors-catalog, decorators-catalog).
6. Submit PR with full coverage.

Community modules don't go in the monorepo — publish under your
own scope (`@your-org/titan-*`) and link to it from
[Community modules](../titan/modules/community.mdx).

## Documentation contributions

The docs site at `internal/website/` is part of the monorepo.

Common doc PRs:

- **Typo / clarity fix** — go straight to PR.
- **New example** — add to the relevant module page or recipes.
- **New how-to** — propose in an issue first; the structure
  matters.

Run the docs locally:

```bash
cd internal/website
pnpm dev
```

Conventions:

- Sentence case for headings.
- Tables for option references.
- Mermaid diagrams for data flows / state machines.
- Code blocks with explicit language tag.
- Cross-references via relative `[Link](./path.md)` (Docusaurus
  validates them on build).

## Reporting bugs

[Open an issue](https://github.com/omnitron-dev/omni/issues/new)
with:

1. Affected package + version.
2. Minimal reproduction (StackBlitz link or repo).
3. Expected behaviour.
4. Actual behaviour.
5. Environment (Node version, OS).

Without a reproduction, the issue may be closed pending one.

## Requesting features

Open an issue tagged `feature-request` with:

1. The use case (what you're trying to do, not how).
2. Why the existing API doesn't fit.
3. A proposed API sketch if you have one.

Discussion happens on the issue; if accepted, a PR follows.

## Discussion

- **Architectural questions** — GitHub Discussions.
- **Bug reports** — Issues.
- **PR feedback** — on the PR itself.

## Code of conduct

Be kind. Be patient with reviewers. Be patient with contributors.
Assume good intent — most disagreements are about the same
goal from different angles.

See `CODE_OF_CONDUCT.md` in the repo root for the formal version.

## Help wanted

Issues tagged `help-wanted` are good first PRs.
[Browse them here](https://github.com/omnitron-dev/omni/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

For larger architectural work, comment on the issue first
to avoid duplicated effort.

## License

By contributing, you agree your contribution is licensed under
the project's MIT license.

## See also

- [Security policy](./security.md)
- [Architecture](../foundations/architecture.md)
- [Authoring a module](../titan/modules-system/authoring-modules.md)
- [Testing](../testing/index.md)
