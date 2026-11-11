---
title: "Choosing a hosting topology"
---

## Pick one of two shapes

A `CoreManager` can run its server half, its client half, or both. That choice is what makes a dedicated server or a player-hosted session.

- **Dedicated server.** A process runs only the server half, and every player connects as a client.
- **Host.** One player's process runs both halves, so that player is a client of their own server. It runs the same server and client code as a dedicated server; see `HostPairing` on [The Synapse transport](./synapse-transport.md) for how the halves connect.

| | Dedicated server | Host |
|---|---|---|
| Who runs a machine | You, continuously | The hosting player |
| Reachability | Server needs an open, reachable port | Host needs an open, reachable port on the player's connection, which often fails behind carrier-grade NAT or a strict firewall |
| Session lifetime | Independent of players | Ends when the host's process does, unless paired with a directory handover |
| Latency | A fixed, usually central server | Good for the host, variable for everyone else |

## The server is in charge in every shape

Every shape has exactly one server: one `CoreManager` running the same server logic. A host's server simply runs in a player's process, so decide whether you trust that player.

## Keep a session alive after the host leaves

A plain host's session ends when the host's process does. For a session to survive, pair it with a directory:

- `ISessionHost` is what a directory implementation uses to publish where a session is hosted (`HostedCredential`) and to join wherever the directory points (`JoinAsync`).
- `NewfarmHostMigration` polls the directory, so a session can hand its hosting role to another peer without clients being told a new address by hand. It is Pro, and it adopts the retained world when it promotes a peer, so the game state survives the handover.

This pairing is not engine-level host migration. In Unity, the loopback relay tests it on one machine and the Steam transport add-on ships it; see [Testing host migration on one machine](../../unity/transports/relay-sessions.md). [`NewfarmHostMigration`](./newfarm-host-migration.md) is the coordinator, and [`ISessionHost`](./session-hosts.md) carries it over another service.

## Bring your own services

Nucleus does not run matchmaking, a lobby service, a relay or a directory for you. `ISessionHost` connects to infrastructure you run or a service you choose. Neither shape limits which shipped transport you can use.
