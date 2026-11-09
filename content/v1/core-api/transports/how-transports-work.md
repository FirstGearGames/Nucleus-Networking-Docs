---
title: "How transports work"
---

A `Transport` only moves bytes between peers: it connects, disconnects, sends and receives datagrams, and reports whether a connection is its own client talking to its own server (`IsOwnClientConnection`). Replication, spawning and reconciliation work the same on every transport, so you can swap one for another without changing game code.

## Pick a transport

| Transport | What it is | When to use it |
|---|---|---|
| Synapse | Real UDP sockets. | Direct connections and dedicated servers, wherever the server has a reachable address and port. |
| Yak | Offline and in-process; nothing is bound. | Single-player or same-process testing where no socket should exist. |
| Loopback relay | A relay the main Unity editor runs on this machine. | Testing host migration with two editors on one machine, never a shipped game. See [Testing host migration on one machine](../../unity/transports/relay-sessions.md). |

A `CoreManager` can hold several transports at once. Add each with `TransportManager.AddTransportAsync` or `TryAddTransportAsync`, then connect with a separate `ConnectAsync` call. See [TransportManager](./transport-manager.md). In Unity, `UnityTransportManager` does this for you; see [Transport Manager component](../../unity/transports/transport-manager-component.md).

## Every send picks a channel

- `Channel.Reliable`: ordered and reliable.
- `Channel.Unreliable`: unreliable.

State, remote calls and messages default to `Channel.Unreliable`. A message or remote call too large for one packet still arrives whole: a reliable one in order, an unreliable one whole or not at all, on every transport.

## The transmission unit limits the datagram, not the payload

`Configuration.MaximumTransmissionUnit` defaults to 1200 bytes. Each transport reports `DatagramOverheadBytes`, its per-datagram header, and that comes out of the 1200 before your data.

To build your own transport, see [The Transport contract](./transport-contract.md).
