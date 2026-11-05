---
title: "Blitz Relay Transport component"
---

> **Driving the core API directly?** See [The relay transport](../../core-api/transports/relay-transport.md).

`BlitzRelayTransport` carries a session through a relay, so two peers behind routers or NAT can reach each other without either one listening on a port. Add it to the `UnityCoreManager`'s GameObject, and `UnityTransportManager` adds it to the `CoreManager` with the inspector's settings.

Before you use it:

- It needs Pro. The relay integration does not compile against a Free `Nucleus.dll`.
- Add the `BLITZ_RELAY` scripting define. The component and its editor compile only behind it.
- Run a Blitz Relay service at the address and port below, and a directory service too if Host Migration is on. This component dials them; it does not start them. See [Hosting and joining a relay session](./relay-sessions.md).

## Point it at the relay

| Field | Default | Purpose |
|---|---|---|
| Address | `127.0.0.1` | Address of the Blitz Relay carrying this session. |
| Port | `7770` (`RelayTransport.DefaultRelayPort`) | Port the relay listens on. |
| Connection Key | empty | Key the relay admits peers with. Set by whoever runs the relay, never by a player. |

## Set up the room

| Field | Default | Purpose |
|---|---|---|
| Room Code | empty | Room to join. Leave empty to host, or when joining by session id instead. |
| Maximum Clients | `16` (`RelayTransport.DefaultMaximumClients`) | How many clients a room created by this peer holds. The relay refuses a room without a real number, so this cannot mean unlimited. |
| Transmission Unit | `1200` | Largest datagram to build before it is split. Nucleus already leaves room for the relay's routing, so it needs no adjustment for the relay. |

## Survive losing the host

| Field | Default | Purpose |
|---|---|---|
| Host Migration | `true` | Registers the session with a directory so it survives losing whoever is hosting it. |
| Directory Address | `127.0.0.1` | Address of the directory the session registers with. Shown only while Host Migration is on. |
| Directory Port | `47778` | Port the directory listens on. Shown only while Host Migration is on. |

Turning Host Migration on sets `ClientManager.DisconnectResetMode` to `RetainReceivedWorld`, so a client keeps its received world when its link drops instead of being reset to an empty one.

This is the only host migration Nucleus has: a client keeps its world across a host loss, and a peer can rejoin a moved session by session id instead of a room code. Nothing beyond this page and [Hosting and joining a relay session](./relay-sessions.md) exists yet.

## Read the room and session while playing

While the game plays, the inspector shows two read-only fields: **Current Room**, the room this peer is hosting or has joined, and **Session Id**, in hex. Session Id stays blank unless Host Migration is on and a session has registered with a directory.
