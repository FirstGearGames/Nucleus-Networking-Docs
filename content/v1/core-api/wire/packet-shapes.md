---
title: "The Shapes on the Wire"
---

## Packet types

Every packet the transport hands off carries a `PacketType` in its header.

- **Message** — one-shot single-packet messages, deserialized immediately.
- **State** — tick-aligned data that may span several segments.
- **Reconcile** — correction data sent to clients; only ever received on a client, which replays forward from that point after applying the correction.
- **Raw** *(DEBUG builds only)* — raw data with no special formatting.
- **Rpc** — system-addressed remote calls, deserialized as they arrive rather than on a tick boundary.

`Raw` exists only under `#if DEBUG` and sits at value 3. `Rpc` is declared past it and held at value 4 whether or not `Raw` is compiled in, so a debug peer and a release peer read the same header regardless of build configuration.

## State subpacket types

A `State` packet's body is not one thing — it is a sequence of framed subpackets, each tagged with a `StatePacketType`. Seventeen kinds exist:

| Kind | Carries |
|---|---|
| `Delta` | Delta-serialized system state: members encoded against their shared baseline, for a change the sender made itself. The default, cheapest kind — a world that never grants write access emits only this one. |
| `Full` | Full-serialized system state, used for spawns and resyncs. |
| `Controller` | Controller changes, as a list of `(SystemId, ControllerConnectionId, ControllerRetentionToken)` entries. |
| `Input` | Tick-aligned input from the controlling client. Only ever sent client→server, never replicated downstream. |
| `Reconcile` | Server→controller state correction carrying the server's full state for a system at the current tick. |
| `Ack` | A standalone acknowledgment carrying the receiver's highest fully-applied tick that carried state. Written only when that value has advanced and there's no other outbound traffic to piggyback it on. |
| `Recovery` | Targeted loss recovery: the served-through tick followed by absolute full values for each recovered system's changed components. Systems spawned since the acknowledged tick ride `Full` instead. |
| `Despawn` | System despawns, as a count followed by the stopped systems' Ids. Server-only; written after that tick's state subpackets. |
| `WriteAccess` | Who may write a system's state, as `(SystemId, access, may-this-connection-write)` entries. Server→client only. |
| `RpcAccess` | Who may send a system a remote call, as `(SystemId, access, may-this-connection-send)` entries. Server→client only. |
| `DeltaRelayed` | Delta-serialized state the sender is passing on from another peer, rather than a change it made itself. |
| `DeltaAbsolute` | Delta-serialized state whose changed members carry self-contained absolute values (not baseline-encoded), for a change the sender made itself. |
| `DeltaAbsoluteRelayed` | Same as `DeltaAbsolute`, but relayed from another peer. |
| `RosterAdd` | Peer-roster additions, as a count followed by added peers' `Connection.Id`s. Server-only; written ahead of every other kind. |
| `RosterRemove` | Peer-roster removals, as a count followed by departed peers' `Connection.Id`s. Server-only; written after that tick's despawns. |
| `SceneMove` | A system's scene changing, as a count followed by `(SystemId, SceneHandle)` entries. Server-only, to established observers only. |
| `Reparent` | A system's parent changing, as a count followed by `(SystemId, ParentId)` entries. Server-only, to established observers only. |

`DeltaAbsolute`/`DeltaAbsoluteRelayed` exist because a plain `Delta` can't say two things a receiver needs and can't re-derive: whether the payload is baseline-encoded or self-contained, and whether the sender authored the change or is relaying somebody else's. Carrying those as the subpacket kind rather than as per-system bits pays for itself once enough systems share the same answer in a tick.

## Framing and apply order

Each subpacket is written as its `StatePacketType`, then its bit length, then its body. This makes the stream self-describing: a receiver that doesn't recognize or can't bind an entry steps over it whole using the declared length, instead of losing alignment for everything after it.

A tick's segments are rejoined into one `Reader` before any of this is read. Within that combined stream the declared write order is `RosterAdd`, spawns (`Full`), `Controller`, `SceneMove`, `Reparent`, then the delta kinds, then `Despawn`, then `RosterRemove`. The receiver applies frames in that order — `Full` before `Controller` before `Delta` — so a spawn exists before control or state addresses it, and a despawn is applied only after that system's final state has landed.

## RpcRoute

An RPC packet carries an `RpcRoute` naming where the call is headed, packed into two bits by the generated serializer:

- **Server** — a client's call to the server; it stops there.
- **Observers** — a call to every connection observing the system. Legal in both directions: from the server it *is* the fan-out; from a client it's a request for one, admitted and judged by the server's handlers before going out to the other observers.
- **Target** — the server's call to a single observing connection. Server-only; one arriving from a client is discarded and logged, since no engine path produces it.
- **TargetRelay** — a client's call to a single connection it named, passed on once the server admits it. The server rewrites the route to `Target` before forwarding, so the recipient can't tell a routed call from one addressed to it directly.

Direction is validated against the sender's role on receipt, not inferred from which link the packet arrived on — a host holds connections in both directions, so the role has to be checked explicitly.

## Segmentation

A `State` packet's combined stream can be too large for one transport unit, so it's split across segments. `StatePacket` carries `SegmentNumber` and `ExpectedSegmentCount` for this: segments span the *whole* combined stream for a tick — every subpacket kind is packed and numbered together — so when everything fits in one transmission unit, `ExpectedSegmentCount` is 1.

`PacketHeader.MaximumOutboundHeaderBytes` (48) is the space reserved ahead of a segment's body for the packet header and `StatePacket` wrapper fields (packet type, tick deltas, acknowledgment ticks, segment number and count) before the transport decides how much room is left for payload. Reserving it up front means the transport never has to run a second segmentation pass after the header grows into space it thought was payload.

`SegmentMode` names how a segment is filled — `Strict` (data must fit the maximum segment size), `Overfill` (exceed it rather than split), `Split` (always fill to the maximum, splitting the data across multiple segments) — but it's an internal enum, not something reachable from outside the engine.

## IncomingPacket and OutgoingPacket

`IncomingPacket` is what a received packet looks like once it's on its way into the engine: `Payload` (the raw bytes to read), `Channel`, `Sender` (the `Connection` that produced it), `Invoker` (which role sent it — Server or Client, derived from `Sender.IsServer`), and `Transport` (the transport it arrived on). `ReturnPayloadArray()` returns `Payload`'s backing array to the shared `ArrayPool`.

`OutgoingPacket` is the send-side counterpart: `Payload` (the bytes to send), `Channel`, `Sender`, `Receiver` (the connection to route to), `Writer` (the `Writer` that produced the payload), and `Return()`, which returns the `Writer` to its pool and, if the payload was copied into a pooled array of its own, returns that array too.

The convention across both types is one owner copies once, and one owner returns: a payload lives in its writer's buffer unless a later stage copies it out, and whichever struct ends up holding that copy is the one responsible for returning it.

## Scope

`PacketHeader` is a public type, but every member on it is `internal`, and `SegmentMode` is `internal` as well. Nothing here is a public API for writing packets — this page is for reading what's on the wire (a log line, a capture, a framing error), not for constructing packets yourself.
