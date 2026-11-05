---
title: "How transports work"
---

A `Transport` only moves datagrams between two peers. It connects, disconnects, sends and receives, and tells the engine whether a connection is its own client talking to its own server (`IsOwnClientConnection`). Everything else lives in the engine above it, so a game replicates, spawns and reconciles the same way over Synapse, Yak or Blitz Relay, and you can swap transports without changing anything else.

## Every send picks a channel

- `Channel.Reliable`: ordered and reliable.
- `Channel.Unreliable`: unreliable.

State, RPCs and messages default to `Channel.Unreliable`, and move to `Channel.Reliable` only when something requires it.

A send larger than the transmission unit keeps its channel:

- A reliable message or remote call still arrives whole and in order.
- An unreliable message or remote call stays unreliable on every transport, the relay included. It arrives whole or not at all.
- State stays on whichever channel it was already using.

## The transmission unit limits the whole datagram

`Configuration.MaximumTransmissionUnit` is 1200 bytes by default. It is the largest datagram the engine builds before it splits a send. Each transport keeps some of that room for itself, so not all of it is payload. A session through Blitz Relay has less usable room per packet than a direct Synapse connection at the same setting.

## Choose a transport

| Transport | What it is | When to use it |
|---|---|---|
| Synapse | Real UDP sockets | Direct connections, dedicated servers, anywhere the server has a reachable address and port. |
| Yak | Offline, in-process, nothing bound | Local single-player or same-process testing where no socket should exist. |
| Blitz Relay | A third machine carries the traffic | Peers that cannot reach each other directly, such as both behind NAT with no port forwarding. It costs relay overhead and depends on that third machine. |

## Add transports to the core manager

A `CoreManager` can hold several transports at once. Add each with `TransportManager.AddTransportAsync` or `TryAddTransportAsync`, which adds and initializes it; connect it later with `ConnectAsync`. In Unity, `UnityTransportManager` does this for you; see [Transport Manager component](./transport-manager-component.md).
