---
title: "Choosing a hosting topology"
---

## Pick one of three shapes

A `CoreManager` can run its server half, its client half, or both. That choice is what makes a dedicated server, a player-hosted session or a relayed room.

- **Dedicated server.** A process runs only the server half, and every player connects as a client.
- **Host.** One player's process runs both halves, so that player is a client of their own server. It runs the same server and client code as every other shape; see `HostPairing` on [The Synapse transport](./synapse-transport.md) for how the halves connect.
- **Relayed room.** A host behind a [`RelayTransport`](./relay-transport.md). Host and joiners all connect out to a Blitz Relay server, which pairs them under a room code. No peer accepts inbound connections, so there is no port to forward and no NAT to fight.

| | Dedicated server | Host | Relayed room |
|---|---|---|---|
| Who runs a machine | You, continuously | The hosting player | The relay operator, continuously |
| Reachability | Server needs an open, reachable port | Host needs an open, reachable port on the player's connection, which often fails behind carrier-grade NAT or a strict firewall | Neither peer needs to be reachable |
| Session lifetime | Independent of players | Ends when the host's process does | Ends with the host, unless paired with a directory handover |
| Latency | A fixed, usually central server | Good for the host, variable for everyone else | Adds a hop through the relay |

## The server is in charge in every shape

Every shape has exactly one server: one `CoreManager` running the same server logic. A host's server simply runs in a player's process, so decide whether you trust that player. A relay only forwards packets under a room code instead of a socket address; the host still authenticates and simulates as it would directly, and no peer gains anything by being relayed.

## Keep a session alive after the host leaves

A plain host's session ends when the host's process does. For a relayed session to survive, pair it with a directory:

- `ISessionHost` is what a directory implementation uses to publish where a session is hosted (`HostedCredential`) and to join wherever the directory points (`JoinAsync`).
- `NewfarmHostMigration` polls the directory, so a session can hand its hosting role to another peer without clients being told a new address by hand. It is Pro, and it adopts the retained world when it promotes a peer, so the game state survives the handover.

This pairing is not engine-level host migration.

## Bring your own services

Nucleus does not run matchmaking, a lobby service or a hosted relay. `RelayTransport` and `ISessionHost` connect to infrastructure you run or a service you choose. No shape limits which shipped transport you can use.
