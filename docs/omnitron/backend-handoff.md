---
title: Backend replacement
description: Replace a control plane while a resident owner retains application processes.
---

# Backend replacement

Resident execution separates the backend from the process that owns applications. `omnitron backend upgrade` replaces the backend while the resident owner keeps application PIDs, pools, local topology routes, watchers and disk log capture. CLI and Console requests pause during replacement and reconnect afterwards; this is not uninterrupted control-plane availability.

Resident execution is opt-in on POSIX. It supports unmanaged operation and separate OS services for the execution owner and backend guardian. A legacy single-service layout is refused: detaching a child does not establish independent service ownership. Replacing the owner or its Node runtime still requires an application maintenance window.

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

The freezer copies the installed runtime dependency closure and the current Node executable, rewrites package links inside the artifact, and records file hashes in `RUNTIME.json`. It performs no install scripts, package upgrades or network operations. Optional `package=compiled-package-directory` arguments select explicitly built workspace packages; their versions must match the installed graph. Keep the current sealed artifact for rollback.

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

`--check` validates both candidate and rollback artifacts without draining requests. Activation repeats validation before retirement. Changed database migration files are refused; a schema transition requires a separate reviewed deployment. A replacement also inspects the existing migration journal through Omnitron’s shared Kysera runner before opening public ingress. Pending, changed or unknown migrations refuse readiness; this check never creates history or applies migrations. Legacy records without checksums remain explicitly unverified by `omnitron migrate verify --daemon`. Applying a migration separately does not bypass the artifact compatibility check.

The replacement proceeds through these boundaries:

1. Reject active SSH sessions, file transfers, pipelines and release builds. Drain admitted requests and infrastructure reconciliation.
2. Verify and install candidate/rollback artifacts; validate native container identity and specifications. Capture project ownership, retry backoff, monitoring configuration and application identities in a private checkpoint.
3. Fence execution mutations with a new controller epoch. Persist the grant before enabling the new controller; stale controllers cannot write or acknowledge observations.
4. Retire only backend services. The owner continues running applications and capturing logs.
5. Start the candidate, adopt existing infrastructure without provisioning it, and keep public RPC unavailable until adoption completes.
6. Verify public readiness, owner identity, epoch, application PIDs, start times and restart counts. Only then complete retirement.

A failed candidate is stopped and the previous artifact is started under a fresh epoch. Rollback does not reuse an old grant. A failure to prove identity or inventory preservation stops automatic recovery rather than guessing which processes to kill or relaunch.

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

## Long-lived RPC clients

The backend also reconnects to the resident execution owner after a broken private socket. Every connection rechecks socket ownership and permissions, then verifies the owner identity before sending retained event cursors, acknowledgments or mutations. A different owner is never adopted automatically. Observation polling uses its own transport with a four-second request deadline; a slow monitoring request cannot accumulate abandoned polls or interrupt a long-running application operation. An acknowledgment failure raises a separate diagnostic from an observation failure. Both resolve after the corresponding operation succeeds.

The clients returned by `createDaemonClient()` and the fleet TCP client reconnect on the next call after a backend disconnect. Service handles obtained with `client.service(name)` remain usable: each call resolves the service against the current connection. Netron still owns discovery, serialization, remote properties and stream transport.

An invocation already sent when the connection fails is rejected with transport loss. **It is never replayed automatically:** a missing response does not prove that a mutation was not committed. Inspect the operation ID or current state before deciding whether to dispatch again. Live streams and references owned by the old connection must be reopened by their consumer.

Update long-running consumers to this client before relying on backend replacement. Updating the backend cannot replace client code already loaded in another process; older consumers that retain a raw service proxy need a separate controlled restart with the updated dependency. Pin that dependency independently of the backend, especially for applications with registered runtime integrity checks.

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

The owner's bounded live observation buffer retains 10,000 events, with long live log entries truncated to 4,096 characters. Full application lines continue to disk. When a retained local application has no current in-memory log records, `omnitron logs` reads its stored local history; it excludes replicated records from other nodes with the same application name. Unacknowledged observations replay after controller replacement; a crash between processing and acknowledgment can replay an event. Buffer overflow produces a visible diagnostic and can leave historical metrics incomplete. This channel does not promise exactly-once telemetry.

Human viewer, operator and administrator roles, plus the explicit mesh observer identity, can read backend status. Artifact activation requires the local administrator Unix socket. HTTP administrators cannot obtain that private control address. Browser sessions retain the same RBAC enforcement as CLI RPC calls; no web endpoint accepts executable artifact paths.

Local application topology stays in the owner. Public backend transports reconnect across an update. Direct external consumers of application services exposed on the daemon's former Netron transport are not automatically forwarded to the owner; validate those integrations before enabling resident execution.

`OMNITRON_HOME=/absolute/instance` selects an isolated daemon state directory for tests or a separately configured instance. Console containers have an instance-specific name and ownership label; the default instance retains `omnitron-nginx`. A legacy container must prove ownership through its configuration mount before it can be replaced or stopped. Shutdown of an instance without Console enabled never removes a Console container. Application paths and stack infrastructure are not remapped; distinct listeners and infrastructure configuration are still required. Do not change the shell's `HOME` to isolate a daemon.
