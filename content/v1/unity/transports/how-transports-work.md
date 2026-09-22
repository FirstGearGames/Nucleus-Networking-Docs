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

Promotion past the transmission unit differs by what is being sent:

- A message or a remote call that will not fit is promoted to `Channel.Reliable`, because an unreliable transport cannot fragment it and would drop it silently.
- A state write that will not fit is fragmented instead (`SegmentMode.Split`), sent across multiple segments on whichever channel it was already using.

## Maximum Transmission Unit

`Configuration.MaximumTransmissionUnit` is 1200 bytes by default — the ceiling on what the engine packs into one packet before it fragments or promotes.

The engine never gets the full 1200 bytes of payload to work with. Each transport reports `DatagramOverheadBytes`, the header it prepends to every datagram, and the engine reserves that (plus its own packet header) out of the configured unit before writing anything. So the number you set is a limit on the datagram, not a guarantee of payload space, and how much space you actually lose depends on the transport:

- Synapse reports its socket library's own header size as overhead.
- Blitz Relay reports more: the relay's own framing on top of the same underlying socket header, because the relay is a hop the packet passes through, not the endpoint reading it. A relayed session always has less usable payload per packet than a direct Synapse connection at the same MTU.

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
