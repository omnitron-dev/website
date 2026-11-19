---
id: "omnitron/automation"
slug: "/docs/omnitron/automation"
title: Xec automation
description: Author, review, execute and inspect bounded Xec pipelines through Console and CLI.
---

# Xec automation

Use **Pipelines** in Console to create an automation, review its source and targets, run it with parameters, and inspect each step. Definitions belong to the daemon. In the 0.4.13 source, selecting a project or stack shows definitions whose release or deployment steps target it. Runs use the targets captured at admission. The Omnitron workspace includes shell-only definitions and older runs with no recorded targets. The backend checks operator authorization on every operation. The CLI calls the same `OmnitronPipelines` service. Omnitron owns authority, persistent run state and presentation; `@xec-sh/ops` owns the execution graph, retries and cancellation; `@xec-sh/core` owns local and SSH process execution.

This executor is for trusted administrators. A separate child process prevents a script from blocking the daemon's JavaScript event loop, but does **not** sandbox its filesystem, network or operating-system privileges. Do not give an untrusted agent the local daemon socket or this executor. See the [agent integration design](./agents.md).

In Omnitron `main` after 0.4.14, the Console dependency editor lets you connect pipeline steps and review their predecessors with the keyboard. It saves the same `dependsOn` edges the CLI reads, and the server checks the graph before it is saved. Acceptance criteria for additional workflow operations and durable waits are in the [workflow runtime contract](./workflow-runtime.md).

For disk-space events, thresholds, local notifications and handing a task to a Studio member, open **Flows**. A flow can request review or start an already approved release-only pipeline. [Event flows](./flows.md)

## First automation {#first-automation}

Save this as `inspect.json`, replacing the working directory with an existing project directory:

```json
{
  "name": "inspect-runtime",
  "description": "Inspect a runtime before planning a change",
  "steps": [
    {
      "name": "runtime",
      "kind": "xec",
      "cwd": "/srv/projects/example",
      "timeout": 30000,
      "run": "const label: string = String(params.label ?? 'runtime'); console.log(label); await $target`node --version`;"
    }
  ]
}
```

```bash
omnitron pipeline save inspect.json
omnitron pipeline list
omnitron pipeline run <pipeline-id> --params-file parameters.json
omnitron pipeline status <run-id> --output
omnitron pipeline status <run-id> --json
omnitron pipeline cancel <run-id>
```

`parameters.json` contains a JSON object, for example `{"label":"candidate"}`. Keep private parameter files outside version control. Parameter values travel as data and are represented as `[provided]` in run history. This does not make deliberate printing or copying of a secret safe.

Every pipeline command supports the global `--json` flag or `OMNITRON_OUTPUT=json`. Successful requests emit one `{ok: true, data: ...}` object on stdout; request failures emit `{ok: false, error: ...}` on stderr. A status request for a failed, cancelled or interrupted run still returns its record, with exit code 1.

To update an existing automation without replacing its identity or run history, first review its definition and `revision` in `omnitron --json pipeline list`, then run:

```bash
omnitron pipeline save inspect.json --id <pipeline-id> --expected-revision <reviewed-sha256>
```

The update compares that revision inside a database transaction. If another editor changed the definition, the save fails without replacing their work. Console sends the revision loaded when its editor opened and keeps your draft on a conflict. Reopen the current definition and reconcile both edits before saving again. Prefer IDs when names are ambiguous.

## Durable requests {#durable-requests}

**Available from Omnitron 0.4.13.**
Update the controller and its clients together before using these commands.
The new clients require `prepareRun` and `startRun`; they do not silently fall
back to an older daemon's non-idempotent execution endpoint.

```bash
omnitron pipeline run <pipeline-id> --prepare --run-id <uuid-v4> --params-file parameters.json --json
omnitron pipeline start <run-id> --expected-digest <review-digest> --params-file parameters.json
omnitron pipeline status <run-id> --json
```

Use `omnitron pipeline start` to admit a saved request. Generate and retain the
UUID before dispatch. Preparation saves one request in
`awaiting-review`, bound to the definition revision and a private keyed commitment
to its parameters. It performs no commands and occupies no worker. Read
`review.digest` from that record, review the definition, then start the same ID
with that digest and the same parameters. Parameter values are supplied again;
they are not copied into the admission record. Another administrator may approve
it; the receipt distinguishes `triggeredBy` from `startedBy`.

Console uses the same sequence: **Run → Prepare request → Run automation**.
Closing the dialog retains the pending request in history. Reopen it with
**Review request**, or cancel it without starting work. MCP exposes the same
`pipeline.prepare`, `pipeline.start` and `pipeline.status` operations. These
remain administrative tools, not a sandbox for untrusted agents.

A conditional database update claims a request once. If a reply is lost, query
its ID or repeat `start` with the same digest and parameters. A completed
receipt remains recoverable after daemon restart. Repeating a request with
another pipeline, revision or parameter set is rejected. An edited definition
invalidates an unstarted review; prepare a new request for the new definition.

Registered release projects have a two-run limit within the daemon's eight-run
limit. Unscoped shell and TypeScript pipelines share a separate two-run budget.
A waiting review holds no slot, so another project can finish independently.
Capacity rejection leaves the original request awaiting review; it does not
create a replacement command or silently enqueue an unbounded task.

## Continue an interrupted graph {#continue-an-interrupted-graph}

Development `main` retains the exact admitted definition privately. Changing the
editable automation does not change an existing run. After an interruption:

```bash
omnitron pipeline status <run-id> --json
omnitron pipeline reconcile <run-id> --json
omnitron pipeline resume <run-id> --expected-digest <recovery-digest> --params-file parameters.json
```

`omnitron pipeline reconcile` inspects receiver evidence; `omnitron pipeline resume` continues a reviewed checkpoint.
`recovery` lists `completed`, `pending` and `blocked` steps. Read its current
`digest` before resuming. Confirmed steps are never run again. Steps without a
persisted dispatch record continue in the existing Xec graph. Started shell,
TypeScript and compiled-entry operations with unknown effects block continuation;
there is no unsafe “force success” operation. Reconciliation is read-only at the
receiver and updates only the local evidence. Supply the original parameters;
the saved private commitment rejects different values. Repeating the same resume
returns its existing receipt. A stale checkpoint is rejected.

Console exposes **Inspect remote receipts** and **Continue remaining steps** in
run details. MCP uses `pipeline.reconcile` and `pipeline.resume` with the same
review and authority checks. This is step-boundary recovery, not resumption of
JavaScript stacks or arbitrary scripts midway. Definition history does not freeze
an arbitrary working directory. Sealed release steps retain their separate payload
verification. Deduplication ends when terminal history is deleted.

## Reconcile a remote deployment {#reconcile-a-remote-deployment}

A deployment step invokes the ordinary ProjectService stack lifecycle, including
its release checks, locks and node transport. Obtain the release manifest digest
and a preservation review from the normal stack workflow before saving this step:

```json
{
  "name": "deploy-test",
  "kind": "deploy",
  "target": {
    "project": "sample",
    "stack": "test",
    "releaseId": "candidate",
    "manifestSha256": "<64-character-manifest-sha256>",
    "review": "<64-character-stack-preservation-review>"
  }
}
```

Replace both digest placeholders with reviewed values. The target must be a remote
or cluster stack. Shell, environment, working-directory and retry overrides are
forbidden: native deployment owns those mechanics. Use the Advanced JSON editor
or `pipeline save`; the visual editor preserves the target.

Before dispatch the run persists its expected node/application/artifact set.
After a lost response, reconciliation reads fresh **verified-launch** receipts
from every expected replica. It checks producer and consumer releases, manifest,
artifact, installed-tree evidence and live application state. Missing replicas,
changed placements, modified payloads and unreachable nodes remain unconfirmed.
The selected release and files on disk alone cannot confirm a running deployment.

A matching observation has basis `observed-target`: the desired release is now
running, but this does not prove which request caused its launch or that arbitrary
business effects succeeded. Reconciliation never redeploys. Once every receipt
matches, review the new recovery digest and continue dependent steps. Cancellation
stops later steps and waits for an already dispatched native operation to settle;
it does not reverse the deployment. Cross-controller outbox dispatch, arbitrary
connector reconciliation and exactly-once business effects remain out of scope.

## Steps and targets {#steps-and-targets}

| Field | Meaning |
| --- | --- |
| `name` | Unique graph key, 1–80 letters, digits, `_`, `.` or `-` |
| `kind` | `shell` by default; `xec` for TypeScript; `release` for a pinned compiled entry; `deploy` for a reviewed remote stack |
| `run` | Shell source or TypeScript script; absent for release/deploy steps |
| `target` | Release: project, stack, app, artifact and entry; deploy: project, stack, release ID, manifest and preservation review |
| `args` | Release step only: literal argument strings |
| `cwd` | Existing working directory; module imports resolve relative to it |
| `nodeId` | Registered node ID; omission or `local` selects the local machine |
| `dependsOn` | Names of steps that must complete first |
| `timeout` | Step deadline in milliseconds; default five minutes, maximum 24 hours |
| `retries` | Additional attempts, 0–5; only use with repeatable operations |
| `env` | Explicit environment entries |
| `condition` | A small parameter expression, such as `params.enabled` or `params.stage == 'test'` |

An Xec script receives `params`, `$` for local commands and `$target` for the selected target. TypeScript runs in a local child process; selecting a remote node does not move that interpreter to the node. Use `$target` for remote commands. The server resolves SSH credentials from the node registry and vault and requires a trusted host key. The browser never receives credentials.

Shell steps receive parameters as `OMNITRON_PARAMS` JSON. `{{parameter}}` source substitution is rejected. Unsupported conditions and cron/webhook triggers are rejected rather than silently ignored; this release supports manual triggers. Xec validates the complete dependency graph before any step executes.

From Omnitron 0.3.5 with Xec Ops 0.11.4, SSH shell steps receive their declared environment and `OMNITRON_PARAMS`. Local callbacks can still read the controller environment. Configure credentials and paths on the node that owns them.

## Execute a pinned release {#execute-a-pinned-release}

Use `kind: 'release'` when an operation must run a compiled member of an installed
application release. The definition pins a producer artifact and a package-relative
entry. Omnitron verifies the selected installation and uses the resident execution
owner's Node through the existing Xec executor. The definition contains no physical
installation path or interpreter path.

A caller running at its registered compiled launch entry can obtain the producer
identity through the public runtime API:

```ts
import { verifyInstalledRuntime } from '@omnitron-dev/omnitron/runtime';
import type { PipelineDef } from '@omnitron-dev/omnitron/dto/services';

const runtime = await verifyInstalledRuntime(new URL(import.meta.url));
if (runtime.state !== 'verified') throw Error(runtime.reason);
const definition: PipelineDef = {
  name: 'publish-results',
  steps: [{
    name: 'publish',
    kind: 'release',
    target: {
      project: 'sample', stack: 'tools', app: 'publisher',
      artifact: runtime.producer,
      entry: 'dist/publish.js',
    },
    cwd: '/srv/sample-output',
    args: ['--checked'],
    timeout: 180000,
    retries: 0,
  }],
};
```

`artifact` records `releaseId`, `manifestSha256`, `artifactSha256`, `producerApp`,
`projectCommit` and `frameworkCommit`. An imported artifact retains its producer;
the run records the selected consumer release separately. The entry must be a
physical compiled JavaScript member of the same verified closure. Arguments are
literal array elements; parameters remain JSON in `OMNITRON_PARAMS`.

Prepare and select the release through the ordinary stack lifecycle before
admitting the pipeline. Admission checks the installation, source identity,
selected release, declaration, environment and native owner binding again before
each attempt. It does not install or prepare a missing artifact, provision
infrastructure, change release selection or start the application. This contract
supports independently owned local stacks; remote release targets are refused.
It keeps the admitted owner during the run. Repeated full verification can be
expensive for large closures.

Use the ordinary pipeline save/run commands or Console's Advanced JSON editor.
Saving retains the target and arguments. Changing the owner can change the
verified physical installation without changing the logical definition, ID or
history; selecting a different producer requires an explicit reviewed update.
Run details show per-attempt artifact, installed-tree, executable, target, native
owner lifetime, process ID and environment fingerprint. Environment values are
not copied into that evidence.

The release step cannot set `PATH`, `NODE_OPTIONS` or `NODE_PATH`. The verified
application supplies its resource-only Node options. Inherited or declared
`LD_*` and `DYLD_*` loader controls are refused; Linux library paths are derived
only from the verified closure. `cwd` must be an absolute physical directory,
and application output belongs outside the immutable installation.

## Review and authority {#review-and-authority}

Every public pipeline method requires `admin`. Invocation revalidates the human session, including its current account role. Sensitive mutations must write an audit intent before taking effect; a failed audit write denies the operation. The owner-only Unix socket remains an OS-authorized administrative interface.

The run review shows source, target name and ID, working directory, dependencies, retries, condition and environment. Expand each step before admitting it.

The definition carries a SHA-256 `revision`. Console submits the revision displayed for review; the CLI fetches the selected definition immediately before admission. Direct RPC and MCP callers must supply `expectedRevision` for both execution and updates. If source, targets, environment or other stored definition fields changed, admission fails before inserting a run. This is optimistic concurrency control, not a separate multi-person approval workflow.

Per-step history records a digest of the admitted definition, target ID, actor, attempts, timing, outcome and bounded stdout/stderr. New admissions privately retain the serialized definition for step-boundary recovery. They do not archive arbitrary working directories or resolve unknown external effects.

## Upgrading existing integrations {#upgrading-existing-integrations}

Review saved definitions and their callers when upgrading the pipeline contract:

- Step names are stable identifiers of 1–80 letters, digits, underscores, dots or hyphens. Update dependency references when renaming a step.
- Direct RPC callers fetch the definition and submit its `revision` as `expectedRevision`. Before updating, require `conditionalUpdates: true` in that response; older daemons ignore extra request fields and cannot enforce an update precondition. A recurring operator should pin the reviewed revision and stop dispatching after a conflict until the operator reviews the change; it must not automatically accept a newer definition.
- Replace source interpolation with data parameters and remove unsupported trigger descriptors. Existing external schedulers can continue to dispatch manual runs.
- New release-bound integrations use `kind: 'release'` and a producer artifact identity. The owner resolves the physical executable. Existing shell definitions that compare absolute paths or generated `PATH` values need a separately reviewed caller and an explicit conditional definition update; this framework contract does not rewrite them automatically.

Validate the updated definitions before enabling recurring dispatch. Re-registering a definition is separate from executing its deployment or publication steps.

A pinned recurring application does not automatically pin the programs launched by shell steps. Package one-shot entry points with the application and use a release target for those compiled members. Keep mutable data directories separate. The dispatcher must require the reviewed target, arguments, environment and revision. Moving to another producer requires an explicit conditional definition update; it must not silently accept a changed pipeline or compile a helper from a development checkout during a production run.

## Progress and failure {#progress-and-failure}

Console shows individual step states, elapsed time, attempt counts, exit codes and output. Open a run for details; the history table fetches summaries without downloading every run's output. A failed refresh is displayed as stale data. On narrow windows, details use the full viewport and long code/output remains inside its scroll area.

`omnitron pipeline cancel <run-id>` first records `cancelling`, signals active work and awaits executor termination before returning a terminal state. Dependent steps do not start after cancellation. A daemon restart marks unfinished runs `interrupted`; it never replays operations automatically. Inspect external effects before retrying an interrupted run.

Release attempts retain `prepared`, `started`, `completed` or `unconfirmed`
execution evidence. If execution began but its binding or durable completion
cannot be confirmed, the attempt is `unconfirmed` and automatic retries are
refused. Recovery marks unfinished prepared/started attempts unconfirmed while
preserving completed attempts. Missing spawn acknowledgement does not prove that
no effect occurred. Inspect effects before explicitly running again. The owner
proof is an observation, not an operating-system process lease or a promise of
exactly-once execution.

Local process groups and Xec SSH channels participate in cancellation. A command that deliberately detaches a remote process can outlive its SSH channel; channel closure is not proof that every remote side effect stopped. Use managed Omnitron jobs or an explicitly reversible playbook for long-lived services.

## SSH ownership and uncertain effects {#ssh-ownership-and-uncertain-effects}

Omnitron owns authorization, trusted node identities, durable operation state,
audit and presentation. Xec owns SSH authentication, host verification, connection
reuse, channels, SFTP, forwarding and cancellation. Applications must use the Xec
API and public types rather than importing its transport library or adding a
parallel connection pool.

Xec 0.12 distinguishes `outcome-unknown` from a known command
failure: losing a reply after dispatch does not prove whether an operation ran.
The execution boundary refuses automatic replay and exposes `recoverable: false`. Inspect
the remote effect or reconcile an operation receipt before an explicit retry.
SFTP interruption can leave a partial destination; upload/download helpers are not
atomic deployment transactions. Omnitron's durable operation model must preserve
that distinction through both CLI and Console.

The [release checklist](./release-readiness.md) distinguishes this verified source
candidate from installed fleet behavior. Dependency publication and coordinated
activation remain separate steps. Existing applications do not need a direct SSH
transport dependency.

## Resource bounds {#resource-bounds}

| Resource | Bound |
| --- | --- |
| Steps per definition | 32 |
| Active runs per daemon | 8 |
| Concurrent steps per run | 4 |
| Source per step | 128 KiB |
| Parameters | 64 scalar JSON values, 16 KiB total |
| Retained stdout/stderr | 32 KiB per stream and step |
| History request | At most 200 summaries |

Output persistence is throttled and awaited, applying backpressure instead of starting unbounded database writes. Xec's SSH stream honors writable backpressure and avoids a second unbounded capture. History reports truncation explicitly. Known parameter/credential values and private-key blocks are redacted; redaction is best effort and does not replace secret isolation.

The daemon exposes bounded-label run counters and duration histograms through the existing Titan metrics path. Code, user parameters and run IDs are not metric labels. See [Observability](./observability.md) for querying signals and [Console access](./access.md) for effective grants.
