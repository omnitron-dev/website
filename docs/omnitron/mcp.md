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

Five tool groups, each conditional on what's available:

| Tool group | Requires | When unavailable |
| ---------- | -------- | ---------------- |
| `kb.*` | KB indexed (`omnitron kb index`) | "Run `omnitron kb index` first" |
| `apps.*` | Daemon running | "Run `omnitron up` to start the daemon" |
| `infra.*` | Daemon running | (same) |
| `monitoring.*` | Daemon running | (same) |
| `stack.*` / `secret.*` / `backup.*` / `deploy.*` / `cluster.*` / `fleet.*` / `project.*` / `webapp.*` / `pipeline.*` | Daemon running | (same) |

Partial availability is fine: if the daemon is down but the KB
is indexed, the agent can still answer "how does X work" but
can't `start app`.

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
| `webapp.status` / `webapp.build` | Console UI |
| `pipeline.list` / `pipeline.run` / `pipeline.status` | CI/CD |

That's ~40 management tools alongside ~9 KB tools — enough for an
agent to drive the platform end-to-end.

## KB index lifecycle

```bash
omnitron kb index              # incremental reindex (default)
omnitron kb index --full       # full reindex (ignore manifest cache)
omnitron kb index --watch      # watch + reindex on file changes
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

For a monorepo, run `omnitron kb index --watch` during dev so the
KB stays fresh. For CI / production reads:

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
import type { ToolDef } from '../types.js';

export function createMyTools(daemon: DaemonClient): ToolDef[] {
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
    handler: async ({ target }) => {
      const result = await daemon.someService.someMethod({ target });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  }];
}
```

Register in `kb mcp` command:

```typescript
bridge.registerTools(createMyTools(daemonClient));
```

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

The MCP server **inherits the local Unix-socket trust**. If the
agent process can talk to `~/.omnitron/daemon.sock`, it runs as
admin (same model as the CLI). Different process running as a
different OS user → different daemon → different scope.

For agents that run on remote machines or in containers, expose
the daemon over TCP / HTTP with JWT auth and run the agent as
an operator role:

```bash
# On the remote daemon host:
omnitron up --webapp                                   # exposes :9800 with JWT

# Agent host config:
{
  "mcpServers": {
    "omnitron-prod": {
      "command": "omnitron",
      "args": [
        "kb", "mcp",
        "--daemon-url", "https://prod-daemon.internal:9800",
        "--token", "$OMNITRON_TOKEN"
      ]
    }
  }
}
```

The token has whatever roles you minted it with. Match agent
power to its expected scope — give a code-review agent `viewer`,
not `admin`.

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

- **Letting an agent run as `admin`** by default. Default to
  `operator`; require human override for admin actions.
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
- [Daemon / Auth flow](./daemon.md#auth-flow) — JWT for remote agents
- [Best practices](./best-practices.md)
