---
title: Release readiness
description: Ordered implementation and acceptance plan for the control plane, execution, security, Console and package integrations.
---

# Release readiness

This is the implementation plan as of 1 November 2026, not a list of capabilities
already delivered. Each gate needs code, adversarial tests, documentation, packaged
verification and an activation record. A passing unit test does not establish that
the running fleet has received a fix. Track **implemented**, **verified**, and
**activated** separately. No gate below is complete merely because it is documented.

The scope includes the known release blockers and the previously identified product
limitations. Do not silently defer an item by renaming it a roadmap feature. If an
external dependency prevents completion, record the exact dependency and keep the
capability unavailable or explicitly limited until its acceptance criteria pass.

## Invariants

- One project owns multiple environments/stacks; an allocation identifies its
  project, stack, workload, revision and node incarnation. Display names and network
  addresses do not establish ownership.
- Kysera owns database primitives and migration machinery; Titan provides reusable
  lifecycle, policy, contracts and integration; Omnitron owns infrastructure intent
  and operations. Xec owns execution and SSH; Prism owns reusable interaction.
- CLI, Console and agents use the same server contracts, permissions, operation
  journal and diagnostic reasons. Clients never decide whether an operation is safe.
- Every mutation is admitted against current authority and exact resources. A timeout
  means an unknown outcome until reconciled, not success and not permission to replay.
- Running applications, pinned experiments, data and historical evidence survive
  development and backend upgrades. Process-owner replacement requires a reviewed
  pause and rollback plan. Source builds use isolated outputs.
- Optional features remain independently importable. A basic daemon does not require
  an agent SDK, browser editor, cloud account or consensus service.

## Ordered delivery gates

| Gate | Implementation and architectural boundary | Acceptance evidence | Depends on |
| --- | --- | --- | --- |
| G00 — Baseline | Inventory source revisions, active artifacts, owners, application PIDs/start times, database schema, replication receipts and pinned experiment environment. Establish a repeatable isolated test environment and fault fixtures. | Before/after inventory, immutable rollback artifacts, no live dependency replacement during development. | — |
| G01 — Cluster authority | Remove anonymous election authority; bind machine identity to permitted operations. Replace volatile leadership assumptions with durable coordination, explicit failure semantics and fencing. Reject unsafe network publication with seeded administrator credentials. State exactly which database/coordination availability the cluster requires. | Forged identity, replay, stale epoch, restart, concurrent controllers, partition, lost database and delayed response tests. No leadership or effect is admitted on uncertain authority. | G00 |
| G02 — Stack lifecycle | Node-confirmed stop with exact project/stack/allocation ownership, serialization and durable operation identity. Preserve remote observation and infrastructure on partial failure. Handle retries, lost replies, unreachable nodes and legacy deployment identities without stopping another stack. | Multi-node tests with one unreachable node, stop failure, stale incarnation, controller restart and repeated request. CLI/Console agree on stopped, partial and unknown outcomes. | G01 |
| G03 — Xec SSH | Keep `ssh2` as the reviewed protocol implementation inside Xec. Applications and Omnitron use Xec, without independent SSH clients or transport policies. Audit dependency versions and upstream defects; strengthen host verification, streaming, PTY/resize, SFTP, forwarding, cancellation, deadlines and lifecycle in the owning layer. Public Xec types must install cleanly. Do not replace the SSH protocol implementation merely to remove a dependency. | Independent OpenSSH interoperability fixtures; password/key/agent authentication; host-key mismatch; Unicode/binary transfer; parallel channels; backpressure; interrupted transfer; tunnel disposal; no leaked processes, descriptors or secrets. Dependency-boundary checks distinguish direct imports from transitive lock entries. Reproduce relevant upstream reports and record mitigations. | G00; G02 before fleet activation |
| G04 — Shared access policy | Complete resource-scoped grants, custom roles, explicit deny, delegation ceilings, session revocation and account suspension in the shared policy layer. Separate human, service and agent identities; privileged machine credentials cannot become user delegation. Design MFA/SSO as optional identity adapters with tested enrollment and recovery. | Same allow/deny matrix through HTTP, Netron, CLI and Console; cross-project isolation; live revocation; privilege escalation and stale-session tests; application integration tests. | G01 |
| G05 — Release transaction | Discover all publishable workspaces; validate exports and dependency ordering. Make dry-run read-only, prerelease tags correct, git changes scoped, tag push exact, and partial publication resumable without overwriting published versions. Repair missing publish entry points. | Sandbox registry and git remotes covering interrupted publish, existing version, divergent tag, dirty tree, rerun and prerelease; package inventory has no omissions. Publication remains a separate operator action. | G00 |
| G06 — Registry integration | Release verified Xec/Kysera artifacts, consume registry versions in Omnitron and application manifests, and remove release-time sibling paths/vendor overrides. Preserve intentional development workspaces as an explicit mode. Keep migrations accessible through Omnitron's facade. | Clean install/build/test from tarballs with sibling repositories unavailable; manifests and locks agree; runtime closure and migration checks for every application. | G03, G04, G05 |
| G07 — Required quality gates | Repair lint/type errors, obsolete fixtures and test commands that mask failures. Require lint, compiler, meaningful unit/integration/security tests, package exports, documentation and clean-install checks in CI. Isolate service fixtures and preserve the original failure on cleanup. | Red tests fail CI; unavailable required fixtures fail clearly; supported Node/platform matrix passes; website builds with link/content checks. | G01–G06; extend for every later gate |
| G08 — Durable diagnostics | Complete log/metric/audit acknowledgements, bounded queues, failure signaling and query budgets. Preserve exact timestamps/multiline boundaries, deduplication identities and explicit historical gaps. Add resumable cursors and a Titan notification adapter with durable delivery, retries and dead-letter visibility. | Crash/timeout/replay/load tests, source-to-database reconciliation, bounded memory/storage behavior, identical diagnostic codes in CLI/Console. Sensitive effects have durable audit evidence or are refused. | G01, G02, G04 |
| G09 — Canonical topology | Complete environment, allocation, resource binding and route models, including Docker/bare-metal/multi-node and isolated cross-project service contracts. Extend the existing topology editor and read model; do not introduce a parallel project registry. | Round-trip portable configuration; unambiguous ownership; dependency edges from declared and observed evidence; stale/missing evidence distinguished; accessible editor at narrow and wide sizes. | G02, G04, G08 |
| G10 — Durable operations and recovery | Reuse one persisted plan/admission/execution/verification lifecycle for deployment, migration, replacement and scaling. Add node-incarnation fencing, capacity reservations, failure domains, reserve pools, readiness budgets and compensation. Stateful recovery requires a provider-specific data and fencing contract. | Controller crash at every transition; duplicate delivery; node loss; exhausted capacity; stale owner; safe stateless replacement; provider-specific stateful recovery and rollback drills. No blind replay or automatic data failover. | G01, G02, G08, G09 |
| G11 — Xec automation | Store immutable executable revisions and inputs, surface validation/progress/output, and add durable scheduling/webhook admission. Separate restartable work from effects requiring reconciliation. Untrusted execution uses an actual isolation boundary with resource and secret budgets. | CLI/Console parity; artifact tamper rejection; cancel/restart behavior; trigger deduplication; sandbox escape boundaries; bounded output and resource consumption. | G03, G04, G08, G10 |
| G12 — Agent adapters | Optional provider SDK adapters use the same delegated identities and reviewed operation contracts. Support analysis of logs, metrics, topology and alerts before privileged execution. Resolve subscription/API authentication from supported provider contracts, without inheriting administrator tokens. | Per-tool, resource, time and budget enforcement on the server; revoked grants stop subsequent effects; exact-plan approval; reproducible audit; no arbitrary terminal bypass. | G04, G08, G10, G11 |
| G13 — Files and terminal | Preserve the dual/multi-panel model while adding efficient Netron transfer streams, resumable node-to-node copies, conflict/version checks, bounded previews and safe editing. Complete SSH lifecycle feedback and explicitly authorized session recovery/reattachment. | Real-node copy/edit with permission changes, cancellation, reconnect, partial transfer and concurrent edit; path/symlink escape tests; session ownership and expiry; keyboard and mobile-size verification. | G03, G04, G08 |
| G14 — Console product consistency | Apply one Prism interaction model to navigation, tables, filters, menus, dialogs, logs, topology, metrics, files and SSH. Immediate acknowledgement, operation progress, retry/cancel and actionable errors share backend state. Scope keyboard commands without trapping focus; expose discoverable shortcuts. Reduce initial bundles by capability boundaries. | Browser flows for administrator/operator/viewer/custom scope, keyboard-only use, focus restoration, screen-reader labels, narrow/wide viewports, reconnect and slow/failing operations; measured bundle and rendering budgets. | G02, G04, G08–G13 |
| G15 — Coordinated acceptance | Build sealed candidates, verify migration expansion and rollback, activate backend without changing application owners where possible, then validate applications and public interfaces. Publish complete package/API/operations docs and release notes with remaining boundaries stated exactly. | Full clean-install suite, website build, role/SSH/files/deploy checks through real CLI and Console, stable app identities, replication and receipt reconciliation, protected experiment artifacts unchanged. | G00–G14 |

G05 can be prepared while no active runtime changes are pending. G07 grows with each
implemented gate; it is not postponed to the end. Progress proceeds through small,
reviewable commits. Package versions become release candidates only after their
runtime, public types and packed artifacts pass the same contracts.

## Activation and rollback contract

Each activation record names the current and candidate digests, affected processes,
configuration/schema changes, exact commands, readiness deadline, acceptance probes,
rollback trigger and rollback commands. Take backups before the switch and verify the
rollback artifact before asking for a pause. Do not treat a backend-only handoff as
permission to replace an execution owner or restart applications.

Compatible additive schema changes stay in place during binary rollback; destructive
schema rollback requires a separate data recovery decision. Verify the supported old
and new binaries against the expanded schema. For remote lifecycle changes, keep
observation and recovery available even if a node cannot confirm an effect.

The release record must distinguish failures, waiting for domain readiness and
unavailable evidence. It must not declare success from a green process indicator,
hide a warning by weakening its threshold, or infer that an unreachable process has
stopped. Existing experiment identities and historical gaps remain intact.

## Documentation contract

Update the owning layer's documentation together with code: Xec for execution,
Kysera for database primitives, Titan for reusable integration, Omnitron for
operations and Console, and application repositories for domain-specific behavior.
Provide a short working path first, then configuration, failure/recovery semantics,
permissions and examples. Public framework documentation uses generic sample
projects; private deployment details belong in operator evidence outside the package.

The detailed architecture remains in [Resilient control plane](./resilient-control-plane.md).
This plan supplies delivery order and acceptance gates, not a competing architecture.


## Current implementation evidence

CI compares release artifacts from two independent checkouts. For the registry
transition, all six Xec 0.11.2 and fourteen Kysera 0.10.2 tarballs were downloaded
from npm. Their SHA-512 digests matched the preparation receipts and the public
registry metadata. Frozen installs resolve the packages used by each workspace.
Run `pnpm audit --audit-level low` to check runtime and development dependencies,
and `pnpm check:packages` to verify every public export inside the packed archives.
Each target still needs its own runtime identity, launch evidence and rollout record.

G05 uses Xec's release operations for workspace discovery, immutable archive
preparation, tag verification and registry reconciliation. CI rehearses an
interrupted publish, a resume, a conflicting digest, an RC channel and an
unrelated tag against isolated Git and npm endpoints. See the
[maintainer release procedure](../community/contributing.md#release-process).

G01 now has PostgreSQL-backed authority leases, monotonic epochs and guarded network
publication in source. Recipient-side effect fencing remains part of G10. G02 has
confirmed component termination, durable owner fences, node stop plans/receipts and
shared CLI/Console progress in source. The existing fleet has not yet received these
changes. Legacy allocation bindings, initial inventory of earlier deployments and coordinated
owner/adapter activation remain explicit acceptance prerequisites.

G03 keeps `ssh2` inside Xec. Direct use outside Xec and protocol implementation
dependencies are different architectural concerns. Tunnel target isolation, pooled
connection ownership and acknowledged closure are implemented and verified in Xec.
The source candidate now also has Xec-owned public SSH/SFTP contracts, custom-agent
bridging, finite request deadlines, shared connection-failure observation, bounded
pending requests, binary/UTF-8 preservation, explicit unknown command/write outcomes,
and complete high-level upload/download directory operations. Incomplete transfers
reject, and a lost reply never authorizes command replay. A clean consumer check
compiles without the underlying transport or its type package and runs in Xec CI.
Reverse-listener allocation now has a deadline and cancellation, and invalidates
its dedicated connection when acknowledgement is lost. Shared commands remain
isolated. The connection budget includes in-progress handshakes, busy connections
cannot be evicted, and unpooled connections close when their last operation ends.
Protocol keepalives replace remote keepalive commands; adapter disposal is terminal.
Four upstream transport defects were reproduced in isolation: zero-size packets,
receive-window overflow, abandoned buffered-write callbacks and a shared ChaCha
nonce during nested writes. A compatible patch and an offline npm-artifact gate
now cover these cases. The prepared Xec package carries the patched transport,
its license and checksums; direct packing of an unprepared workspace is rejected.
SFTP close acknowledgement, cleanup under backpressure and lost high-level read
callbacks are also covered by the installed-package gate, including 25 consecutive
server-initiated closures without leaking channels. Both npm and pnpm installations
preserve the reviewed patch. High-level SSH targets inherit the same Xec connection
contract as `NodeSSH`: agents, host pins, algorithms and cancellation are available
without a parallel transport API. Connection identities include the effective trust
and authentication policy; rotated key files cannot reuse the previous identity.
Timeouts retire repeated failures after active users finish, preserving other commands.
OpenSSH authentication tests exercise agent signatures, encrypted key files and
rejection of a mismatching `known_hosts` entry without password fallback.
Installed-package tests also exercise malformed packets, channel cleanup under
backpressure and simultaneous writes in the published transport. Before promotion,
complete the remaining adversarial SSH cases and transport security review. After
activation, record the running version and repeat the role, host-key and session
checks through the CLI and Console on the target nodes.
