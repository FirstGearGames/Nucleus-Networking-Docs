---
title: "Blitz Relay Transport component"
---

> **Driving the core API directly?** See [The relay transport](../../core-api/transports/relay-transport.md).

`BlitzRelayTransport` is a `NetworkTransport` component that carries a session through a relay, so two peers behind routers or NAT can reach each other without either one listening on a port. Add it to the `UnityCoreManager`'s GameObject; the `UnityTransportManager` adds it to the `CoreManager` with the inspector's settings applied.

The component and its custom editor compile only behind the `BLITZ_RELAY` scripting define. A project that has not added the define never loads anything relay-related.

## What must already be running

This component does not start a relay. It dials one. Something else has to be running the Blitz Relay service at the address and port configured below, and, if host migration is on, a directory service too. See [Hosting and joining a relay session](./relay-sessions.md) for standing those up.

## Relay

| Field | Default | Purpose |
|---|---|---|
| Address | `127.0.0.1` | Address of the Blitz Relay carrying this session. |
| Port | `7770` (`RelayTransport.DefaultRelayPort`) | Port the relay listens on. |
| Connection Key | empty | Key the relay admits peers with. Set by whoever runs the relay, never by a player. |

## Room

| Field | Default | Purpose |
|---|---|---|
| Room Code | empty | Room to join. Leave empty to host, or when joining by session id instead. |
| Maximum Clients | `16` (`RelayTransport.DefaultMaximumClients`) | How many clients a room created by this peer will hold. The relay refuses a room without a real number, so this cannot mean unlimited. |
| Transmission Unit | `1200` | Largest datagram to build before it is split. |

The relay reports a larger `DatagramOverheadBytes` than the Synapse transport does: on top of the usual per-packet overhead, every datagram also carries the relay's own framing so it can be routed to the right room. That overhead is deducted automatically when Nucleus reserves header space, so it does not require any adjustment here.

## Surviving a lost host

| Field | Default | Purpose |
|---|---|---|
| Host Migration | `true` | Register the session with a directory so it survives losing whoever is hosting it. |
| Directory Address | `127.0.0.1` | Address of the directory the session registers with. Shown only while Host Migration is on. |
| Directory Port | `47778` | Port the directory listens on. Shown only while Host Migration is on. |

Turning Host Migration on sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld`, so a client keeps its received world across the moment its link drops instead of being reset to an empty one. That wiring lives in a Pro-only partial (`BlitzRelayTransport.Migration.Pro.cs`). In a free build the toggle is present but does nothing: no `DisconnectResetMode` is set, and no migration coordinator is created.

This is the relay-and-directory handover this component ships: a client can keep its world across a host loss, and a peer can rejoin a moved session by session id instead of a room code. It is not a separate, broader engine-level host migration feature — nothing beyond what is described on this page and on [Hosting and joining a relay session](./relay-sessions.md) exists yet.

## Live fields

Two read-only fields appear while the game is playing: **Current Room**, the room this peer is hosting or has joined, and **Session Id**, shown in hex once a session has registered with a directory. Both are blank until play starts, and Session Id stays blank unless Host Migration is on and a session has actually opened.
