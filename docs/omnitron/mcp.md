---
sidebar_position: 15
title: MCP + Knowledge base
description: AI agent integration via Model Context Protocol — kb + management tools.
---

# MCP + knowledge base

Omnitron ships a Model Context Protocol server that exposes
**two surfaces** to AI agents (Claude, IDE assistants, CI bots,
code-review agents):

1. **Knowledge base** — semantic + full-text search across the
   codebase, plus structured access to API surfaces, modules,
   patterns, and gotchas.
2. **Management plane** — apps, infra, monitoring, secrets,
   backups, deploys, pipelines — every operation the CLI offers,
   exposed as MCP tools.

Verified against `apps/omnitron/src/mcp/` and
`apps/omnitron/src/commands/kb.ts`.

## Starting the server

```bash
omnitron kb mcp
```

That's it. The server runs on stdio (the MCP wire format) and
keeps running until the client closes the stream. Agent host
configuration typically wires it as:

```jsonc
{
  "mcpServers": {
    "omnitron": {
      "command": "omnitron",
      "args":    ["kb", "mcp"]
    }
  }
}
```

The exact config varies by host (Claude Desktop, IDE plugins,
custom agents).

## What the agent sees

Two surfaces, registered conditionally on what's available:

| Tool group | Requires | When unavailable |
| ---------- | -------- | ---------------- |
| `kb.*` | KB indexed (`omnitron kb index`) | "Run `omnitron kb index` first" |
| `apps.*` | Daemon running | "Run `omnitron up` to start the daemon" |
| `infra.*` | Daemon running | (same) |
| `monitoring.*` (`health.*` / `metrics.*` / `logs.*`) | Daemon running | (same) |
| `stack.*` / `secret.*` / `backup.*` / `deploy.*` / `cluster.*` / `fleet.*` / `k8s.*` / `project.*` / `webapp.*` / `pipeline.*` | Daemon running | (same) |

"When unavailable" is logged to **stderr** — the tools are
simply not registered (absent from `tools/list`), not stubbed
with a fallback response. So partial availability is fine: if
the daemon is down but the KB is indexed, the agent only sees
the `kb.*` tools and can still answer "how does X work" — it
just can't `start app`.

## KB tools

| Tool | Purpose |
| ---- | ------- |
| `kb.query` | Semantic + full-text hybrid search over code knowledge. Open-ended questions. |
| `kb.get_api` | API surface of a class / interface / type — signatures, decorators, members, inheritance |
| `kb.get_module` | Module info: overview, specs, dependencies, dependents, gotchas |
| `kb.repo_map` | Compressed architecture map (2-5K tokens). **Start here for orientation.** |
| `kb.get_pattern` | One named development pattern with code |
| `kb.list_patterns` | All available patterns |
| `kb.get_gotchas` | Known pitfalls and critical warnings (essential before modifying unfamiliar code) |
| `kb.search_symbols` | Search for classes / interfaces / types by name or kind |
| `kb.dependencies` | Dependency graph for a module — depends-on + dependents |
| `kb.index` | Trigger an (incremental or full) reindex from the agent |
| `kb.status` | Index health, entry counts, last-indexed timestamp |

Agents typically lead with `kb.repo_map` (orient), then
`kb.query` (find), then `kb.get_api` (verify signature) before
making changes.

## Management tools — apps

| Tool | Effect |
| ---- | ------ |
| `apps.list` | Inventory of managed apps |
| `apps.start` | Start an app by name |
| `apps.stop` | Stop an app (graceful + optional force) |
| `apps.restart` | Stop + start |
| `apps.status` | Daemon-wide overview |
| `apps.logs` | Tail logs (lines + level + grep) |
| `apps.scale` | Resize a worker pool |
| `apps.inspect` | Deep diagnostics for an app |

## Management tools — infra

| Tool | Effect |
| ---- | ------ |
| `infra.up` | Provision and start all infra services |
| `infra.down` | Stop containers (optional `--volumes` for data wipe) |
| `infra.status` | Container inventory |
| `infra.logs` | Per-service container logs |
| `infra.psql` | Run SQL against a managed Postgres container |
| `infra.redis` | Run a command against a managed Redis container |
| `infra.migrate` | Run database migrations |

> `infra.psql` / `infra.redis` are exactly the wide-blast-radius
> "execute SQL / run command" tools the [anti-patterns](#anti-patterns)
> section warns about — they exist for operator convenience; scope
> the agent's token accordingly.

## Management tools — monitoring

| Tool | Effect |
| ---- | ------ |
| `health.check` | Composite health report |
| `metrics.get` | Aggregate metric snapshot |
| `metrics.app` | Per-app metrics |
| `logs.query` | Cross-app log query with filters |

## Management tools — control plane

| Tool | Effect |
| ---- | ------ |
| `stack.list` / `stack.create` / `stack.status` / `stack.start` / `stack.stop` | Stack lifecycle |
| `project.list` / `project.scan` | Project registry |
| `secret.list` / `secret.get` / `secret.set` | Secret management |
| `backup.create` / `backup.list` / `backup.restore` | Database backup |
| `deploy.app` / `deploy.build` / `deploy.rollback` | Deployment |
| `cluster.status` / `fleet.status` / `fleet.health` | Cluster + fleet |
| `k8s.pods` / `k8s.scale` | Kubernetes pods + scaling |
| `webapp.status` / `webapp.build` | Console UI |
| `pipeline.list` / `pipeline.run` / `pipeline.status` | CI/CD |

That's ~44 management tools (apps + infra + monitoring +
control-plane) alongside 11 KB tools — enough for an agent to
drive the platform end-to-end.

## KB index lifecycle

```bash
omnitron kb index              # incremental reindex (default)
omnitron kb index --full       # full reindex (ignore manifest cache)
omnitron kb status             # index health, entry counts, last-indexed timestamp
omnitron kb query "<question>" # one-shot query (test the index)
```

The index lives at `~/.omnitron/kb.db` (SurrealKV). Schema:

- **Symbols** — classes, interfaces, types, functions, enums
- **Modules** — packages with overview, dependencies, gotchas
- **Patterns** — canonical development recipes
- **Gotchas** — known pitfalls per module
- **Docs** — long-form markdown indexed alongside symbols

Hybrid search combines:
- Full-text BM25 on names + docs
- Semantic embeddings (when available) for "open-ended question"
  flavour

Both indexes update during `omnitron kb index`.

## Indexing strategy for a monorepo

Reindexing is incremental by default (manifest-cached), so a
plain `omnitron kb index` after a batch of edits is cheap — wire
it into a pre-commit hook or run it manually when you've changed
public surfaces. For CI / production reads:

```bash
omnitron kb index --full       # fresh, in case manifests drifted
omnitron kb status             # verify entry counts look right
```

The full reindex is idempotent and bounded — typically minutes
even on large codebases.

`OMNITRON_ROOT` env var picks the indexed root (default `cwd`).
Useful when running the MCP server from outside the project
directory.

## Tool authoring (extend MCP)

Tools live under `apps/omnitron/src/mcp/tool-groups/`. Each
group exports a factory:

```typescript
// apps/omnitron/src/mcp/tool-groups/my-tools.ts
import type { IMcpToolDef } from '../types.js';

export function createMyTools(daemonClient: any): IMcpToolDef[] {
  return [{
    name: 'mything.do',
    description: 'Do the thing. Use when X.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'What to target' },
      },
      required: ['target'],
    },
    // Return a raw value — the bridge wraps it into the
    // MCP { content: [{ type: 'text', text }] } envelope for you.
    handler: async ({ target }) => {
      return daemonClient.someService.someMethod({ target });
    },
  }];
}
```

Register in the `kb mcp` command (`apps/omnitron/src/commands/kb.ts`):

```typescript
bridge.registerTools(createMyTools(daemonClient));
```

The tool definition interface is `IMcpToolDef` (in
`apps/omnitron/src/mcp/types.ts`); the existing group factories
(`createKbTools`, `createAppsTools`, …) all take the relevant
client/service as a loosely-typed `any`. Handlers return a raw
object or string — `McpBridge` `JSON.stringify`s it and wraps it
in the `{ content: [...] }` envelope; don't build that envelope
yourself or you'll double-encode.

The `description` field is **what the agent reads to decide
whether to call the tool**. Make it specific.

## Best practices for agent-callable tools

- **Atomic operations.** One tool, one outcome — don't bundle
  "deploy + scale + restart" into one tool.
- **Idempotent where possible.** Agents retry on transient
  failures; non-idempotent tools cause double-spend bugs.
- **Strict input schemas.** JSON schema with `required` and
  `enum` constraints — narrows the agent's failure modes.
- **Descriptive errors.** When a tool fails, return a clear
  message so the agent can recover (e.g., "App not found.
  Available: api, worker, scheduler.").
- **Read-then-write pattern.** Expose a `list` / `status` for
  every `do` — agents check before acting.
- **Cap dangerous side-effects.** Tools that destroy data
  (`infra.down --volumes`, `backup.restore`) should require
  explicit confirmation flags.

## Auth model

The MCP server **inherits the local Unix-socket trust**. The
`kb mcp` command takes no connection flags — it always builds a
local daemon client (`createDaemonClient()`) that talks to
`~/.omnitron/daemon.sock`. If the agent process can reach that
socket, it runs as admin (same model as the CLI). A different
process running as a different OS user → different daemon →
different scope.

> **There is no remote/TCP MCP transport today.** `kb mcp` has no
> `--daemon-url` or `--token` option; the server cannot point at a
> remote daemon. To drive a remote host, run the MCP server **on
> that host** (over an SSH session or inside its container) so it
> reaches the local socket there, and scope the agent's OS-level
> access accordingly.

Match agent power to its expected scope. Because local-socket
access is effectively admin, the strongest control is *where*
you run the MCP server and *which* host's daemon it can reach.

## Common agent workflows

### "What does X do?"

1. `kb.repo_map` → orient
2. `kb.query "X"` → find relevant entries
3. `kb.get_api "X"` or `kb.get_module "X"` → details
4. Agent answers from results

### "Is the platform healthy?"

1. `apps.status` → daemon overview
2. `health.check` → composite health
3. `metrics.get` → CPU/memory aggregate
4. `apps.logs` → recent error filter
5. Agent summarises

### "Fix this failing deploy"

1. `deploy.status <runId>` → what failed
2. `apps.logs <appName> --level error --grep deploy` → context
3. `kb.get_gotchas <appName>` → known issues
4. `apps.inspect <appName>` → live state
5. Agent proposes fix; operator confirms

### "Scaffold a new app"

1. `kb.get_pattern "new-app-bootstrap"` → canonical scaffold
2. `kb.get_module "<related-app>"` → similar example
3. Agent generates files; operator reviews

## Cost and latency

- **Tool calls** to the daemon are essentially free (Unix socket
  RPC).
- **KB queries** with semantic search load embedding models —
  cold start adds 1-2s; subsequent queries are sub-second.
- **The MCP server itself** is lightweight (~50-100 MB resident).

Run it as a long-lived companion to your agent session;
restarting on every prompt adds noticeable latency.

## Anti-patterns

- **Running the MCP server next to a production daemon socket**
  without thinking. Local-socket access is admin — keep the
  server on dev/staging hosts, or gate destructive tools behind
  operator confirmation, since there is no per-token role scoping
  for the MCP surface today.
- **Skipping `kb index`** in CI before MCP-based code review.
  Stale KB makes agents confidently wrong.
- **Tools that perform multiple actions atomically.** The agent
  can't retry partial successes; the daemon ends up with
  half-applied state.
- **Tools that mutate without listing first.** Agents work better
  when they can see current state before acting.
- **Generic "execute SQL" / "run command" tools.** Wide blast
  radius, hard to audit, hard for the agent to use correctly.
  Narrow domain-specific tools win.

## See also

- [CLI / Knowledge base](./cli.md#knowledge-base-mcp)
- [Configuration](./configuration.md) — daemon config
- [Daemon / Auth flow](./daemon.md#auth-flow) — local Unix-socket trust model
- [Best practices](./best-practices.md)
