---
title: Component CLI
description: Initialise, inspect, copy and maintain Prism components with the shipped CLI.
---

# Component CLI

The `prism` binary ships with `@omnitron-dev/prism`. Use package imports
for components you want to update with the library. Use the CLI when you
want a local copy whose source your application owns.

From a project with Prism installed:

```bash
pnpm exec prism init
pnpm exec prism list --components
pnpm exec prism add card
pnpm exec prism doctor
```

The commands are `init`, `add`, `remove`, `list`, `diff`, `update` and
`doctor`. Component names are arguments to `add`; `component` is not an
intermediate subcommand.

## Command reference

| Command | Purpose | Useful options |
| --- | --- | --- |
| `init` | Initialise project configuration | `--defaults`, `--yes`, `--cwd` |
| `list` | Inspect available items | `--components`, `--blocks`, `--category`, `--json` |
| `add [components...]` | Copy selected items | `--all`, `--path`, `--install`, `--overwrite`, `--cwd` |
| `diff [components...]` | Compare local items with the registry | `--cwd` |
| `update [components...]` | Update copied items | `--all`, `--overwrite`, `--yes`, `--cwd` |
| `remove <components...>` | Remove installed items | `--force`, `--yes`, `--cwd` |
| `doctor` | Diagnose the project's setup | `--cwd` |

Run `pnpm exec prism <command> --help` for the exact options in the version
installed in your lockfile.

## Work with local changes

Commit or otherwise preserve local modifications before updating copied
components. Inspect `diff` first. `--overwrite` allows replacement of
modified files; `remove --force` allows removal even when an installed
item was modified. Those flags are explicit decisions about your source.

`add --install` also installs the selected item's npm dependencies.
Review the package and lockfile diff together with the copied source.

## Programmatic use

`@omnitron-dev/prism/cli` exports `createCli`, `cli`, command factories,
`PRISM_VERSION`, `DEFAULT_CONFIG` and the configuration types. This is a
Node.js entry point. Keep it out of a browser application's import graph.

For the component APIs themselves, use the
[component catalogue](./components.md), [blocks](./blocks.md) and
[layouts](./layouts.md). The [API index](../../reference/api-index.mdx)
lists declared package entry points.
