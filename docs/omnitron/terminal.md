---
title: SSH workspace
description: Multiple SSH tabs through Xec, with pinned host keys, live authorization and bounded sessions shared with CLI.
---

# SSH workspace

Open **SSH workspace** from the sidebar, or **SSH** on a registered node. Each tab creates an independent interactive shell using the SSH identity configured for that node. The workspace supports split view, terminal search, font controls, copy selection, a local read-only mode and review before pasting line breaks or control characters.

The service runs on a master with PostgreSQL-backed authentication and audit. The daemon owns the SSH connection. Credentials stay on the server. The browser renders the terminal through lazily loaded xterm.js; the CLI uses the same `OmnitronTerminal` RPC service. SSH runs through Xec's existing `NodeSSH` implementation, exposed by `@xec-sh/core/ssh`.

## Verify the host before connecting

1. Register a node with its SSH hostname, port, user and credential using the [node commands](./cli.md#nodes-infrastructure-machines).
2. Select **Verify host key**. The daemon observes the server's key in a handshake that does not authenticate.
3. Compare the SHA256 fingerprint with an independently trusted source, such as the host's provisioning console. For an OpenSSH host, an administrator can run:

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
   ```

4. Enter the verified fingerprint to save trust, then select **New SSH tab**.

An observed fingerprint is not proof of host identity. Verification must not consist of copying a key from the same untrusted network connection. Pin replacement uses the previous pin as a compare-and-swap condition and closes sessions for that node. A pin applies to the registered host, port and username; changing that target requires verification again.

Pins are stored in the daemon's SQLite state store. Opening a terminal requires an exact pin match before authentication. Host-key probing and terminal opening use Xec's bounded connection and shell-request lifecycle. SSH adapter pools keep distinct host-key policies separate and preserve them during reconnect.

## Equivalent CLI workflow

```bash
omnitron node ssh-key edge-1
omnitron node ssh-key edge-1 --trust SHA256:<independently-verified-fingerprint>
omnitron node ssh edge-1
omnitron terminal list
omnitron terminal close <session-id>
```

The node selector accepts a registered name or ID. `Ctrl+]` closes the CLI terminal and restores local terminal settings. **Copy CLI command** in Console produces the same node command.

Terminal listing and closing are limited to the caller's owner identity. Local CLI sessions belong to the OS-authorized local daemon identity; browser sessions belong to the human account and its specific authenticated session. Another browser sign-in, even for the same account, cannot read or control an existing terminal.

## Session lifetime and limits

| Setting | Default |
| --- | --- |
| Enabled | `true` on a master |
| Active sessions across the daemon | 32 |
| Active sessions per owner | 8 |
| Idle without input | 15 minutes |
| Absolute lifetime | 8 hours |
| No output reads from the client | 90 seconds |
| Retained server output per session | 256 KiB |
| Maximum output read | 64 KiB |
| Maximum input per RPC | 8 KiB |
| Closed-session retention | 60 seconds |

Configure policy in the daemon configuration:

```typescript
export default {
  daemon: {
    terminal: {
      enabled: true,
      maxSessions: 32,
      maxSessionsPerOwner: 8,
      idleTimeoutMs: 15 * 60_000,
      absoluteTimeoutMs: 8 * 60 * 60_000,
      disconnectTimeoutMs: 90_000,
    },
  },
};
```

Counts must be positive integers; the supported upper bounds are 128 daemon-wide and 32 per owner. `enabled: false` disables terminal creation. Build and restart the daemon to apply new backend code or startup configuration; a frontend rebuild alone does not register new RPC services.

Output travels as base64 bytes with an absolute byte cursor, preserving UTF-8 boundaries and terminal protocols. A slow reader receives an explicit dropped-byte count. `hasMore` allows the client to drain retained output after a shell closes. Input is sequenced and deduplicated; an ambiguous write failure closes the session instead of replaying a command.

## Authorization and audit

SSH requires the administrator role and a current human session, or the trusted local Unix-socket identity. A machine `service_role` cannot open an interactive terminal. The daemon rechecks authorization and ownership on every method; its two-second sweep also closes revoked sessions, removed targets and expired shells.

Host trust and terminal opening require an audit write before proceeding. The audit records target identity, ownership and lifecycle events. It deliberately does not record commands, terminal output, passwords or key material. Use **Audit** or `omnitron audit --resource terminal`. An audit of session lifetime is not a shell transcript.

Use HTTPS outside loopback. xterm.js runs without automatic URL opening or OSC 52 clipboard writes. Multi-line/control-character paste requires review. **Read only** disables input for that pane; it is a local usability control, not a separate server permission. The remote shell still has the full OS rights of the registered SSH user.

## What persists

Tabs and their output survive navigation inside the current Console. They do not survive a browser reload or daemon restart. Closing the browser ends the session after the disconnect timeout. No commands are automatically replayed and no shell is automatically reattached. Use a remote terminal multiplexer when the workload itself must outlive a connection.

This workspace provides interactive PTY shells. File transfer, jump-host configuration, SSH agent forwarding, shared sessions and durable session recording are not exposed here. They require separate permission and lifecycle design before being added.

See [Console access](./access.md), [Xterm security guidance](https://xtermjs.org/docs/guides/security/) and [OpenSSH fingerprint inspection](https://man.openbsd.org/ssh-keygen.1).
