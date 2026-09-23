---
title: "Choosing a hosting topology"
---

## The three shapes

Nucleus does not pick a topology for you. A `CoreManager` can run its server half, its client half, or both, and that one choice is what separates a dedicated server, a player-hosted session, and a relayed room.

**Dedicated server.** You run a process with only the server half started. It has no gameplay of its own; every player connects as a client. You pay for the machine, and it keeps running whether or not any particular player is online.

**Host.** One player's process starts both halves. That player is also a client of their own server. Nobody else pays for a machine or keeps a process alive on your behalf; the session lives exactly as long as that player's process does.

**Relayed room.** A host, plus a `RelayTransport` in front of it. Neither the host nor any joining peer listens for inbound connections. Both sides are clients of the relay server, and the relay hands them to each other under a room code.

### What each costs

| Shape | Who runs a machine | Reachability | Session lifetime |
|---|---|---|---|
| Dedicated server | You | Server needs an open, reachable port | Independent of any one player |
| Host | The hosting player | Both server and client halves need an open, reachable port | Dies when the host's process does |
| Relayed room | The relay operator | Neither peer needs to be reachable | Dies when the host's process does, unless paired with a directory handover |

## A host is not a special mode

There is no host-only code path in the engine. A host is a `CoreManager` with a server started and a client started in the same process, talking to each other. `HostPairing` describes exactly this: two independent sockets, one process, each computed from the other's address. Under `HostPairing.Endpoint` the two halves exchange real datagrams over loopback like any other server/client pair; under `HostPairing.Local` they're paired in process without ever putting a packet on the wire. Either way, it's the same server and the same client code every other topology runs.

That has one direct consequence for trust: the host's `CoreManager` is the server. It runs the same server logic a dedicated server would, with the same say over what's true. Hosting doesn't relax that — it just means the server is sitting in a player's process instead of yours.

## Reachability

A dedicated server needs an open, forwarded port people can reach. A player host needs the same thing on the player's own connection — behind carrier-grade NAT or a restrictive firewall, that often doesn't work.

A relayed room needs neither. `RelayTransport` carries the session through a Blitz Relay server: "nothing here listens. Both sides are clients of the relay, one holding the host role in a room and the rest joining it." The host connects out to the relay, the relay names a room, and every joining peer connects out to the same relay and gives it the room code. No peer accepts inbound connections, so there's no port to forward and no NAT to fight.

## The relay doesn't change who's in charge

Relaying usually gets blamed for handing control to whoever the relay trusts, or for adding a man-in-the-middle that could tamper with state. That doesn't happen here, because the relay only replaces the transport's addressing — it's still one peer's `CoreManager` acting as the server. The host authenticates and simulates exactly as it would over a direct connection; the relay just forwards its packets under a room code instead of a socket address. Nothing on the wire becomes client-authoritative by being relayed, and no other peer gains any capability it wouldn't have had directly against that same host.

## Session lifetime

A plain host's session lives and dies with that player's process. Close the game, and the server half — and everyone's connection to it — goes with it.

What this repo ships for surviving that is a relay-plus-directory pairing: `ISessionHost` is the seam a directory implementation uses to publish where a session is hosted (`HostedCredential`) and to join wherever the directory currently points (`JoinAsync`). `NewfarmHostMigration` drives that against the directory on a poll loop, so a session can hand its hosting role from one peer to another without every client needing to be told a new address by hand. World-state retention across that handover (keeping the game state alive rather than starting the new host cold) is a Pro feature, and so is the pairing itself, because `NewfarmHostMigration` adopts the retained world when it promotes a peer. A broader, engine-level host migration feature is a separate, larger undertaking documented elsewhere and not yet built; this pairing is not that.

## Trade-off axes

Weigh a topology on these, not on habit:

- **Cost.** A dedicated server is a machine you run and pay for continuously. A host costs you nothing directly — the player's machine and connection carry it. A relay costs whoever runs the relay server, continuously, whether or not it's you.
- **Trust.** All three have exactly one `CoreManager`, and it is the server. What differs is whose process it runs in, and whether you trust that process's operator (yourself, or a player) to run honest server logic.
- **Latency.** A dedicated server sits somewhere fixed, generally central. A host's latency is whatever every other peer's connection to that one player looks like — good for the host, variable for everyone else. A relay adds the extra hop through the relay server on top of the host's own connection.
- **Persistence.** A dedicated server's world persists independent of players. A plain host's world dies with the host's process. A relayed room with the directory pairing can hand the session to a new host, and Pro can carry the world state across that handover.
- **Who keeps a machine running.** A dedicated server asks you to. A host asks a player to, for as long as the session needs to exist. A relay asks whoever operates the relay to keep a lightweight forwarding service up, plus (for a survivable session) a directory.

## What Nucleus does not provide

Nucleus does not run matchmaking, does not run a lobby service, and does not operate a hosted relay for you. `RelayTransport` and the directory seam (`ISessionHost`) are building blocks you point at infrastructure you run or a service you choose — the engine doesn't supply that infrastructure itself.

All three transports Nucleus ships — Synapse, Yak, and the Blitz Relay integration — are UDP. Pick a topology for its reachability and trust trade-offs, not for a transport-level constraint; none of the three shapes changes which transport you're allowed to use.
