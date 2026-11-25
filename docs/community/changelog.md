---
id: "community/changelog"
slug: "/docs/community/changelog"
sidebar_position: 3
title: Release notes
description: What shipped in Omnitron, where to find the matching source and how to plan an upgrade.
---

# Release notes

Omnitron 0.4.17 is available on npm. This manual follows the source at the release tag. [Tagged source](https://github.com/omnitron-dev/omni/tree/v0.4.17) · [Changelog](https://github.com/omnitron-dev/omni/blob/v0.4.17/CHANGELOG.md)

## What shipped in 0.4.17 {#where-to-find-release-notes}

| Area | What changes for you |
| --- | --- |
| Access recovery | An installation owner can enroll a passkey and keep single-use codes offline. A paired application can then replace the owner's password and revoke previous sessions. [Owner recovery](../omnitron/auth-rbac.md#installation-owner-recovery) |
| Project SDK | A release can require SDK archives committed with the application. After local development, restore that distribution with `omnitron sdk vendored` and verify the installed files with `omnitron sdk status`. [SDK selection](../omnitron/releases.md) |
| Object storage | S3 copies preserve keys containing Unicode, spaces and literal percent escapes. [Storage operations](../titan/modules/storage.md#operations) |

## What shipped in 0.4.16 {#release-0-4-16}

| Area | What changes for you |
| --- | --- |
| Remote deployments | When a connection drops, the controller can use the receiving node's startup result and checked files to retry. A partial start reports the applications already online. [Deployment recovery](../omnitron/releases.md) |
| Documentation | Lumen preserves table headers and column alignment across HTML, Markdown and PDF. Code comments remain legible in both themes. Breadcrumbs follow the active theme from the first rendered page. [Lumen](../lumen/architecture.md) |
| React applications | Prism keeps child state when a provider list is rebuilt. Netron isolates default memory sessions per client and honors explicit browser storage in its React client and authentication provider. [Netron for React](../frontend/netron/multi-backend.md) |
| Notifications | Closing Rotif during startup releases waiting publishers. Multi-process subscriptions preserve complete channel patterns. [Titan notifications](../titan/modules/notifications.mdx) |

## What shipped in 0.4.15 {#release-0-4-15}

| If you want to… | Start here |
| --- | --- |
| Work with several agents in one project | Create a room, choose a lead and connect local adapters. Members can share notes and take assignments. [Agent Studio](../omnitron/studio.md#team-room) |
| Automate an operation | Draw a flow, preview a sample event and review its next revision before activation. Another enrolled controller can receive an inactive draft for its own review. [Event flows](../omnitron/flows.md) |
| Find out why a node raised a storage alert | Inspect the reporting Linux node’s RAID and NVMe observations in Console. [Host storage health](../omnitron/diagnostics.md#host-storage-health) |
| Build a documentation site | Lumen yields between pages during parallel rendering and can serve a published generation without loading its renderer. [Rendering a large corpus](../lumen/architecture.md#rendering-a-large-corpus) |

The release also covers controller updates, release retention, Netron React and Prism. For the complete list and earlier releases, read the [repository changelog](https://github.com/omnitron-dev/omni/blob/v0.4.15/CHANGELOG.md).

## Match an installation to its source {#versioning-policy}

1. Check the installed package with `npm ls @omnitron-dev/titan`, or substitute the package your application uses.
2. Open the matching Git tag. Its manifests declare the supported runtimes and peer dependency ranges.
3. For changes described as **main**, check the named commit before depending on them. **Design proposal** identifies a specification with work still to implement.

### How package versions line up {#per-package-versioning}

The Xec release workflow promotes the authored **Unreleased** notes into the versioned section when it prepares a release. The repository uses one release version for the published set. Independent projects such as Xec and Kysera have their own release histories. [Release process](./contributing.md#release-process)

### Pre-1.0 compatibility {#pre-10-exception}

A pre-1.0 minor release can change public contracts. Check your client and server together when upgrading independently deployed services.

## Plan an upgrade {#upgrade-guides}

Read the intervening changelog entries, pin your dependency graph and exercise the paths your project uses. A runtime update also needs a compatible application build and a tested recovery path. [Compatibility](../reference/compatibility.md) · [Runtime updates](../omnitron/cli.md#local-runtime-updates)

### Identify breaking changes {#breaking-change-communication}

Compare the two tagged changelogs, public declarations and migration notes for the paths your application uses. The [migration guides](../titan/migrations/index.md) describe specific transitions and identify proposed designs.

### Check support {#support-windows}

For runtime requirements, consult [Compatibility](../reference/compatibility.md). The [security policy](./security.md#supported-versions) identifies supported release lines for vulnerability reports.

## Follow releases {#subscribe-to-releases}

### Publication dates {#release-cadence}

Use the date of the tag and the npm version you plan to install. The registry records when each package became available.

GitHub provides the [release archive](https://github.com/omnitron-dev/omni/releases) and [Atom feed](https://github.com/omnitron-dev/omni/releases.atom). To check a package independently, run `npm view @omnitron-dev/titan version`.

### Related references {#see-also}

Find a package by its role in the [package index](../reference/packages.md), or inspect a public symbol in the [API index](../reference/api-index.mdx).
