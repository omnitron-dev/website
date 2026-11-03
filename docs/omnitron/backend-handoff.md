---
title: Backend replacement
description: Replace a control plane while a resident owner retains application processes.
---

# Backend replacement

Resident execution separates the backend from the process that owns applications. `omnitron backend upgrade` replaces the backend while the resident owner keeps application PIDs, pools, local topology routes, watchers and disk log capture. CLI and Console requests pause during replacement and reconnect afterwards; this is not uninterrupted control-plane availability.

Resident execution is opt-in on POSIX. It supports unmanaged operation and separate OS services for the execution owner and backend guardian. A legacy single-service layout is refused: detaching a child does not establish independent service ownership. Replacing the owner or its Node runtime still requires an application maintenance window.

## Choose the update mechanism

| Purpose | Entry point | Boundary |
| --- | --- | --- |
| Replace the local resident backend | `backend upgrade <sealed-dist>` through its local supervisor | Keeps the owner and application processes. The fleet cannot update its initiating controller. |
| Replace remote managed backends | `fleet rollout` or Console **Nodes → Managed backend updates** | Uses sealed builds and one shared, durable receipt across CLI and Console. |
| Bootstrap an older independent guardian | Native `backend guardian prepare` and reviewed `apply` | A separate, qualified window before using `kernelHandoff@1`. Retains the selected backend and owner. |
| Replace a coupled host's workspace bundle | `fleet upgrade` or Console **Advanced · workspace source bundle upgrades** | Uses the legacy host/app contract and can restart applications. Independently supervised hosts require the managed backend path. |

The first transition from a coupled daemon to an independent owner still requires
an application maintenance window. Neither a fleet plan nor a guardian update
transfers application ownership to a new owner process.

## Owner compatibility

A compatible RPC envelope does not imply compatible lifecycle behavior. A sealed
backend declares the owner contracts it requires; the owner advertises the
contracts it implements. The current `stackControl@1` contract includes durable
stack intent, admission fences and confirmed process termination.

Run the **candidate's CLI** with `backend upgrade <sealed-dist> --check` before
planning activation. It validates the selected instance's owner identity and
contracts before delegating to a guardian or draining the backend. The check runs
again before preparing a handoff, and the candidate independently verifies its
owner before acquiring control. An older owner with no capability declaration
cannot satisfy a new requirement. A version mismatch is also refused; a larger
version number is not assumed to be backward compatible.

`backend status --json` exposes `execution.ownerCapabilities`. An absent field
means the backend does not report these contracts; an empty object means its
owner advertised none. `handoffSupported: true` describes the transfer mechanism,
not compatibility with every future backend. If a required contract is absent,
keep the current backend running and prepare a controlled owner transition with
application inventory, readiness budgets and rollback. Never bypass the refusal
by replacing the active files or changing an advertised capability.

## First transition

Run `omnitron backend status --json` before planning an update. `mode: coupled` means the backend directly owns its workers. Those live forks and threads cannot be transferred to another parent without changing their lifecycle. **The first transition requires one controlled application restart.** The upgrade command refuses a legacy daemon before draining or stopping anything.

During an approved maintenance window, preserve the current configuration, project registrations, running inventory and previous build. Merge the following into the existing daemon configuration; do not replace its authentication or access settings:

```json
{
  "executionHost": {
    "enabled": true,
    "directory": "/absolute/private/omni-execution"
  }
}
```

The directory must belong to the daemon user, have mode `0700`, and be short enough for Unix socket paths (the longest generated socket must fit within 100 bytes). Checkpoints and sockets use `0600`. Configuration must be serializable; executable hooks belong in application bootstrap modules.

Start from a sealed backend artifact and verify application health, readiness, child PIDs, pool membership and registered runtime integrity. Application bootstrap workers use their application's installed Omnitron adapter and Titan instance, preserving DI identity independently of the backend's dependency tree. An incompatible or missing adapter is refused with an explicit error.

## Build and seal

Build and test in a separate checkout or staging directory. Never rebuild dependencies underneath a live application. The source tree must be clean and the backend must contain a valid `BUILD.json`.

```sh
node apps/omnitron/scripts/freeze-backend.mjs \
  /absolute/staging/apps/omnitron \
  /absolute/releases/omnitron-next
```

The freezer copies the installed runtime dependency closure and the current Node executable into a new tree owned by the instance account, rewrites package links inside the artifact, and records file hashes in `RUNTIME.json`. It performs no install scripts, package upgrades or network operations. Optional `package=compiled-package-directory` arguments select explicitly built workspace packages; their versions must match the installed graph. Keep the current sealed artifact for rollback. If the package includes Console, its complete output must be present at `webapp/dist/index.html`; a partial `webapp` directory is rejected. Headless packages omit the directory. Include the frontend before sealing rather than modifying an installed artifact.

Use the artifact's Node executable and CLI when starting that release:

```sh
/absolute/releases/omnitron-current/node \
  /absolute/releases/omnitron-current/packages/0/dist/cli/omnitron.js up
```

## Permanent installation and cold start

`backend upgrade` installs both the candidate and rollback into the instance's permanent store before draining the backend. Each directory is addressed by its complete SHA-256 under `$OMNITRON_HOME/runtime/releases/`. Copying never moves or rewrites a running release. The copied Node executable, backend and dependency closure are revalidated before publication and execution; an existing directory with different contents is refused.

The startup selector is stored transactionally in `runtime/state.db`, using the existing daemon state store with full SQLite durability. It records the current release, previous release, selector revision and a separately pinned launcher release. An exclusive installation lease prevents concurrent upgraders or selectors; a dead installer's lease can be recovered. Cold startup shares that lease until the daemon has initialized, closing the version-selection/PID-file race.

After the first successful upgrade, use the stable entry point:

```sh
~/.omnitron/runtime/bin/omnitron backend installation --json
~/.omnitron/runtime/bin/omnitron up
```

For a different `OMNITRON_HOME`, the launcher lives in that instance's `runtime/bin` directory and retains the instance path. It follows the selected release and uses that release's own Node. The normal detached and foreground startup paths also honor the selector. A missing, modified or incompatible selected artifact is an error, never an implicit fallback to a source checkout.

To prepare an installation while the backend and execution owner are stopped:

```sh
omnitron backend install /absolute/sealed-runtime --json
omnitron backend select <complete-sha256> --json
```

`install` only copies and verifies. `select` refuses a running backend or owner, an unfinished activation and an incompatible migration transition. Use `upgrade` for a running resident installation. Selecting a release does not replay an old handoff checkpoint: a normal cold start reads the current project registry and configuration. A living owner with existing applications still requires validated recovery rather than startup reconciliation.

The activation intent is durable before retirement; the selector commits only after public readiness and application identity checks. If the coordinator dies or publication fails, the unfinished activation blocks cold startup. `backend recover` can verify and acknowledge an already-ready successor without launching a second controller; otherwise it restores the verified rollback after proving the backend is absent and the owner inventory is unchanged. Administrative diagnostics and recovery remain accessible through the stable launcher during this state. After a successful activation, the proven management release becomes the recovery bootstrap; a failed candidate cannot replace it. A later legacy rollback retains that capable management release.

`execution/active-backend.json` remains a diagnostic receipt. The installation database is the startup selector. There is no automatic release deletion: retain the selected, rollback and launcher releases, and every artifact still used by an owner or application. In particular, installing a permanent backend does not relocate an already-running owner from its original artifact.

## Replace the backend

```sh
omnitron backend status --json
omnitron backend upgrade /absolute/releases/omnitron-next/packages/0/dist --check
omnitron backend upgrade /absolute/releases/omnitron-next/packages/0/dist
```

`--check` validates both candidate and rollback artifacts without draining requests. Activation repeats validation before retirement. Changed database migration files are refused by default. A compatible master schema expansion requires the separate, exact plan described below. A replacement also inspects the existing migration journal through Omnitron’s shared Kysera runner before opening public ingress. Pending, changed or unapproved unknown migrations refuse readiness; this check never creates history or applies migrations. Legacy records without checksums remain explicitly unverified by `omnitron migrate verify --daemon`. Applying a migration separately does not bypass the artifact compatibility check.

The replacement proceeds through these boundaries:

1. Reject active SSH sessions, file transfers, pipelines and release builds. Drain admitted RPC calls, property operations, Netron tasks and infrastructure reconciliation through their replies.
2. Verify and install candidate/rollback artifacts; validate native container identity and specifications. Capture project ownership, retry backoff, monitoring configuration and application identities in a private checkpoint.
3. Pause metric polling, wait for any child batch already in flight, and flush accepted samples to the configured storage. A failed or timed-out flush refuses the transfer and the incumbent resumes polling. Fence execution mutations with a new controller epoch. Persist the grant before enabling the new controller; stale controllers cannot write or acknowledge observations.
4. Retire only backend services. The owner continues running applications and capturing logs.
5. Start the candidate and adopt existing infrastructure. Open public RPC and resume metric polling once the candidate is ready.
6. Verify public readiness, owner identity, epoch, application PIDs, start times and restart counts. Only then complete retirement.

A pool can replace a worker after the handoff under its normal recycling policy. Compare the inventory captured at transfer time first. For a later PID change, match the worker ID in the owner log to its recycling reason (for example, `max_lifetime`) and its exit code.

A failed candidate is stopped and the previous artifact is started under a fresh epoch. Rollback does not reuse an old grant. A failure to prove identity or inventory preservation stops automatic recovery rather than guessing which processes to kill or relaunch.

A service that failed before creating a container can transfer its failed state when native Docker inspection confirms that the container is absent. The checkpoint binds that absence separately from the desired service and its error; the candidate verifies it again and preserves the failure. An unavailable Docker daemon is not evidence of absence. A missing previously observed container, changed container identity/specification or legacy checkpoint without this evidence still refuses transfer. Handoff does not repair infrastructure or turn a failed service healthy.

## Recovery after a backend crash

A sealed resident backend maintains a private recovery journal beside the owner socket, in `execution/recovery.db`. It reuses the daemon SQLite store with `synchronous=FULL`. Before changing ownership bookkeeping, it durably invalidates the previous certificate; a failed write refuses the mutation. The last snapshot remains available privately for diagnosis but is never accepted as a current recovery certificate.

Every five seconds, a quiet backend reads its owner, project registry and infrastructure bookkeeping without draining ingress, provisioning containers or pausing applications. It publishes only a stable generation with no unfinished execution mutation or lifecycle operation. Active SSH sessions, transfers, pipelines and builds prevent certification. Unchanged snapshots are not rewritten. `execution.recovery` reports `pending`, `ready` or `unavailable` with the reason; a pending operation is not an application health failure.

Run `omnitron backend recover` without a checkpoint to restore a crashed backend from its current certificate. It refuses a live controller, an unfinished activation, an unverified or different selected artifact, an externally changed project registry, a changed owner/controller grant or any difference in the recorded application inventory. Infrastructure adoption checks actual container specifications before public readiness. Recovery obtains a fresh fenced grant and uses the same validated replacement path as a planned update; it never replays application startup or migrations.

A crash during a mutation can leave recovery uncertified. A changed process inventory, including an application restart after the certificate, also requires reconciliation rather than automatic adoption. Use the reported reason and private journal to investigate; do not stop a living owner to make the check pass. If recovery itself is interrupted after preparing its grant, the runtime installation records the explicit handoff checkpoint for `omnitron backend recover /absolute/private/handoff-ID.json`.

The journal does not itself install an OS supervisor or promise recovery from owner/host failure. The unmanaged mode still needs an operator or external controller to invoke recovery after proving the backend is dead.

## Independent OS supervision

With `executionHost.enabled`, `omnitron service install --prepare` writes a reviewable plan under `runtime/supervision-plan` without stopping processes or loading OS services. The plan contains the private runtime configuration and both service definitions. For a living backend, preparation requires its current recovery certificate and takes the environment from that process. Installation retains the prepared environment across the pause instead of replacing it with the installing shell’s values. An active unmanaged owner cannot change OS service ownership in place: complete a controlled initial shutdown before `omnitron service install`. Installation refuses a running backend or owner instead of stopping them implicitly.

The owner runs in `dev.omnitron.owner` on macOS or `omnitron-owner.service` on Linux. The existing daemon service runs a guardian, which owns all backend generations. It uses the same replacement and certified recovery functions as the CLI. CLI upgrades and recovery delegate through its private Unix socket, so a shell-launched successor cannot escape OS supervision. The selected backend’s private control identity determines its instance home before supervisor lookup; a custom public socket is never redirected to the invoking shell’s default instance. Recovery obtains the instance from the validated checkpoint or certified journal and checks its execution directory. A guardian refuses another instance’s upgrade or recovery. No public HTTP endpoint exposes this socket.

Before accepting the managed owner, the backend verifies native launchd/systemd main PIDs, its guardian parent and, on Linux, separate owner/backend cgroups. Configuration or environment flags alone cannot establish isolation. Service entry points verify their pinned artifact before importing the runtime. Backend candidates remain in the guardian's process group; the owner and application processes remain in their separate service.

If a backend dies, the guardian restores it only from a certified checkpoint or a recorded interrupted activation. If the guardian dies, the OS restarts it and the same ownership checks apply. Recovery retries use bounded backoff and preserve the reason when state cannot be proved. `omnitron service status` reads guardian diagnostics even while the backend is unavailable; private `execution/supervisor.log`, `supervisor-state.json` and `backend-startup.log` provide the underlying evidence. A living unverified backend is never duplicated or killed automatically.

The owner service deliberately does not restart after a crash on the same host boot. Some classic applications use separate process groups, so a fresh owner cannot assume all of its predecessor's processes disappeared. A durable receipt distinguishes clean shutdown, a new host boot and uncertain ownership. Reconcile the surviving processes before owner recovery; changing the receipt alone is not reconciliation. Normal `omnitron down` stops both services and applications, and `omnitron up` starts them again. Backend-only OS restarts retain applications when a certified checkpoint is available.

For system scope, prepare as the non-root instance owner with `omnitron service install --scope system --prepare`, then have an administrator install the reviewed unit files at their reported paths. System units name that account explicitly. Do not prepare the application runtime as root or copy secrets into unit environment directives. The private supervision record retains required runtime environment values; unit definitions carry only the instance path.

### Migrating an existing Linux node

A coupled daemon owns its application processes. Its first transition to independent system services requires a controlled application restart. Subsequent **backend** replacements retain the owner, application PIDs and runtime dependency bindings. Replacing the owner itself still requires a maintenance window.

Prepare a sealed copy using the Node executable and installed dependencies of that node. Before stopping anything, validate its application bootstrap readers, operational health, private socket permissions, native supervisor identity and saved environment. Save the old configuration, unit definitions, project registrations and online SQLite backups; prepare the new owner/backend units and a concrete rollback procedure alongside the running installation.

Preserve the existing instance account, home and application dependency bindings. Changing a root-owned legacy installation to another account is a separate migration: it can affect application files, credentials and container access. The automatic `service install --prepare` flow continues to require a non-root account for new system installations. An administrator-reviewed migration of an existing root-owned instance must explicitly retain that identity and private control paths; it does not authorize a second daemon or shared sockets.

During the approved window, disable file watching, stop applications gracefully, verify their processes have exited, and then retire the old daemon. Enable resident execution, select the sealed runtime and install the two independently supervised services. Start the owner before the backend. Confirm the original application inventory, operational health, ready recovery certificate, separate native cgroups and durable log delivery before proceeding to another node.

Plan process startup and domain readiness separately. A stream processor can be
online while it reconstructs a complete observation window; a healthy connection
or running PID is not evidence that its outputs are usable. Set the acceptance
budget from the workload's real data requirements, startup latency and sampling
cadence. For example, a five-minute input window can require a further full minute
at the boundary. A generic four-minute health timeout would force a needless
rollback and create a second gap in that input.

Record the latest pending check, its reason and elapsed waiting time. A later
successful connection replaces an earlier socket error in the diagnosis; do not
report that stale error when domain health is the actual blocker. Preserve the
original health result and withhold dependent outputs until it passes. Never
fabricate completeness, replay a missed forecast, or repeatedly restart a healthy
collector to clear a data-window warning. Include the same readiness requirements
in rollback verification. If runtime restoration has succeeded but data readiness
is pending, report those states separately and verify recovery before closing the
maintenance record.

Rollback restores service ownership, configuration and the retained runtime. It must first prove that the new owner and its application processes have stopped. Keep newly written logs, replication acknowledgments and application data: do not restore a pre-transition SQLite snapshot over them. Retain the failed transition's runtime and execution journals for diagnosis.

Remote application deployment recognizes a settled, sealed managed backend through its selected runtime, native guardian parent and separate owner/backend cgroups. A stale selection or mismatched process is refused. The coupled `fleet upgrade` workflow refuses an independently supervised node before stopping or rebinding any application. Use `fleet rollout` for registered remote managed backends and `backend upgrade <sealed-runtime>/packages/0/dist` for the local supervisor. Keep framework bundles still referenced by applications.

## Compatible schema expansion

Schema changes and backend replacement are separate operations. `omnitron backend schema prepare` reads the running master’s database and saves a private plan; `omnitron backend schema apply` applies or resumes that plan under the same Kysera advisory lock as normal Omnitron migrations.

If the active launcher predates these commands, invoke the verified candidate directly: `<candidate>/node <candidate>/packages/0/dist/cli/omnitron.js backend ...`. Installing an artifact alone does not select it or update the running launcher. After successful backend activation, the stable launcher uses the selected release.

Before preparing, activate a compatibility bridge that supports schema expansion protocol 1 while retaining the existing migration registry. For independent services, update the guardian to a release that understands schema plans. Both steps preserve the execution owner and application processes. A legacy backend without the compatibility protocol is refused.

```bash
omnitron backend schema prepare /absolute/releases/omnitron-next --json
omnitron backend schema apply /absolute/instance/runtime/schema-transition-ID.json --json
omnitron backend upgrade /absolute/releases/omnitron-next/packages/0/dist \
  --schema-plan /absolute/instance/runtime/schema-transition-ID.json --check
omnitron backend upgrade /absolute/releases/omnitron-next/packages/0/dist \
  --schema-plan /absolute/instance/runtime/schema-transition-ID.json
```

Preparation installs the sealed candidate without selecting or running it as the backend. The plan identifies both complete runtime hashes, the instance, the actual PostgreSQL database and schema identity, unchanged migration bodies, the ordered registry, exact new checksums, current history and retained owner. It contains no database password. Only migrations explicitly declared as backward-compatible expansions in the candidate’s reviewed policy qualify. A new filename alone is insufficient. The current policy permits adding replication receipt outcomes with an `unverified` default, preserving old writers and readers.

Apply verifies the live instance and selection again. It durably publishes the exact compatibility receipt **before** executing DDL, then checks the history again on Kysera’s locked connection. Database lock acquisition is bounded to five seconds per lock and individual statements to sixty seconds; a blocked database produces an error, not an unbounded schema wait. A coordinator interruption can leave an approved plan: rerun the same `apply` command. Committed additions are recognized by their recorded checksums and are not replayed. Unrelated history changes, drift, missing definitions or a different database stop the operation.

The daemon journal now stores new content checksums through Kysera’s nullable checksum column. Existing names, timestamps and unknown legacy checksums remain unchanged; this does not attest old source retroactively. Read-only inspection never creates the column. During migration setup, Kysera adds it while holding its existing lock. The deployed journal and lock identity are retained.

A compatibility runtime accepts future migration history only when a private receipt matches its own immutable artifact, original migration bodies, database identity and every observed future checksum. This also supports a cold restart after a migration commits but the coordinator dies before marking the plan complete. Unknown or checksum-less future rows are refused. A compatibility runtime cannot roll back migrations it does not own.

To return to the retained bridge, use `backend upgrade <bridge-dist> --schema-plan <same-plan>`. The schema stays expanded. Both upgrade and rollback revalidate the applied plan and database; `--schema-plan` is not a general compatibility override. Keep its plan, receipt, receipt index and both sealed releases for as long as rollback remains required.

After an application-level rollback, the additive schema may already be committed.
For a corrected candidate with **identical migration definitions**, prepare a new
binding from the retained, applied plan:

```bash
omnitron backend schema prepare /sealed/corrected-runtime --from-plan /private/applied-plan.json
omnitron backend schema apply /private/new-plan.json
```

Preparation verifies the original sealed runtimes, database identity, registry
order, migration bodies, checksums and complete execution history. It retains the
original baseline; legacy unknown checksums remain unknown. Applying the new
binding takes the same migration lock and performs no DDL when the reviewed
expansion is already complete. An unfinished plan must be resumed first; a new
migration, changed history or foreign rollback runtime is refused. The original
plan and receipt remain available for audit and rollback.

This workflow currently covers master PostgreSQL expansions. Local node SQLite transitions, destructive schema changes, order changes and edits to deployed migration bodies need a separate rollout. No public Console endpoint can execute schema plans or local artifacts.

## Updating the guardian

`omnitron backend guardian` manages the guardian independently of the backend selection and execution owner. For supported user services and qualified root-owned Linux system services, `omnitron backend guardian prepare` saves a plan and `omnitron backend guardian apply` applies or resumes it:

```sh
omnitron --json backend guardian prepare /absolute/releases/omnitron-next
omnitron --json backend guardian apply /absolute/instance/runtime/supervisor-transition-ID.json --check
```

Use a management runtime that provides `--check`. It reads the prepared plan and
rechecks the selected backend, owner, inventory, pending operations, native unit
and Linux stop boundary without starting the transition. Review `phase: prepared`
and `checked: true` before approval. A completed plan returns its earlier receipt
with `checked: false`, which is not a fresh readiness check. Apply performs the
checks again under the installation lease.

After reviewing the current evidence, apply the same plan separately.

```sh
omnitron --json backend guardian apply /absolute/instance/runtime/supervisor-transition-ID.json
```

If the installed launcher predates these commands, invoke the candidate's `node` executable and `packages/0/dist/cli/omnitron.js` directly. Preparation verifies and installs the sealed management runtime, records the loaded unit file and current owner/application identities, and saves a private plan. It does not stop services. The record contains the original supervision configuration and unit for recovery; do not publish its contents.

Apply drains and checkpoints the backend, records an activation intent, stops only the guardian's native OS job, atomically replaces its unit and private configuration, then starts the new guardian. The existing backend release is restored under that guardian with a fresh controller epoch. The owner and application processes remain in their separate job. CLI and Console requests pause while backend control is restored.

A pool can recycle a worker while a plan awaits review. If the read-only check
refuses a changed inventory before retirement, prepare a fresh plan and review its
new PID and inventory evidence. Preserve the old receipt. A change after the
transition started requires inspection of its original phase and checkpoint.

The plan is resumable: run the same `apply` command after a coordinator interruption. It refuses changed units, a different owner, changed application inventory or a conflicting activation. A completed plan returns its original receipt without starting another process; use `omnitron backend status` for current state. To return to a previous guardian, prepare a new plan for its retained sealed runtime. No database migration is performed, and backend candidate compatibility checks remain in effect.

Guardian replacement supports user launchd/systemd services and root-owned Linux
system services with a loaded, independently stoppable unit. For system scope,
preparation checks the installed unit, its executable, stop propagation, hooks
and drop-ins. Apply rechecks these properties and preserves the unit's account,
environment and working directory. Prepare and review a separate guardian plan
for installations that predate the fenced fleet handoff. Updating the execution owner's runtime still requires an application maintenance window.

The recovery checkpoint monitor retries a busy snapshot once after 250 ms. This
avoids repeatedly sampling a short metrics drain at the same phase of a shared
five-second period. A busy owner is never certified: controller generation,
in-flight operations and ownership revision must still agree. Persistently busy
state remains `pending`, and stopping the monitor cancels the scheduled retry.

## Owner shutdown boundaries

An owner update is a separate maintenance operation from a backend handoff.
Drain applications through the private owner control service, verify their PIDs
have exited, request graceful owner shutdown, and wait for its durable clean
receipt before unloading or replacing the native service. A timeout is a failed
transition; do not start a second owner or continue to the next host.

New systemd owner units use `SendSIGKILL=no` while retaining their cgroup and
`Restart=no`. A stop timeout leaves unresolved processes for explicit recovery;
it does not authorize a forced kill. Existing installed units retain their old
settings until a reviewed unit update. launchd retains its finite OS timeout:
complete the private graceful shutdown before unloading its job, rather than
setting an infinite system shutdown timeout.

The owner logs shutdown stages (`watchers`, `applications`, `processes`, `state`,
`logs`, `rpc`, `storage`, `complete`). Application-stop errors do not skip the final
process-manager termination attempt. Any failed application stop, manager drain,
termination or persistence step prevents a clean receipt; repeated shutdown calls
retain that failed result. Native PID lifetimes and empty process groups must still
be verified independently. Public application `stopAll` leaves the manager usable;
only the owner/lifecycle performs its terminal shutdown. Preserve an unclean receipt and the native journal. Recovery requires
proof about the recorded owner lifetime, stopped application inventory and empty
OS process groups; changing a receipt alone is never proof. Retain that evidence
and the original receipt when recording an explicit reconciliation.

Explicit crash reconciliation supports launchd on macOS and systemd system
services on Linux. The CLI seals the native observation before a separately
approved drain, then verifies it again before issuing a one-use acknowledgment.
The replacement owner checks the same evidence under an inherited-descriptor
kernel lock (`lockf` on macOS, `flock` on Linux). Helper exit leaves the lock held
by Node; process death releases it without stale lock-file deletion. The original
unclean receipt stays intact, and a durable consumption record prevents replay
across interrupted acknowledgment publication.

macOS evidence binds the launchd domain and boot-session UUID, PID birth identities,
observed descendants, retained process groups and execution-directory Unix sockets.
It includes non-Node workers. The host and process-lifetime fences share the stable
`kern.bootsessionuuid`; changing legacy `kern.boottime` text is never evidence of a
reboot. A dirty legacy receipt is preserved and can be bound to the current UUID
only by explicit sealed reconciliation. Clean legacy shutdown receipts remain
valid for ordinary startup; log assembly retains incomparable live legacy writers.
Unlike Linux cgroups, process groups cannot reveal
an unrecorded process that detached and reparented before observation. Supply the
complete recorded cohort and independently audit the drain; incomplete native
observations refuse recovery. Recovery never signals processes or adopts their
handles. See the [CLI recovery procedure](./cli.md#recover-after-an-execution-owner-crash).

## Changing owner log routing

A launchd unit generated by current Omnitron retains structured stdout together
with stderr; systemd uses the native journal. See
[owner and supervisor journals](./observability.md#owner-and-supervisor-journals)
for paths and retention boundaries. Previously generated launchd units may still
contain `StandardOutPath=/dev/null`.

For a logging-only correction, retain the exact owner runtime, Node executable,
arguments, environment and restart policy. Back up the installed unit and change
only its stdout destination. Prepare the rollback before unloading the job:
changing a plist on disk alone does not repair the live owner's stdout.
Stop the backend and owner gracefully, verify the clean owner shutdown receipt,
reload the corrected job, then restore the backend and the exact application
inventory. Confirm new JSON records and stderr reach the destination. If startup
or application health fails, stop the candidate jobs gracefully and reload the
saved unit with the same pinned runtime. Preserve databases and experiment data;
do not restore a stale database snapshot over new writes. An uncertain owner
shutdown requires reconciliation, not an automatic second owner.

## Long-lived RPC clients

The backend also reconnects to the resident execution owner after a broken private socket. Every connection rechecks socket ownership and permissions, then verifies the owner identity before sending retained event cursors, acknowledgments or mutations. A different owner is never adopted automatically. Observation polling uses its own transport with a four-second request deadline; a slow monitoring request cannot accumulate abandoned polls or interrupt a long-running application operation. An acknowledgment failure raises a separate diagnostic from an observation failure. Both resolve after the corresponding operation succeeds.

The clients returned by `createDaemonClient()` and the fleet TCP client reconnect on the next call after a backend disconnect. Service handles obtained with `client.service(name)` remain usable: each call resolves the service against the current connection. Netron still owns discovery, serialization, remote properties and stream transport.

Repeated or concurrent `Netron.connect(address)` calls share one persistent peer on that instance. An explicit replacement cancels an obsolete scheduled reconnect. Separate principals or independently owned connections require separate Netron instances with unique IDs.

Binary transport handshakes have a bounded lifetime. Disconnect rejects an unfinished connection immediately; stopping Netron cancels pending handshakes and reconnect timers. A late disconnect from a previous connection cannot remove a replacement peer with the same identity.

An invocation already sent when the connection fails is rejected immediately with `TransportLostError`, including its `pendingPacketId`. This is an unknown outcome, not a request timeout. **It is never replayed automatically:** a missing response does not prove that a mutation was not committed. Inspect the operation ID or current state before deciding whether to dispatch again. Live streams and references owned by the old connection must be reopened by their consumer.

During an orderly handoff, new requests and tasks receive an explicit `SHUTTING_DOWN` refusal while admitted work drains. A forced disconnect can still leave a reply unavailable. Persisted log and metric delivery is a separate protocol: journals/outboxes retain the original IDs until a database commit is confirmed, so lost acknowledgments can be replayed safely. See [capture, persistence and replay](./observability.md#capture-persistence-and-replay). Generic RPC calls, live streams and arbitrary event handlers do not acquire durable delivery from a transport reconnect.

Update long-running consumers to this client before relying on backend replacement. Updating the backend cannot replace client code already loaded in another process; older consumers that retain a raw service proxy need a separate controlled restart with the updated dependency. Pin that dependency independently of the backend, especially for applications with registered runtime integrity checks.

## Short-lived socket probes

Titan PM checks old Unix socket files before considering removal. A live connection remains open until the first server greeting, EOF or a bounded 250 ms deadline; only an explicit `ECONNREFUSED` on an old, unowned path permits removal. This avoids closing immediately before a retained application sends its greeting during backend startup.

Netron also cancels an unsent greeting when the connection closes and observes the write result. An expected pre-handshake close is a debug event; a write failure on an open connection is an error with `connectionId`, transport and `phase: handshake`. Do not suppress all transport write errors: a failed application RPC requires its own delivery assessment.

## Interrupted operation

Check the original command's error and the private execution directory before taking action. Never print or publish checkpoint contents: they include resolved configuration and environment variables.

| State | Action |
| --- | --- |
| Prepared, original backend has not retired | `omnitron backend abort /absolute/private/handoff-ID.json` resumes it |
| Backend retired or candidate failed; no backend is alive | `omnitron backend recover /absolute/private/handoff-ID.json` restores the previous artifact with a fresh epoch |
| Successor is ready, but selection publication was interrupted | `backend recover` validates its artifact, owner, epoch and inventory, then acknowledges that existing process |
| Backend marker belongs to an unrelated live process or the original active backend | Recovery refuses takeover; inspect it or abort a preparation that has not retired |
| Owner died, inventory changed or checkpoint is stale | Automatic recovery is refused; reconcile actual application state before planning maintenance |
| Journal commit is uncertain | Recovery reads the durable grant before preparing another epoch |

Recovery checkpoints describe a particular replacement, not a continuously updated backup of project state. They must not be replayed after unrelated configuration or application changes.

## Diagnostics and access

`omnitron status --json` includes `execution`; `omnitron backend status --json` reports the owner PID/identity, controller epoch, phase, observation age and blockers. A missing owner connection makes application state unknown. The backend does not infer that applications stopped from a control-channel failure. `execution.connection` reports `connected`, `unavailable` or `owner-changed`, the last successful observation timestamp and a concrete error. An observation older than five seconds is unavailable even before a failed request returns. `omnitron backend status` uses the independent control-status endpoint if application inventory cannot be read. Console Settings → General shows the same connection information and independent-supervision guardian PID; its status bar labels retained application counts as stale and checks backend reachability independently.

The owner's bounded live observation buffer retains 10,000 events. It is not the durable log archive. Updated owner/backend pairs capture full application records in a private SQLite journal, then confirm exact IDs and content only after database commit and file projection. `capture: legacy-owner` identifies the older volatile path, whose live log messages can be truncated to 4,096 characters; a backend-only update cannot repair it. Unacknowledged live observations may replay after replacement, and buffer overflow remains a visible diagnostic. Use [ingestion status](./observability.md#interpreting-diagnostics) and replication receipts to assess durable delivery independently of the live buffer.

Human viewer, operator and administrator roles, plus the explicit mesh observer identity, can read backend status. Artifact activation requires the local administrator Unix socket. HTTP administrators cannot obtain that private control address. Browser sessions retain the same RBAC enforcement as CLI RPC calls; no web endpoint accepts executable artifact paths.

Local application topology stays in the owner. Public backend transports reconnect across an update. Direct external consumers of application services exposed on the daemon's former Netron transport are not automatically forwarded to the owner; validate those integrations before enabling resident execution.

`OMNITRON_HOME=/absolute/instance` selects an isolated daemon state directory for tests or a separately configured instance. Console containers have an instance-specific name and ownership label; the default instance retains `omnitron-nginx`. A legacy container must prove ownership through its configuration mount before it can be replaced or stopped. Shutdown of an instance without Console enabled never removes a Console container. Application paths and stack infrastructure are not remapped; distinct listeners and infrastructure configuration are still required. Do not change the shell's `HOME` to isolate a daemon.

## Upgrade a fleet of managed backends

A standalone controller can distribute and activate an Omnitron backend on up to
128 registered remote Linux servers with independent systemd supervision. All
targets must have a pinned SSH host key, a healthy execution owner and a guardian
advertising `kernelHandoff@1`. The controller updates servers in the requested
order and verifies each handoff before contacting the next server for activation.
Application processes stay with their existing owner.

For an older guardian, qualify its transition on native Linux before the maintenance
window. In the repository’s GitHub Actions, run **Qualify a managed backend handoff**
with the full serving and candidate commits and the exact target Node version.
The test starts an application, replaces the guardian, verifies owner identity and
exercises a backend update and rollback while checking application requests and logs.
Use the [guardian transition procedure](#updating-the-guardian) for the
one-time installation. Fleet handoff starts only after the guardian supports the
protocol. The first management runtime must be installed through a separately
qualified native path, rather than asking an older guardian to perform an
unsupported fleet handoff.

### Publish the batch to the controller

Build and qualify the same clean Git commit for each distinct Linux architecture
and exact Node version in the fleet. Import the sealed directories under the
controller's daemon account. A release pipeline can perform this step once per
variant. Several servers can reuse one build.

```sh
omnitron fleet rollout import /builds/linux-x64-node22/runtime /builds/linux-x64-node24/runtime
omnitron --json fleet rollout builds
```

The private catalog records the source commit, target platform and Node version,
runtime SHA-256, compressed archive SHA-256 and byte count. A repeated import of
the same build is safe. A different runtime for the same commit and target
requires resolving the build discrepancy. The publisher can admit foreign
architectures without executing the contained Node binary. Only the local
publisher can supply filesystem paths.

### Distribute, review and activate

For a canary followed by production, substitute the actual 40-character commit
and registered node names. With no node arguments the controller selects all
registered remote nodes in name order. The local controller has its own handoff
procedure.

```sh
omnitron --json fleet rollout plan <commit> test-node production-node --stage --wait
omnitron --json fleet rollout apply <plan-id> --wait
```

For a qualified batch in a scheduled window, distribution, qualification and
activation can be requested from one command.

```sh
omnitron --json fleet rollout plan <commit> test-node production-node --stage --apply --wait
```

With `--stage`, the controller matches each serving runtime to an exact catalog
variant, transfers it over the enrolled SSH connection and asks the receiving
installation to verify and store it. Staging preserves the active selection.
Omit `--stage` to inspect builds already installed through
`omnitron backend install <runtime>`. A single blocked target prevents activation
of the entire plan. A successful plan records the exact rollback artifact,
candidate, current selection revision, backend PID, owner and application inventory.

In Console, open **Nodes → Managed backend updates → Plan update**. Choose a catalog
commit and select the servers in canary order, or explicitly choose **All
registered remote nodes**. An empty selection does not authorize the whole fleet.
Enable **Stage from controller catalog** if distribution is required. Review the
per-server results and choose **Apply reviewed plan**. The Nodes URL's `?rollout=<plan-id>` and `fleet rollout status
<plan-id>` refer to the same persisted operation. CLI and Console show the overall
batch state and each target's outcome. If preparation is blocked, inspect the affected target in Console or its `data.targets[].reason` in `omnitron --json fleet rollout status <plan-id>`. The reason describes the failing check. For example, if the guardian reports an operation in progress, inspect that operation before preparing a fresh plan. The original receipt remains available under its ID.

The advanced workspace source bundle panel
reports a separate legacy operation.
After each successful handoff, the controller checks application readiness and
owner identity and continues to the next server. If your acceptance procedure
also requires a replication watermark to advance, a public transaction to
succeed or an operator to inspect the result, use one plan for the canary.
Complete that check before submitting a second plan for the remaining servers.
Administrative sessions can prepare, start and reconcile a rollout. Read access
lets operators and viewers follow progress. Each server operation rechecks the
initiating administrator's authority.

A healthy pool rotation can change a PID or inventory digest after qualification.
If dispatch has not started, create a new plan and review its fresh identities.
Keep the original receipt for audit. A stale refusal is not evidence that an
activation happened or that rollback ran. After dispatch, inspect the original
ID. Follow an operation that is still running and reconcile an uncertain outcome
before creating another plan.

### Reverse an accepted node

Reverse a successfully accepted, healthy target with a new plan ID. Name exactly
one node and use its previous full source commit. Its retained runtime is already
installed, so omit `--stage`.

```sh
omnitron --json fleet rollout plan <previous-full-commit> production-node --wait
```

Inspect the JSON before applying. Confirm exactly one ready target and unchanged
owner identity and PID. Its `previous` must match the accepted runtime. Its
`candidate` must match the full SHA-256 saved for that node in the forward receipt.
JSON exposes complete hashes.

```sh
omnitron --json fleet rollout apply <new-plan-id> --wait
```

If readiness has degraded, stop further updates and inspect selection, owner and
inventory. Reconcile an uncertain receipt first. Reconciliation observes the
outcome without reversing it. A refused reverse plan requires a separately
reviewed fenced recovery procedure.

### Follow a batch or recover an interrupted handoff

```sh
omnitron --json fleet rollout status <plan-id> --wait
omnitron --json fleet rollout reconcile <plan-id>
```

Planning returns an ID while qualification continues. With `--apply` the CLI
waits for qualification before submitting the reviewed identity. Use `--json`
for automation and `--request-id <uuid>` when a caller needs idempotent planning.
The same ID binds the requested commit, node selection and staging choice.
Closing a client after submission leaves accepted work on the controller.

On activation failure the controller stops dispatching later nodes and records
the observed outcome. Before dispatch, a refusal leaves the incumbent in place.
A `failed` target can describe an unchanged original runtime, PID and selection
revision. A `rolled-back` target requires evidence of activation followed by return
to the pinned previous runtime. Merely seeing the previous artifact does not
prove a rollback.

A confirmed candidate with failed readiness can be handed back when the guardian
still verifies ownership. Previously successful nodes retain their accepted
versions. A batch can therefore be `failed` while an earlier target is
`succeeded` and later targets were never dispatched. CLI and Console retain these
per-target outcomes, including the authoritative reconciliation result while a
follow-up read is unavailable.

A post-dispatch `uncertain` receipt blocks a new rollout until reconciliation
checks live evidence. Reconciliation observes the node without replaying the
handoff or repairing an unhealthy application. If identity cannot be proven, the
operation stays uncertain. After reviewing a terminal result, create a new plan
for any remaining nodes.

Elected multi-controller clusters require recipient-side fencing across leaders;
this workflow refuses dispatch in that configuration. Upgrading the execution
owner, changing Node versions or applying schema changes each requires a
separately qualified transition. The local Console container follows its
controller's publication procedure.
