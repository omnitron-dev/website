---
title: Agents and delegated operations
description: Architecture and acceptance criteria for provider adapters, delegated RBAC, monitoring evidence and controlled automation.
---

# Agents and delegated operations

This document specifies the next agent integration. **Embedded provider sessions, delegated agent identities, custom role editing, isolated agent workers and approval grants are not implemented in this release.** Existing MCP tools and administrator Xec automation are useful building blocks, but do not provide this security boundary.

Start with the [current access model](./access.md), [Xec automation](./automation.md) and [monitoring interfaces](./observability.md). Keep provider integration optional: installing Omnitron must not require an agent SDK, provider account or inference service.

## Boundaries and ownership

| Layer | Responsibility |
| --- | --- |
| `@omnitron-dev/access` | Reusable roles, permissions and policy evaluation |
| Titan | Principal propagation, transport authorization, lifecycle, metrics, diagnostics and notification delivery primitives |
| Omnitron | Infrastructure resource identity, delegation, approvals, audit, query budgets and operational workflows |
| Xec | Local/remote execution, scripts, graph scheduling, streaming and cancellation |
| Provider adapter | Provider-specific authentication, sessions, model events, interruptions and usage |
| Application | Its own domain policy and business operations |

Do not add another role hierarchy to an agent plugin. Human, service and agent principals share the policy engine while retaining distinct identity types. A provider login authenticates the model session; it does not grant infrastructure rights.

## Codex provider

OpenAI provides both a [TypeScript Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) and [Codex app-server](https://learn.chatgpt.com/docs/app-server). The SDK fits programmatic thread execution. App-server is the intended adapter for an interactive Console integration requiring streaming sessions, interruptions and approval events. Generate and pin its protocol types with a tested provider version; do not couple core Omnitron DTOs to experimental protocol fields.

Use standard MCP tools through the broker. Treat experimental dynamic tools as an optional adapter capability. Provider approval settings are an additional restriction; they cannot override Omnitron denial.

Prefer an eligible ChatGPT subscription connection when the deployment supports it. The [Sign in with ChatGPT guidance for open-source integrations](https://developers.openai.com/siwc/token-sharing-open-source) and [self-hosted VM guidance](https://developers.openai.com/siwc/self-hosted-vms) define the supported ownership and token-refresh paths. App-server's managed ChatGPT login is not a general authentication solution for a commercial hosted product. Evaluate the applicable partner path before offering subscription login in such a deployment.

Offer API credentials as a distinct, explicit connection. Never silently fall back to billable API usage when subscription access fails or reaches a limit. Show connection identity, provider availability, usage and the applicable billing mode without exposing tokens. Only show quota/usage figures the provider actually returns. Follow the [preview limitations](https://developers.openai.com/siwc/preview-limitations); do not infer unrestricted API compatibility.

The adapter owns token refresh and reconnect/resume behavior. Store credentials in the server vault, scope them to a connection and owner, and keep them out of browser storage, URLs, process arguments, scripts, telemetry and exported support bundles. Disconnect must revoke or delete local credentials as supported by the provider and terminate affected sessions. Provider-side revocation limitations must remain visible.

## Delegation in the existing role system

An agent principal has an immutable agent ID, owner ID, delegation ID and expiry. A run adds its own run ID and grant. It does not inherit the administrator's Unix-socket identity, JWT or `service_role`.

Effective authority is the intersection of:

1. The owner's **current** rights and account/session state.
2. Role bindings evaluated for the agent principal.
3. Explicit delegation scope and expiry.
4. The run's narrower scope and remaining budgets.
5. Organization policy and any required approval.

An explicit deny wins. A missing policy, unavailable authority store, unrecognized resource, expired grant or stale policy version denies a mutation. Approval satisfies an approval requirement; it never creates a permission absent from that intersection.

Resource constraints use server-resolved project, stack, node and application IDs, not a UI filter or a caller-supplied path prefix. A compound request is rejected if any requested resource is outside scope; silently returning a subset can mislead analysis. Recheck authority at admission and each privileged broker call. Revoke active streams and queued operations when the owner, binding or delegation changes. A running external operation needs a documented cancellation or containment policy; revocation does not undo completed effects.

### Permission families

These are proposed semantic permissions, to be mapped centrally to RPC methods rather than implemented as a provider-specific allowlist:

| Family | Separately grantable operations |
| --- | --- |
| Monitoring | Read metrics, query logs, read traces, read health, read/subscribe to alerts |
| Alerts | Acknowledge, silence with expiry, resolve where supported, edit rules, edit delivery routes |
| Automation | Read definitions, draft scripts, submit review, approve, execute approved revision, cancel owned runs |
| Deployment | Inspect, prepare, activate a reviewed release, rollback a named release |
| Infrastructure | Inspect resources, change a bounded resource, open a terminal |
| Access | Inspect own grants, administer delegation, administer roles |
| Secrets | List permitted references, resolve for a specific broker operation, rotate |

Reading logs does not permit reading vault values. Drafting a script does not permit executing it. Receiving an alert does not authorize remediation. Do not bundle unrestricted SSH, arbitrary shell or secret resolution into a monitoring role. Treat shell access as the full OS authority of its target identity, not as a narrowly constrained action merely because the launch method has a role check.

## Worker and broker isolation

Run the model/provider adapter in a dedicated worker with a restricted filesystem, bounded CPU/memory/runtime, controlled egress and a short-lived broker credential. Do not mount the daemon's Unix socket, Docker socket, host SSH directory, vault, production database credentials or the user's full home directory. A normal child process is not sufficient isolation.

Only the broker resolves infrastructure credentials and invokes Omnitron operations. It validates typed arguments, resource scope, live authority, quotas and approval, then records a correlated audit intent before mutation. Use an OS/container/VM sandbox appropriate to the deployment and prove containment in integration tests. A container with host sockets or privileged mounts is not isolated.

Provider events and tool calls carry provider-session, agent-run and operation correlation IDs. Enforce one active dispatcher per run, bounded queues and event sizes, and replay-safe sequence handling. A reconnect restores conversation state, not permission to replay a completed mutation. On uncertain delivery, query the operation ID before retrying.

## Review artifacts and approvals

An execution proposal is an immutable artifact containing source revision/hash, target IDs, resolved execution profile, parameter digest, allowed effects, timeout, maximum attempts and rollback instructions where meaningful. Do not expose secret parameter values in the approval view.

Bind a single-use approval to that artifact, requester, approver, expiry and nonce. Consume it atomically with operation admission and retain the decision in audit. An edit to code, parameters, targets or execution profile invalidates it. The actor requesting execution cannot approve their own request when policy requires separation of duties. A denied or unavailable audit write prevents the effect.

Console presents a compact proposal with expandable code, targets, privileges, estimated query/execution cost and the recovery procedure. CLI receives the same artifact and decision endpoints. No browser-only checks or provider-text interpretation may authorize execution.

## Monitoring as evidence

An agent's analysis should cite retrievable evidence: the query, resource scope, time window, source/collector identity, sample or event timestamps, collection time, result completeness and correlation IDs. Distinguish an observed value from an inference. A healthy process does not prove successful email delivery or business correctness.

Current MCP `monitoring.snapshot`, `metrics.series` and `alerts.active` reuse Titan/Omnitron readers and explicitly label unavailable or oversized sources. Collection timestamps are not source freshness. Historical log queries are bounded before SQL construction. These improvements do not yet constitute delegated agent access or complete query cost control.

The next shared query contract must expose:

- **Coverage:** expected/observed nodes and applications, disconnected collectors, last successful ingestion and source watermark.
- **Loss:** dropped events, rejected batches, queue pressure, retention boundaries and gaps after restart or disconnection.
- **Completeness:** limit reached, sampling, aggregation interval, estimated/known population and continuation cursor.
- **Time:** source event time, receipt time and query time separately; clock skew makes cross-node ordering uncertain.
- **Provenance:** stable log/trace/alert references and evidence hashes where retained, with a clear expiry if retention can remove them.

Unknown, stale, sampled, truncated and absent are distinct states. Never convert failed queries to zero errors or no alerts. A sampled error count is not an exact population count; a missing metric is not zero. Alert summaries must reveal evaluation freshness, not only the last persisted firing state.

### Efficiency and scale

Reuse Titan's storage and query abstractions. Do not build a second analytics database in the agent adapter. Apply allowlisted dimensions, metric-series cardinality budgets, bounded batches, backpressure and retention/rollups at the owning layer. Never use raw URLs, user input, tokens, run IDs or source text as unbounded metric labels.

Admit queries with explicit resource and time scope, row/byte/series bounds, deadlines and cancellable database work. Add keyset pagination for deep history, per-principal concurrency and cost budgets, and fair scheduling so agent analysis cannot starve incident response. A response byte cap alone does not cap database work. Prefer ingestion counters and bounded snapshots for polling; full archive counts are a deliberate analytic query.

Use subscriptions with cursor-based resumption and bounded queues for alert/event delivery. Slow consumers receive an explicit gap and recover through a bounded historical read. Do not run a full health probe or archive count on every dashboard refresh. Cache only under the effective scope and policy version; invalidation must not reveal another principal's data.

## Alerts and notifications

Keep evaluation, incident state and delivery separate. An alert's lifecycle includes pending, firing and resolved, with timestamps and rule revision. Acknowledgement records operator ownership; it does not resolve the underlying condition. Silence is scoped, expiring and audited. Dedupe keys and grouping must prevent a flapping service from producing an unbounded notification storm.

Use the existing Titan notification adapter/outbox boundary for future messenger integrations. Persist delivery intent with the state transition, assign an idempotency key, retry transient failures with bounded exponential backoff and jitter, and surface exhausted deliveries for inspection/retry. Track provider acceptance separately from confirmed delivery when a provider supplies receipts. Do not promise exactly-once delivery across external systems.

A delivery adapter receives a redacted event with stable IDs and a link to the authorized Console view. Routing, recipients and secret references remain server policy. Messenger payloads, responses and logs cannot change roles, approve scripts or grant access. No messenger provider is enabled by this design document.

## Untrusted input and remediation

Application logs, issue text, repository content, tool results and notification bodies are untrusted data. Instructions embedded in them never change system policy. Keep them visibly separated from trusted instructions and pass only the evidence needed for the current analysis. Redact before provider egress, and require explicit policy for exporting sensitive operational data.

Begin with observation and proposals. Automatic remediation must select a reviewed, versioned playbook with bounded targets, rate limits, cooldown, idempotency, health criteria and a stop condition. A log message must never become a shell command. Canary changes and rollback require evidence; repeated failed remediation escalates to a human instead of looping.

## Delivery and acceptance

Implement in independently testable stages: scoped read-only broker and principal propagation; provider connection and resumable observation; draft/review artifacts; isolated approved execution; bounded remediation. The current administrator pipeline is not a shortcut around those stages.

Before enabling each stage, verify:

1. Viewer/operator/agent boundaries and cross-project denial through actual HTTP, WebSocket, CLI and broker paths.
2. Mid-run revocation, owner demotion, expiry, stale approvals, replay and simultaneous approval consumption.
3. Audit/store failure before mutation, worker crash, daemon restart, network partition and lost completion messages.
4. Query deadlines, slow consumers, high cardinality, ingestion loss and visible stale/partial results under load.
5. Prompt injection in logs/tool output, secret exfiltration attempts and filesystem/socket/network escape tests.
6. Provider quota/auth failures with no silent switch to paid API usage, plus reconnect without duplicate effects.

Publish measured latency, memory, queue and throughput budgets for the tested deployment profile. Availability or latency targets are acceptance criteria, not guarantees inferred from an architecture diagram.
