---
title: File workspace
description: Navigate, edit and transfer files across Omnitron nodes through the same audited Console and CLI contract.
---

# File workspace

Open **Files** in Console. Panel **A** and panel **B** are independent locations: either can point to the local daemon or a registered remote node. A node must run a compatible Omnitron daemon. After a node upgrade or policy change, use the panel’s **Refresh** button to reload its available roots and directory listing. Connection and permission failures remain visible until a successful retry; an unavailable node is not treated as an empty filesystem. File operations use the authenticated Netron mesh; no SFTP server or browser-held SSH credential is required.

**Local means the daemon host.** Upload and Download refer to the computer running your browser. Selecting a project does not restrict filesystem authority: this is an administrator workspace.

## Start with a location

1. Choose a node and a root in each panel. The default root is **Filesystem**, `/` on the node, accessible only to administrators and within the daemon process's operating-system permissions.
2. Open a directory with its name or Enter. Use the path breadcrumbs, Back/Forward, Parent, or the path editor for navigation. Each panel supports eight independently navigable tabs.
3. Select entries with checkboxes or Space; Shift+click selects a range. **Copy A → B** reviews the exact source and destination before starting a daemon job.
4. Open **Transfers** for file/byte progress, the current path, failures and Pause/Resume/Cancel. Completed files remain if another file fails or you cancel later.

On narrow windows the A/B switch shows one panel at a time without discarding the other panel. On wider windows drag the separator, or focus it and press Left/Right, to adjust widths. Lists scroll inside the panel. Directory pages contain up to 200 entries; **Load next 200 entries** extends the current list. Filtering and sorting apply to loaded entries; directories sort first. Hidden entries are available from the panel menu.

| Shortcut, while focus is inside a panel | Action |
| --- | --- |
| Enter / Space | Open / select focused entry |
| Up / Down | Move row focus |
| Alt+Left / Alt+Right / Alt+Up | Back / forward / parent |
| Ctrl/Command+L | Edit the root-relative path |
| F2 / F4 / F5 | Rename / edit / review copy to other panel |
| Delete | Review moving selected entries to trash |

Panel menus also provide New file, New folder, Upload, Download and Restore from trash. Symlinks are displayed but not followed; navigate to the real target path. Special files, sockets and devices are not opened as regular content.

## Edit without losing another writer's change

The editor loads on demand and supports UTF-8 files up to 1 MiB, eight buffers, search/replace, undo, line numbers and JSON/JavaScript/TypeScript highlighting. Ctrl/Command+S saves. Buffers stay in memory when the editor is minimized or you navigate to another Console section; a page unload warns about unsaved buffers. They are cleared on sign-out and are not stored in browser storage.

Saving requires the version returned by the read. A stale version is rejected, leaving the buffer intact. **Save copy** creates a different filename without overwriting. **Reload** requires confirmation before replacing the current buffer. Closing a dirty buffer requires confirmation. Renaming a file or its parent within the workspace updates open buffer locations without losing unsaved text; an already-stale version remains stale. UTF-8 BOM and uniform LF/CRLF/CR line endings are preserved. Mixed line endings are previewed read only. Binary data and larger files use transfers/download instead.

A staged regular file is synchronized before atomic publication. Existing text files retain owner/group and basic permission bits. ACLs, extended attributes, sparse layout and hard-link relationships are not preserved by text replacement or copy. Version checks serialize Omnitron writes; they are not an operating-system compare-and-swap against unrelated processes. Avoid editing a file concurrently through another privileged program.

## Configure access per node

The default `/` export does not elevate the daemon to root. Unreadable directories and files return permission errors. Configure each node independently in `~/.omnitron/config.json`, restart it through your normal controlled rollout, and inspect **Files → Node → Root**. Merge the `files` field into the existing JSON object; preserve its role, authentication and transport settings. This is daemon configuration, not a `daemon` block in a project’s `omnitron.config.ts`.

```json
{
  "files": {
    "enabled": true,
    "roots": [
      { "id": "projects", "label": "Projects", "path": "/srv/projects" },
      { "id": "logs", "label": "Logs", "path": "/var/log", "readOnly": true }
    ]
  }
}
```

| Configuration | Effect |
| --- | --- |
| `files` omitted, or `files: { enabled: true }` | Administrator access to the `/` filesystem root |
| `files.roots: [...]` | Replace the default with explicit exports, up to 32 roots |
| `readOnly: true` on a root | Deny editing, uploads, copy destination, rename, trash and restore |
| `files.roots: []` or `files.enabled: false` | Export no directories |

Root IDs are stable API identifiers; labels are presentation. Paths must be absolute. Root-relative request paths reject traversal, reserved staging names, control characters and symlink components. Roots are pinned to their canonical path and filesystem identity for the daemon lifetime. Changing a pinned directory requires configuration review and a restart. These checks constrain API clients; they do not form an OS sandbox against a privileged local process racing directory replacement. Use OS identities/mount isolation for hostile local workloads.

Temporary writes and recoverable trash live in a private `.omnitron-files` directory in the item's parent directory, on the destination filesystem. The directory must belong to the daemon user and have mode 0700. It is hidden from listings and cannot be addressed through the API. This permits a `/` export without requiring write permission at `/`, and avoids cross-filesystem atomic-renaming problems.

## Transfer protocol and recovery

`OmnitronFiles` is the human-facing service shared by Console and CLI. Every public method requires `admin`; sensitive calls revalidate the current human session independently of cached transport authorization. Reads and write intents are audited. Required intent persistence fails closed. File contents and chunk payloads are not written to audit details.

`OmnitronFileNode` is the authenticated mesh endpoint. It requires a signed `service_role` identity with a `mesh:` subject and accepts the typed v1 file request union, never arbitrary RPC names or shell commands. The control-plane peer namespaces the actor identity; upload receipts and trash are owned by that actor. The master resolves registered node IDs through the existing `SlaveConnector`. Human browser credentials cannot call this internal endpoint. The fleet TCP transport carries the verified peer identity into the same invocation context used by service guards and audit; missing identity fails closed.

Upload admission has a caller-generated idempotency key, persisted before the remote begin request so a lost response does not allocate another session. A copy first creates a bounded manifest, then transfers one verified block at a time. The receiving node synchronizes bytes before advancing its durable acknowledgement. Duplicate frames are accepted only when their already-acknowledged contents match. SHA-256 protects each block; commit records the complete destination hash. Publication uses a no-overwrite link from private staging, so partial files are not visible under their final name. A lost commit response is reconciled against the recorded destination inode and receipt, not blindly repeated as a new copy.

The current transport uses 256 KiB base64 frames over existing Netron RPC. It provides bounded memory and explicit backpressure with roughly one-third encoding overhead. Cross-node bytes currently pass through the coordinating daemon, not the browser. Direct peer binary streams and parallel adaptive transfer lanes are future protocol optimizations, not present guarantees.

The coordinator persists manifests and progress in the existing daemon state store. Restarted jobs become **interrupted** and require explicit Resume. Planning interrupted before a manifest is saved requires a new copy. Pause takes effect at the next checkpoint; the in-flight block can finish. Current authority is rechecked during planning and between transfer blocks. Cancel removes unfinished staging when its outcome is known; it never rolls back already-published files. An ambiguous commit must be reconciled before cancellation.

Existing destination files are never overwritten. Existing directories can receive additional copied entries. Copy is a per-file operation, not a transactional tree snapshot: source changes fail their file's version check, and earlier completed files remain. A source directory changing after manifest creation does not turn the manifest into a live mirror.

| Bound | Current value |
| --- | --- |
| Text editor | 1 MiB UTF-8, 8 browser buffers |
| Directory | 10,000 entries; 200 per page |
| Copy manifest | 200 selected sources, 10,000 entries, 32 directory levels |
| File / copy payload | 100 GiB |
| Concurrent coordinator jobs | 4 |
| Concurrent node requests / unfinished writes | 32 / 32 |
| Retained jobs | 100; oldest completed/cancelled jobs make room |
| Node upload/trash receipts | 1,000 each; unfinished writes and unrestored trash never expire automatically |
| Portable browser download | 32 MiB; use CLI for larger files |

The coordinator acknowledges final receipts only after persisting its next cursor; this frees receipt capacity without deleting published files. Browser and CLI uploads acknowledge after receiving a successful commit. Unacknowledged completed/aborted receipts can be reclaimed after 30 days when the journal is full. Restored trash receipts can be reclaimed when full. Reaching the limit without reclaimable records fails explicitly; files are not silently purged. Restore reconciles a move that succeeded before its journal acknowledgement failed, using the original filesystem identity; an unrelated destination remains a conflict. Trash consumes disk until restored or handled by an administrator outside the workspace. Permanent purge and configurable disk quotas are not implemented yet. Do not use the workspace as a backup system.

Browser upload/download progress belongs to that page; leaving or closing it can interrupt these operations. Node-to-node transfers are daemon-owned. After a browser upload loses its publication response, inspect its displayed receipt before retrying. Do not assume a network error means no file was published.

## CLI

`omnitron files` uses the same service. All commands support the global `--json` mode. The local CLI has the trusted local socket identity; it does not inherit the browser account, so its transfer/trash ownership is separate.

```bash
omnitron --json files roots --node local
omnitron --json files list srv --node local --root system
omnitron --json files stat srv/project/config.json --root system
omnitron --json files read srv/project/config.json --root system
omnitron --json files copy srv/project --root system \
  --to-node <registered-node-id> --to-root system --to-path srv/staging
omnitron --json files transfers
omnitron --json files pause <transfer-id>
omnitron --json files resume <transfer-id>
omnitron --json files cancel <transfer-id>
```

`files list --after <name> --revision <version>` requests the next directory page. `files save <path> --from <local-file> --version <version>` performs a checked save; `--version new` creates without replacement. `files rename <path> --to <root-relative-path> --version <version>` and `files trash <path> --version <version>` require an explicit observed version. Use `files trash-list --root <id>` and `files restore <trash-id> --node <id>` for recovery. `files mkdir <path> --root <id>` creates a directory.

`files upload <path> --from <local-file> --root <id>` streams verified chunks. `files download <path> --to <new-local-file> --root <id>` stages locally and refuses overwriting. After an ambiguous upload, `files upload-status <id>`, `files upload-finish <id>` and `files upload-abort <id>` inspect/reconcile its receipt on the selected `--node`. Finish cannot publish incomplete data; abort cannot discard an unresolved committing receipt.

## Design references and extension points

The interaction model compares representative managers across desktop, terminal and browser environments; it is not a claim to inventory every file manager.

| Reference | Applied principle |
| --- | --- |
| [WinSCP Commander](https://winscp.net/eng/docs/ui_commander) and [transfer queue](https://winscp.net/eng/docs/ui_queue) | Independent panes, explicit source/destination, background progress |
| [Total Commander](https://www.ghisler.com/featurel.htm) | Two-panel operations and server-to-server work |
| [Midnight Commander](https://source.midnight-commander.org/man/mc.html) | Productive keyboard navigation and integrated editing |
| [Yazi](https://yazi-rs.github.io/docs/quick-start/) | Tabs, fast navigation and progressive detail |
| [Directory Opus](https://docs.dopus.com/doku.php?id=basic_concepts:the_lister) | Source/destination clarity and independent views |
| [File Browser](https://github.com/filebrowser/filebrowser) and [Filestash](https://www.filestash.app/sftp-client.html) | A browser workspace combining navigation, transfer and editing |
| [VS Code Remote SSH](https://code.visualstudio.com/docs/remote/ssh) | Visible remote identity while editing |

Prism supplies tabs with individual close controls, table viewports, confirmation dialogs, theme and application layout. MUI supplies tables, menus, breadcrumbs, responsive dialogs and accessible controls. CodeMirror supplies the lazily loaded code-editing engine rather than a second rich-text editor. No shared Titan/Prism package is rebuilt to add the workspace.

Future work is deliberately separated from the v1 contract: direct authenticated binary transfer, persistent browser-upload reconciliation, directory comparison/synchronization, recursive indexed search, configurable trash retention/quotas, richer preview codecs and optional per-root delegated agent grants. Agent access must be an explicit attenuation of human authority, not an admin token handed to a provider SDK. See [agent architecture](./agents.md) and [access](./access.md).
