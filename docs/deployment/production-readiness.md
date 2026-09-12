---
title: Production readiness
description: A practical acceptance checklist for deployment, observability, access control, and recovery.
---

# Production readiness

A process that starts is only the first check. Before admitting production
traffic, verify the application contract, its dependencies, the deployment
artifact and the recovery path.

## Define what is ready

| Gate | Evidence to collect | Reference |
| --- | --- | --- |
| Build | A reproducible artifact from a known commit and lockfile | [Deployment](./index.md) |
| Configuration | Required values validated; secrets supplied at runtime | [Configuration](../omnitron/configuration.md) |
| Data | Migrations completed and application credentials tested | [Database](../titan/modules/database.mdx) |
| Application | A real RPC call succeeds with the intended identity | [Netron](../titan/netron.md) |
| Readiness | Required dependencies are reachable; failures remove readiness | [Health](../titan/modules/health.mdx) |
| Observability | Errors, saturation and dependency failures are visible | [Observability](../omnitron/observability.md) |
| Recovery | A previous artifact and a tested data restore procedure exist | [CLI reference](../omnitron/cli.md) |

Treat these as acceptance criteria for your own workload. Module presence
alone does not prove any gate.

## Set the access boundary

Bind local control endpoints to loopback or a restricted network. Terminate
TLS at a trusted proxy where appropriate. Configure authentication and
method-level authorisation before publishing RPC endpoints.

Test allowed and denied operations with separate identities. Check that
logs and client-visible errors do not expose credentials or infrastructure
details. Keep browser origin policy separate from authentication: CORS
controls browser behaviour, not server-to-server access.

See [module security](../titan/modules/security-checklist.mdx) and
[operator authentication](../omnitron/auth-rbac.md).

## Observe the right signals

Track request errors, latency, process restarts, resource saturation and the
dependencies required by each application. Give each alert an owner and a
concrete action.

The daemon metrics listener serves `/metrics` and `/healthz`. Titan's health
module exposes application health over RPC; importing it does not add HTTP
health routes to your application. Configure your ingress or platform probe
against an endpoint you have actually implemented.

A liveness check answers whether the process should be restarted. A
readiness check answers whether it should receive traffic. A dependency
outage should not automatically create an endless restart cycle.

## Rehearse a release

1. Build from a clean checkout and retain the source revision and artifact.
2. Run database migrations with the intended credentials and locking policy.
3. Deploy to a staging environment with representative configuration.
4. Execute an authenticated RPC call and the important end-user journeys.
5. Interrupt a dependency and confirm timeouts, alerts and recovery.
6. Send SIGTERM under load and verify bounded shutdown.
7. Restore the previous artifact and verify its compatibility with the schema.

When using the supervisor, follow its
[orchestrator](../omnitron/orchestrator.md) and
[operational practices](../omnitron/best-practices.md). When running Titan
directly, your process manager owns restart and rollout policy.

## Keep rollback and restore separate

Rolling back code does not undo a schema or data change. Prefer additive
migrations when old and new versions must coexist. Take backups appropriate
to your data store and verify a restore in an isolated environment.

Record the recovery point you can tolerate and the time a restore actually
takes. Store backup credentials separately from application credentials.
Avoid discovering during an incident that the backup depends on the same
failed host.

## Diagnose a failure

| Symptom | First checks |
| --- | --- |
| Listener refuses connections | Process state, bound address, port and proxy target |
| RPC service is missing | Exact service id, provider registration and exposure logs |
| Authentication succeeds but calls fail | Method role list, token audience and caller identity |
| A stopped container reappears | [Infrastructure reconciliation](../omnitron/infrastructure.md); change declared intent through the supervisor |
| A release starts but traffic fails | Migrations, runtime configuration, dependency connectivity and readiness |
| Shutdown exceeds its budget | Outstanding requests, open resources and lifecycle hook deadlines |

Keep incident notes with the application revision, configuration changes,
timeline and observed evidence. Continue with
[Troubleshooting](../troubleshooting.md) for package-specific symptoms.
