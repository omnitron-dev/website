---
id: "omnitron/release-readiness"
slug: "/docs/omnitron/release-readiness"
title: Release readiness
description: Ordered implementation and acceptance plan for the control plane, execution, security, Console and package integrations.
---

# Release readiness

This page defines implementation and acceptance gates. It is not a live release
status report. Each gate needs code, adversarial tests, documentation and packaged
verification. An installation's activation needs its own reviewed record. Track
**implemented**, **verified**, and **activated** separately: a passing source test does not establish that the running
fleet has received a fix. Use the candidate's qualification receipt and each
installation's status for those decisions.

The scope includes the known release blockers and the previously identified product
limitations. Do not silently defer an item by renaming it a roadmap feature. If an
external dependency prevents completion, record the exact dependency and keep the
capability unavailable or explicitly limited until its acceptance criteria pass.

## Final npm qualification {#final-npm-qualification}

Freeze one source commit and prepare its exact archive batch:

```sh
pnpm exec xec release <version> --prepare
pnpm exec xec release <version> --status
pnpm exec xec release <version> --finish
```

Preparation builds and packs once, then retains the archives before checking
three independent npm consumers: the minimal runtime, all public packages
together and Lumen on its own. Each verifies installed archive identities and
runs an audit; the Lumen consumer also checks SSR, MCP and browser behavior.
`release.json` is written only after acceptance and cleanup succeed. A rejected
consumer can retry acceptance against the same producer and archive bytes;
changed inputs or damaged archives refuse reuse.

`--status` and publication verify the accepted archive inventory, canonical
producer and acceptance receipts, source commit, recipe, policy and dependency
lockfile. Publication does not repeat builds, consumer checks or runtime-tree
hashing. The publishing process may use a different Node version or environment
from the recorded producer. Missing acceptance, incomplete cleanup or changed
evidence blocks publication.

Runtime qualification is a separate operation:

```sh
pnpm exec xec release <version> --qualify --previous <full-previous-commit> --push-source
```

It verifies the accepted preparation as the first clean build, performs a second
independent build, and requires CI plus native transition/rollback on the configured
Node versions. Comparison, CI and native qualification run concurrently and retain
their own stage evidence. A failed or unavailable stage remains failed or
unavailable; npm acceptance does not replace it. Managed runtime updates require
this qualification. Complete runtime qualification is not a prerequisite for npm
publication.

Runtime acceptance also covers the target installation's admission contract:

1. Remote release admission uses the verified resident owner protocol and the
   exact Node target that installation will use. A frozen application owns its
   SDK; equality with the owner's Git commit is not a compatibility contract.
   Missing identity, unsupported owner protocol, an incomplete closure or a
   different target must refuse delivery. See [release admission](./releases.md).
2. Compiler and linter checks cover production code and all test fixtures.
   Omnitron's server tests inherit its strict backend options; Console tests use
   its browser configuration. Both belong to normal workspace typecheck.
3. Native qualification delivers an application built with the candidate SDK
   through the previous execution owner, verifies its private dependency graph,
   reuses the verified installation and restores the retained application.
   A matching controller version alone is not proof of application compatibility.
   Record CLI and Console acceptance separately from isolated fixtures.

Do not reuse a passing result from an earlier commit as proof for the selected
one. Preparation and publication do not activate the fleet. Any required live
pause needs an explicit transition, verification and rollback plan first.

For a maintainer SDK export, run the reproducibility gate from the source repository:

```sh
pnpm check:reproducibility --revision <full-commit> --out /absolute/new/qualification
```

This standalone command runs the ordinary frozen install and complete build in
two independent checkouts, then compares both the sealed runtime and every
normalized public npm archive. A successful output contains `runtime/`,
`sdk/framework-manifest.json`, the SDK archives and `QUALIFICATION.json`. Treat the
qualification receipt as the completion marker; a partial directory is not an
accepted export. Without `--revision`, the selected commit is `HEAD`.

The [maintainer release workflow](../community/contributing.md#release-process)
reuses the accepted preparation as the first reproducibility build, while the
standalone command makes both from scratch. Export from the verified archives.
A clean Git status does not make an existing build directory canonical: Console
publication retains older hashed assets so open tabs can continue loading their
chunks. Those served generations do not belong in a new SDK archive. Do not
replace sealed preparation archives with a later pack of a working checkout.

## Invariants {#invariants}

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

## Ordered delivery gates {#ordered-delivery-gates}

| Gate | Implementation and architectural boundary | Acceptance evidence | Depends on |
| --- | --- | --- | --- |
| G00 — Baseline | Inventory source revisions, active artifacts, owners, application PIDs/start times, database schema, replication receipts and pinned experiment environment. Establish a repeatable isolated test environment and fault fixtures. | Before/after inventory, immutable rollback artifacts, no live dependency replacement during development. | — |
| G01 — Cluster authority | Remove anonymous election authority; bind machine identity to permitted operations. Replace volatile leadership assumptions with durable coordination, explicit failure semantics and fencing. Reject unsafe network publication with seeded administrator credentials. State exactly which database/coordination availability the cluster requires. | Forged identity, replay, stale epoch, restart, concurrent controllers, partition, lost database and delayed response tests. No leadership or effect is admitted on uncertain authority. | G00 |
| G02 — Stack lifecycle | Node-confirmed stop with exact project/stack/allocation ownership, serialization and durable operation identity. Preserve remote observation and infrastructure on partial failure. Handle retries, lost replies, unreachable nodes and legacy deployment identities without stopping another stack. | Multi-node tests with one unreachable node, stop failure, stale incarnation, controller restart and repeated request. CLI/Console agree on stopped, partial and unknown outcomes. | G01 |
| G03 — Xec SSH | `@xec-sh/ssh` owns the reviewed protocol implementation derived from `ssh2`, its MIT attribution, client contracts, SFTP and connection leases. Xec Core adapts that package to command execution; applications do not add another SSH client or protocol policy. Audit upstream defects and the owned fork; verify trust, streaming, PTY/resize, forwarding, cancellation and deadlines. Public types and the protocol must install and work from the same archives. | Independent OpenSSH interoperability fixtures; password/key/agent authentication; host-key mismatch; Unicode/binary transfer; parallel channels; backpressure; interrupted transfer; tunnel disposal; no leaked processes, descriptors or secrets. Dependency-boundary checks distinguish direct imports from transitive lock entries. Reproduce relevant upstream reports and record mitigations. | G00; G02 before fleet activation |
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
runtime, public types and packed artifacts pass the same contracts. SDK compatibility
also requires an application upgrade and rollback through the same resident owner,
including a development installation whose bootstrap path stays unchanged. Record
the owner capability `applicationRuntimeResolution: 1` separately from the backend
version. Fresh-owner startup and fresh-shell imports do not qualify that transition.

## Activation and rollback contract {#activation-and-rollback-contract}

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

### Roll out a group of changes {#roll-out-a-group-of-changes}

Select one clean source commit for the batch and wait for its CI run. Build for
each target OS, architecture and Node runtime. Record the current backend,
process owner and Console revision separately, along with application identity
and health. A backend handoff can advance the controller while the existing
owner continues running the applications.

Update one test node first. Before moving to the next node, check authenticated
RPC, advancing replication acknowledgements, delivery of a fresh log record and
application health against the baseline. On a controller that serves Console,
also verify the published asset version and exercise the affected UI. If a new
feature requires a different owner or a Console restart, document its affected
processes, stop criteria, rollback artifact and recovery budget before opening
that window. Record the last accepted revision for each component and node.

## Documentation contract {#documentation-contract}

Update the owning layer's documentation together with code: Xec for execution,
Kysera for database primitives, Titan for reusable integration, Omnitron for
operations and Console, and application repositories for domain-specific behavior.
Provide a short working path first, then configuration, failure/recovery semantics,
permissions and examples. Public framework documentation uses generic sample
projects; private deployment details belong in operator evidence outside the package.

The detailed architecture remains in [Resilient control plane](./resilient-control-plane.md).
This plan supplies delivery order and acceptance gates, not a competing architecture.


## Current implementation evidence {#current-implementation-evidence}

CI compares release artifacts from two independent checkouts. Omnitron 0.4.12
uses the published Xec 0.13.0 contracts for durable execution-resource inspection
and termination, retained release production, and the separate `@xec-sh/ssh` API.
The committed lockfile records resolved versions and integrity. Release
preparation checks both declarations and installed versions before changing
versions or building. Qualification checks actual archives and the installed
dependency graph; an earlier release's receipt does not qualify a changed
candidate. The npm delivery path is:

1. Publish and verify the Xec packages that supply those contracts.
2. Generate the real registry lockfile and verify a frozen Omnitron installation.
   Source aliases used in isolated tests do not satisfy this gate.
3. Prepare Omnitron's sealed archive batch and verify its exact npm consumers.
   Publish only after acceptance, cleanup and the canonical receipts are confirmed.
4. Qualify documentation consumers against the published Lumen and Prism versions.

Before updating a managed runtime, separately complete independent build
comparison, CI and native transition/rollback on the selected Node versions.
Reuse evidence only through the recipe's verified input-identity contract, then
apply the installation's reviewed transition and rollback plan. Qualification
may run in parallel with npm delivery; publishing does not certify that it passed.

These are dependency and acceptance requirements, not a live claim that a selected
candidate is published, qualified for runtime changes or active.

Run `pnpm audit --audit-level low` to check runtime and development dependencies,
and `pnpm check:packages` to verify every public export inside the packed archives.
CI and release preparation additionally install the actual archives into an independent
npm consumer and audit its production dependencies: workspace overrides do not protect
a published consumer. KB publishes its tested extraction dependency tree using standard
npm bundled dependencies. Framework admission checks every included package's identity,
files and declared dependency edges, both in the npm installation and after the portable
application graph is materialized. Undeclared bundles, altered files, missing dependencies
and archive links remain refusals.
Each target still needs its own runtime identity, launch evidence and rollout record.

G09 and G14 include a Chromium check of the production topology component and its
routing worker. Run `pnpm --filter @omnitron/console test:browser` after installing
Playwright Chromium. The fixture exercises shared services at 320, 768 and 1440 CSS
pixels. All declared links must render, panel and inspector bounds must fit, and
positions changed with the pointer or keyboard must survive reload. On a running
installation, also compare the number of rendered links with the inventory and open
a connection to inspect its evidence. See the [topology controls](./console.md#topology).

For the [System view](./console.md#system), read a fresh snapshot on each reporting
node, then compare its hostname and daemon PID with the same target selected through
the controller in CLI and Console. CI checks that a machine identity can report its
own host and cannot use the user-facing method to relay a request to a third node.

The daemon's HTTP acceptance tests exercise public liveness and readiness, authentication errors for the five detailed Health RPCs, and human and machine read access. The replication tests use a real TCP peer exposing an unprotected outbox and verify that the controller rejects it. Machine-only acknowledgement and administrative reconciliation have separate tests. WAL recovery tests include lost acknowledgements, partial replies, disk errors and capacity eviction.

G05 uses Xec's release operations for workspace discovery, immutable archive
preparation, tag verification and registry reconciliation. CI rehearses an
interrupted publish, a resume, a conflicting digest, an RC channel and an
unrelated tag against isolated Git and npm endpoints. See the
[maintainer release procedure](../community/contributing.md#release-process).

G01 and G02 implement signed recipient admission for managed stack stops and recovery of retained application releases. PostgreSQL
identifies the current leader and SQLite retains each recipient's highest epoch.
The takeover test transfers leadership after the application step and verifies that
the former controller cannot retire infrastructure, even after recreating the
recipient. Node protocol methods require a machine identity. Leadership transfer
requires an administrator. CLI and Console show the node, epoch and receipt outcome.
Recovery acceptance transfers a real PostgreSQL lease between consecutive application launches and checks that the old controller cannot dispatch the next one. Owner tests exercise real processes and release evidence. Fleet activation and live end-to-end acceptance are separate gates. Earlier allocations
require explicit ownership evidence. Provisioning, routing and stateful recovery
still need operation-specific fencing.

G03's Xec 0.13 candidate moves the protocol implementation into `@xec-sh/ssh`.
It is an owned fork derived from `ssh2`, with the original MIT attribution;
it is not a newly invented SSH protocol. The package owns authentication,
host verification, channels, SFTP, forwarding and connection leases. Core owns
execution adaptation and maps remote failures into its common outcome contract.
Direct SSH applications import the shared package; Omnitron automation uses
Core's adapter and its terminal driver uses `SSHClient`.

Trust and authentication policy form part of connection identity. A pooled
connection revalidates trust before a new borrow; a trust refusal prevents new
work without silently terminating another active lease. Strict host checking
is the default. Commands, forwarded listeners and transfers retain their own
request limits and cancellation. After a command is dispatched, transport loss
can leave its outcome unknown; cancellation is not proof that the remote process
stopped and never authorizes automatic replay. Active tunnels retain their leases
through idle and lifetime deadlines. Normal cleanup resumes after release, and
cleanup errors remain observable to the owner.

The package's independent-peer and installed-artifact tests cover malformed
packets, receive-window overflow, buffered writes during channel closure, nested
ChaCha writes, SFTP response and close handling, authentication, host-key trust
and bounded cleanup. Source test success is evidence for those source inputs;
it does not establish acceptance of the future npm archives. G03 and G06 require
the same tests and public consumer imports against the selected Core/SSH package
closure, with no sibling source alias supplying a missing contract. After
activation, record the running version and repeat role, host-key and session
checks through CLI and Console on the target nodes.
