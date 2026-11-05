---
title: "Choosing a hosting topology"
---

Nucleus does not pick a topology for you. A `CoreManager` can run its server half, its client half, or both, and that choice gives three shapes:

- **Dedicated server:** a process runs only the server half and has no gameplay of its own. Every player connects as a client.
- **Host:** one player's process runs both halves, so that player is also a client of their own server.
- **Relayed room:** a host with a `RelayTransport` in front of it. No peer listens for inbound connections. Every peer, the host included, connects out to a Blitz Relay server, which pairs them under a room code.

## Compare the shapes

| | Dedicated server | Host | Relayed room |
|---|---|---|---|
| Who runs and pays for a machine | You, continuously | The hosting player, with their own machine and connection | Whoever operates the relay, continuously, plus a directory for a survivable session |
| Reachability | The server needs an open, reachable port | The host needs an open, reachable port on the player's own connection, which often fails behind carrier-grade NAT or a strict firewall | No peer needs to be reachable, so there is no port to forward |
| Session lifetime | Independent of any player | Ends when the host's process does | Ends when the host's process does, unless paired with a directory handover |
| Latency | A fixed, generally central location | Good for the host, variable for everyone else | The host's latency plus a hop through the relay |
| Trust | You run the server | A player runs the server | A player runs the server |

## A host is an ordinary server and client

A host runs the same server and client code as every other topology, in one process. Under `HostPairing.Endpoint` the two halves exchange real datagrams over loopback; under `HostPairing.Local` they are paired in process without putting a packet on the wire.

Every topology has exactly one `CoreManager` acting as the server, with full say over what is true. Hosting does not relax that: it only moves the server into a player's process. What differs is whether you trust that process's operator to run honest server logic.

## The relay does not change who is in charge

The relay only replaces the transport's addressing: it forwards packets under a room code instead of a socket address. One peer's `CoreManager` is still the server and authenticates and simulates exactly as it would over a direct connection. Nothing becomes client-authoritative by being relayed, and no peer gains a capability it would not have directly against the same host.

## A relayed session can outlive its host

A plain host's session ends with the host's process, along with everyone's connection to it. A relayed room paired with a directory can hand hosting from one peer to another, so clients do not have to be told a new address by hand:

- `ISessionHost` is the interface a directory implementation uses to publish where a session is hosted (`HostedCredential`) and to join wherever the directory currently points (`JoinAsync`).
- `NewfarmHostMigration` drives that against the directory.

The pairing, and keeping the world state across the handover instead of starting the new host empty, need Pro. Nucleus has no broader, engine-level host migration.

## Nucleus provides no matchmaking, lobby or hosted relay

Nucleus does not run matchmaking, a lobby service, or a hosted relay. `RelayTransport` and `ISessionHost` are building blocks you point at infrastructure you run or a service you choose.

All three shipped transports, Synapse, Yak and the Blitz Relay integration, use UDP. No topology restricts which transport you can use, so pick a topology for its reachability and trust trade-offs.
