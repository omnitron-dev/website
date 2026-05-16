---
sidebar_position: 3
title: Changelog
description: Versioning policy + how to find release notes per package.
---

# Changelog

## Where to find release notes

Each package versions independently and publishes its own
changelog. Release notes live in three places:

1. **GitHub Releases** —
   [github.com/omnitron-dev/omni/releases](https://github.com/omnitron-dev/omni/releases).
   One entry per release across the monorepo; lists every
   package version bumped and what changed.

2. **`CHANGELOG.md` per package** — committed to the repo, e.g.,
   `packages/titan-cache/CHANGELOG.md`. Maintained by
   [Changesets](https://github.com/changesets/changesets).

3. **npm versions** — `pnpm view @omnitron-dev/titan versions`
   for the version history of any package.

## Versioning policy

We follow **strict semver**:

| Bump | When |
| ---- | ---- |
| **MAJOR** (`1.0.0 → 2.0.0`) | Any breaking change to the public API. Includes: removed exports, renamed methods, changed method signatures, behaviour changes that break valid prior code. |
| **MINOR** (`1.0.0 → 1.1.0`) | New feature or non-breaking improvement. New module, new option with a safe default, performance improvement. |
| **PATCH** (`1.0.0 → 1.0.1`) | Bug fix. No API change. |

### Pre-1.0 exception

Packages with version `0.x.y` may have breaks in minor versions
(`0.1.0 → 0.2.0` may break). Once a package hits `1.0.0`, full
semver applies.

This matches semver's [definition](https://semver.org/#spec-item-4)
for pre-1.0 packages.

### Per-package versioning

Each `@omnitron-dev/*` package versions independently. This means:

- `titan` can be at v1.2.0 while `titan-cache` is at v0.8.4.
- Upgrading one package doesn't force upgrading others — as
  long as peer-dependency ranges are satisfied.
- Breaking change in `titan-cache` doesn't bump `titan`'s
  version.

Peer-dependency relationships make this manageable; each module
declares which `titan` versions it supports.

## Support windows

We aim for:

- **Current major**: full support — bug fixes, security
  patches, new features.
- **Previous major**: security fixes only for **12 months**
  after the next major's release.
- **Older majors**: unsupported; upgrade.

Pre-1.0 packages are best-effort.

## Breaking change communication

Breaking changes get:

1. **A deprecation warning** in the previous minor release (at
   least one).
2. **Documentation** of the migration path in the release
   notes.
3. **A migration guide** for substantial changes.

We aim to avoid surprise breaks. If you depend on undocumented
internals, expect them to break without notice.

## Release cadence

Roughly:

- **Patch releases**: as needed (often weekly across the
  monorepo).
- **Minor releases**: 2–4 per quarter per actively-developed
  package.
- **Major releases**: 1–2 per year per package, more for early
  packages.

There is no fixed schedule — releases ship when they're ready.

## Upgrade guides

When a major version requires non-trivial migration, an upgrade
guide is added to the docs:

| From → To | Guide |
| --------- | ----- |
| *(none yet — published once first major upgrades land)* | |

For specific packages, the package's `CHANGELOG.md` has the
detail.

## Subscribe to releases

| Channel | URL |
| ------- | --- |
| GitHub Releases RSS | https://github.com/omnitron-dev/omni/releases.atom |
| Watch the repo | github.com/omnitron-dev/omni → Watch → Custom → Releases |
| npm package | `npm info @omnitron-dev/<pkg>` |
| Blog | [/blog](/blog) (significant releases get a post) |

## See also

- [Contributing / Release process](./contributing.md#release-process)
- [Security policy](./security.md) — security-fix SLA
- [Packages](../reference/packages.md) — per-package index
