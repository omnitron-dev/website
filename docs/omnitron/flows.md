---
id: "omnitron/flows"
slug: "/docs/omnitron/flows"
title: Event flows
description: Observe a host, model decisions and dispatch a notification, a reviewed maintenance task or work for a Studio member.
---

# Event flows

A flow turns an observation into a decision on the controller that owns the workspace. An administrator can draw it in **Flows**. A Studio lead can propose the same graph in a team room. Both open in the same editor, with the same component catalog, validator and sample-event preview.

:::info{title="Availability"}
The flow editor and controller runtime are on Omnitron main after 0.4.14.
:::

## Build a disk-space monitor {#disk-space}

Start with the disk-space template. Choose a volume on the controller, set the interval and enter a low threshold and a higher recovery threshold. The default outputs record a local notification when space runs low and another on recovery.

The recorded example below enters the low state under 10 GiB and recovers at 12 GiB. Move through the observations to see when an action is due. The samples were evaluated by Omnitron's flow engine.

<DiskFlowTrace hydrate="visible" />

```mermaid
flowchart LR
  Disk["Disk sample"] --> Test{"Free space"}
  Test -->|low| Incident["Notify the operator"]
  Test -->|recovered| Clear["Notify recovery"]
  Test -->|low| Task["Assign a Studio member"]
```

Choose the source, enter a sample event and inspect the highlighted connections. The preview lists the data and effects that would reach each destination. Save the draft, check the target workspace and activate its reviewed revision. The controller records subsequent observations and deliveries in its local history. A project operator can open and preview a team proposal. Saving and activating a graph requires an administrator.

## Choose an action {#actions}

| Component | Outcome |
| --- | --- |
| Local notification | Records an operator-visible notification in the flow workspace. |
| Assign a Studio task | Sends the configured assignment to the specific team and member. The delivery identifies the resulting turn. |
| Request pipeline review | Prepares the selected pipeline revision for an administrator to inspect. |
| Run approved release pipeline | Starts the pinned project maintenance pipeline using bounded local release steps. Disk readings and incoming messages never become command parameters. |

To automate cleanup, first publish and qualify a project maintenance task that knows which data it owns. Bind its local release pipeline and revision to the low branch. A second signal during the same low-space interval keeps the incident open. The next cleanup becomes eligible after recovery and a new drop. An administrator can pause the flow and inspect individual deliveries. [Pipeline execution and recovery](./automation.md)

## Connect an event source {#sources}

A manual source accepts a test input. An incoming-event source selects an event type. Authenticated Netron clients submit an event to a particular activation, and the controller can observe live stack lifecycle events in its workspace. An offline controller misses local broadcasts. Backpressure before admission is reported by the controller. The disk source reads available filesystem bytes under the controller's operating-system account.

An event identifies its source node, type and named values. Use **Select fields** to limit the data that reaches an output. Branches can act independently. The controller commits the processed event, condition and delivery IDs together. Repeating the same submitted event returns the original receipt. Changing its content under the same identity raises a conflict.

## Monitor a mesh from one controller {#mesh}

Choose **Enrolled node** as the disk source. Pick the node from the fleet registry and the exact mount reported by its daemon. The revision binds the node identifier, management endpoint and approved SSH host key. A fresh, authenticated reading carries the node ID, mount and available bytes into the graph. The controller that activated the flow owns its thresholds, notifications and delivery receipts.

A disconnected peer, a missing mount or a changed host key appears as a source error. The previous threshold state stays in place until a valid sample arrives. Replacing the registration or changing its trusted identity requires a new review. Multiple flows on the same controller share a peer snapshot during a sampling pass.

The local pipeline output runs in the activating controller's reviewed project and stack. Monitoring a second node does not move that output there. Existing fleet operations have their own target-specific receipts. Studio rooms and provider conversations belong to the controller that hosts them. [Node and fleet architecture](./architecture.md)

## Extend a controller {#components}

Each component declares its version, fields and output ports. Developers can install a bounded JSON component pack at `$OMNITRON_HOME/flow-components.json` and load it at controller startup. Compose the built-in field transformations and an optional final decision. The resulting component appears in the human editor and the lead's MCP catalog. Its fingerprint contributes to the reviewed flow revision.

For example, a **Disk reserve** component can select `freeBytes` and apply a threshold with operator-defined floor and recovery values. It exposes the same **low** and **recovered** ports in every project. A malformed pack produces a diagnostic while the built-in components remain available. The versioned registry is also available to custom hosts through `@omnitron-dev/omnitron/flows`. [Work with a Studio team](./studio.md#team-room)
