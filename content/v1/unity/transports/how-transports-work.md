---
title: "How transports work"
---

## What a transport does

A `Transport` moves bytes between two peers, and nothing else. It connects, disconnects, sends and receives datagrams, and tells the engine whether a given connection is its own client talking to its own server (`IsOwnClientConnection`). It does not know about identity, interest, reliability semantics, acknowledgment, or recovery — those all live in the engine above it, in `Connection` and the managers that use it.

That division is what lets you swap a transport without touching anything else. A game built against Synapse, Yak, or Blitz Relay replicates, spawns, and reconciles the same way regardless of which one is moving the bytes, because none of that logic ever reaches down into the transport.

## Channels

Every send picks a `Channel`:

- `Channel.Reliable` — ordered and reliable.
- `Channel.Unreliable` — unreliable.

Nucleus is unreliable-first: state, RPCs, and messages default to `Channel.Unreliable` and only move to `Channel.Reliable` when something requires it.

A send larger than the transmission unit keeps its channel:

- A reliable message or remote call that will not fit still arrives whole and in order.
- An unreliable message or remote call that will not fit stays unreliable on every transport, the relay included. It arrives whole or not at all.
- State that will not fit stays on whichever channel it was already using.

## Maximum Transmission Unit

`Configuration.MaximumTransmissionUnit` is 1200 bytes by default. It is the largest datagram the engine builds before it splits a send.

The number you set is a limit on the whole datagram, not a guarantee of payload space, because each transport keeps some of that room for itself. How much it keeps depends on the transport: a session through Blitz Relay always has less usable room per packet than a direct Synapse connection at the same transmission unit, because the relay is a hop the packet passes through and needs room of its own.

## The three shipped transports

| Transport | What it is | When to use it |
|---|---|---|
| Synapse | Real UDP sockets | Direct connections, dedicated servers, anywhere both peers (or the server) have a reachable address and port. |
| Yak | Offline, in-process, nothing bound | Local single-player or same-process testing where no socket should exist at all. |
| Blitz Relay | A third machine carries the traffic | Peers that can't reach each other directly — no port forwarding, both behind NAT — at the cost of relay overhead and a dependency on that third machine. |

## Adding transports

A `CoreManager` can hold several transports at once — add each with `TransportManager.AddTransportAsync` or `TryAddTransportAsync`. A transport is added and initialized before it is connected; `ConnectAsync` is a separate, later call.

## Where to go next

Driving this from the Unity integration: see the transport component pages. Driving it from plain C#: see the API pages for `Transport`, `Configuration`, and `TransportManager`.
