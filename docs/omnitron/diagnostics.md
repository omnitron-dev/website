---
title: Operational diagnostics
---

A diagnostic must say what failed, what was observed, and what can restore
service. Omnitron uses the same finding contract in commands, runtime health and
notification adapters. Capture does not mean recovery, and broker acceptance
does not mean a person received a message.

## Investigate a failure

```bash
omnitron --json health
omnitron --json doctor
omnitron logs omnitron -n 100
omnitron inspect project/stack/application
omnitron migrate status --daemon
```

The Console's node diagnostics show the same health indicators as the CLI. The
`runtime-diagnostics` indicator retains unresolved runtime failures. Expand
**Evidence and recovery** to see causes, occurrence counts and next steps; the
log link preserves the selected node.

| Failure boundary | Evidence and response |
| --- | --- |
| Application process | Titan classifies operational errors and controls shutdown; Omnitron supervises process state and captures logs |
| Daemon process | Unhandled rejections, uncaught exceptions and startup failures produce structured, redacted diagnostics |
| Scheduled work | Session cleanup, metrics, alert evaluation, fleet heartbeat, log rotation and replication retain failure state until a successful run |
| Startup dependencies | Failed migrations, missing scheduler registration, telemetry, traces and leader election remain visible in health |
| Database | Query rejection, nested causes, driver codes, transaction/rollback failures and migration integrity remain distinguishable |
| Event observers | Async regular and wildcard failures reach the caller; notification lifecycle observer failures degrade health without resending delivered messages |
| Alert delivery | The existing alert outbox retains pending transitions and records delivery failures, including absent consumers |
| Notification transport | The diagnostic adapter distinguishes queued, duplicate, unavailable consumer and failed publication |

Runtime health is a bounded projection of this daemon process, not a second
persistent event store. It keeps at most 100 active diagnostic codes and counts
repeats. The daemon log is the persistent record. Evicted records are reported as
lost projection coverage; restarting clears process-local state, not the log.
Unhandled failures are not automatically declared recovered. Periodic jobs clear
their own finding only after their next successful execution.

The process monitor observes exceptions without replacing Titan's shutdown
policy. A fatal exception is not made safe by logging it. A healthy status also
does not prove application correctness: register domain health checks and
monitor their coverage. Older daemons without the runtime indicator appear as
unexamined coverage in `doctor`.

## Domain readiness

Process state and readiness answer different questions. `online` means the
supervised process is running. A worker with a working event loop can still be
unable to commit data or complete its business operation.

Implement `hooks.onHealthCheck(app)` in the bootstrap and return the public
`AppHealthAnswer` contract:

```typescript
import type { AppHealthAnswer } from '@omnitron-dev/omnitron';

const report: AppHealthAnswer = {
  status: 'unhealthy',
  checks: [{
    name: 'ingestion',
    status: 'fail',
    message: 'source_stale: no committed observations in the required window. Check collector errors and queue write capacity.',
  }],
};
```

Name the failed dependency or stream. Include the stable error code, the observed
condition, the effect on service and the next useful check. Return these in
`checks[].message`; a private `details` object is not forwarded as diagnostic
checks. The daemon prefixes application/process names and carries the same
messages to `omnitron health <app>` and the Console's application health view.

- Probe successful work and freshness, not connectivity alone. Redis can answer
  `PING` while rejecting writes with OOM; a collector can receive events without
  committing any of them.
- Account for every required stream. Missing results, stale cycles and unreadable
  answers must not become healthy through an empty list or a default status.
- Preserve a worker's failure verdict when adapting an older health shape. Do not
  promote it because the adapter cannot identify the cause.
- Log failure and recovery transitions with Titan's structured logger. Include
  resource identity and evidence, suppress unchanged healthy polls, and avoid
  secrets and raw request payloads.
- Restore health only after the required work succeeds. Reconnecting a source
  may leave a data window incomplete for several minutes; retain that explanation
  until the window is usable. Do not erase failure evidence or invent missing data.

For registered experiments, place diagnostic adapters outside immutable worker
artifacts. Verify the pinned artifacts before and after activation, and restart
only the affected worker. Operational recovery must not silently create a new
implementation under an existing experiment identity.

## Supervise maintenance with the same health contract

Declare infrastructure maintenance as an ecosystem application when it needs an
independent lifecycle. Use Titan Scheduler for intervals, overlap prevention and
shutdown. Return named checks through `onHealthCheck`, so the CLI and Console
report the same policy, last completed attempt, dependency capacity and recovery
action. A scheduler tick alone is not proof that its operation succeeded.

For a durable stream pipeline, a safe cleanup policy needs both an age boundary
and acknowledgement by every consumer group. Inspect group positions and pending
entries atomically with deletion; a boundary computed by a previous observation
can already be stale. Refuse cleanup when the required journal consumer is
missing. Bound work per cycle and retry by recomputing the boundary after a lost
reply. Default a reusable maintenance component to observation mode; make active
deletion an explicit deployment policy.

Capacity recovery must remain possible when normal writes are rejected. For
example, inline stream trimming attached to `XADD` cannot free memory when Redis
rejects the entire write with OOM. Test the independent cleanup under that actual
failure, as well as pending entries, unread backlog, multiple consumers and
consumer creation between observation and execution. A capacity indicator must
read the write budget and preserve the failure until useful work resumes.

Log state transitions and bounded work summaries, not every successful poll.
Show observation-only mode and blocked cleanup as degraded readiness, with the
reason data was retained. Keep maintenance separate from immutable application
artifacts when changing operational policy must not change an experiment's
registered implementation. Document the producer's own retention limits too;
a maintenance guard cannot promise stronger guarantees than the entire pipeline.

## One transport-independent contract

Import from `@omnitron-dev/omnitron/diagnostics`, or from
`@omnitron-dev/titan/diagnostics` in a standalone Titan application.

- `DiagnosticFinding`: stable `id`, severity, title, evidence and optional remedy.
- `DiagnosticEvent`: a finding plus `eventId`, timestamp, source, raised/resolved
  state, and optional correlation/resource identifiers.
- `DiagnosticSink.deliver(event)`: returns a queued/duplicate receipt or rejects.
- `describeError`: bounded, cycle-safe nested cause formatting, including
  `AggregateError` and database driver codes.
- `sanitizeDiagnostic`: validates the contract, allowlists fields, redacts common
  credential forms and bounds text/evidence before delivery.

Only send operational facts. Credential redaction is a defense, not permission
to include request bodies, personal data, SQL literals or arbitrary metadata.
Raw stacks, headers and payload objects are not forwarded by the adapter.

## Optional Titan notification adapter

Messenger-specific integrations are deliberately separate. The universal bridge
uses a configured `titan-notifications` transport, its queue, retry policy and
DLQ. It creates no competing delivery engine and sends nothing until explicitly
wired and invoked.

```typescript
import { NotificationsModule } from '@omnitron-dev/titan-notifications';
import {
  DiagnosticNotificationsModule, DIAGNOSTIC_NOTIFICATION_SINK,
} from '@omnitron-dev/titan-notifications/diagnostics';

const diagnosticsModule = DiagnosticNotificationsModule.forRoot({
  notifications: NotificationsModule.forRoot({ redis: process.env.REDIS_URL! }),
  channel: 'diagnostics.operational',
});
// Import diagnosticsModule in your Titan module and inject
// DIAGNOSTIC_NOTIFICATION_SINK where diagnostics are published.
```

Register a consumer before publishing. Messages use type
`operational.diagnostic` and metadata `schemaVersion: 1`. The default channel is
`diagnostics.operational`; critical/error events request urgent/high priority.
Deduplication uses the event identity and transition with a 24-hour transport
window. Reuse the same identity across retries. Delivery outside that window can
duplicate, and receivers must remain idempotent. A queued receipt acknowledges
the broker only. Consumer acknowledgement, retries and DLQ handling determine
subsequent delivery; no end-to-end exactly-once guarantee is claimed.

`DiagnosticDeliveryError` means no consumer or an unconfirmed publication. A
failed stream rejects the entire fan-out, even if other streams accepted it.
Retry with the same event identity: confirmed streams deduplicate the retry,
while failed streams can accept it. Redis failures and invalid acknowledgements
never count as duplicates. Transport causes are retained with credential
redaction, including an error observer failing alongside publication. This lets
an existing durable producer keep its pending record until all matching
streams acknowledge the event.

Explicit deduplication keys preserve punctuation through percent encoding.
When upgrading, keys previously changed by underscore substitution start a new
broker deduplication window. Consumer idempotency must cover retries that cross
that deployment boundary.

## Connect the existing Omnitron alert outbox

`createAlertDiagnosticHandler(sink)` converts the payload of
`monitoring.alertSink` into the shared contract. Call it from the exposed method
configured as your alert sink. It preserves stable identities across retries and
produces separate firing/resolved event identities.

```typescript
import { createAlertDiagnosticHandler } from '@omnitron-dev/omnitron/diagnostics';
import { DiagnosticNotificationSink } from '@omnitron-dev/titan-notifications/diagnostics';

const handleAlert = createAlertDiagnosticHandler(
  new DiagnosticNotificationSink(configuredTransport),
);
// Your exposed alert method returns handleAlert(payload).
```

The alert outbox currently delivers critical alert transitions to configured
sinks. This adapter does not automatically forward all log lines or runtime
findings. Its timestamp records receipt at the adapter; the original alert
identity remains available for correlation. Messenger routing, credentials,
recipient policy and escalation are consumer responsibilities to add separately.

## Failure-injection checklist

Test denied access, an unreachable database, a rollback failure, a missing alert
consumer, a rejected event handler and recovery after each transient failure.
Check the original cause, health state and exit code, then verify that retries do
not repeat committed effects. [Migration guarantees](migrations.md) describe the
transaction and checksum boundaries used by all framework layers.
