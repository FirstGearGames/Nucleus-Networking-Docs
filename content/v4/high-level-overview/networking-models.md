---
title: "Networking Models"
---

This page discusses the various networking models and architectures used in games and what Fish-Networking uses.

## Client-Server Architecture

The client-server model is the most widely used approach in multiplayer networking. In this model:

- **Server** — The authoritative instance of the game. It manages game logic, synchronizes game state, validates player actions, and handles communication between clients.
- **Client** — A player's instance of the game. It sends input to the server and receives updates about the game state.

There are two main types of servers:

### Dedicated Server

The server runs as its own process, separate from any player. It's more secure and scalable, commonly used in competitive or large-scale games.

As shown in the dedicated server model, the clients (players) are all connected directly to the server and communicate with it instead of with each other.

![Client-Server (Dedicated) Model](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-ec94c5b6d93779020ea41f75dbb083b9266a47ae%2Fclient-server-model.svg?alt=media)

### Host (Listen-Server)

The server and one of the clients run in the same process. This is common in smaller games or development environments.

In a listen-server model all clients connect directly with the server, but unlike the dedicated server, the listen server is also acting as a client (player).

![Listen-Server Model](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-1f8967fc393f3b673d2c616dfcffd7972b3c09d7%2Flisten-server-model.svg?alt=media)

> ✅ FishNet supports both dedicated and listen-server models out of the box.

## Peer-to-Peer (P2P)

In peer-to-peer networking, each player (or peer) connects directly to others without a central server. This reduces latency and server costs but comes with challenges:

- Poor security and cheating prevention
- Difficult to synchronize game state reliably
- NAT traversal issues

P2P is rarely used in modern real-time multiplayer games, especially competitive ones, due to these drawbacks. FishNet does not use P2P, as it is designed around the client-server model for reliability and security.

![Peer-to-Peer Model](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-71c52be573c6467003e15649ea1ab82eb63648d0%2Fp2p-model.svg?alt=media)

> ℹ️ Very often a listen server setup is referred to as P2P. FishNet does support a listen server.

## Relay Servers

Sometimes clients are unable to connect directly to the server due to NAT (Network Address Translation) or firewall restrictions. A relay server acts as a middleman to forward traffic between clients and the server.

Relay servers:

- Allow connectivity when direct connections fail
- Introduce additional latency
- May be used as a fallback or for web-based games

![Relay Server Model](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-63e35fd00d7166f8822fa910ecdf191eb985788c%2Frelay-server-model.svg?alt=media)

> ✅ Fish-Networking supports multiple third-party relay services including Unity's Relay, Edgegap's Distributed Relay, Photon Realtime, Epic Online Services' Relay Service, and Steam Datagram Relay.

## Host Migration

When using a listen server, the host leaving the game would cause all players to leave the game. Host migration is a feature for maintaining game sessions in the event the current host disconnects or experiences network issues. It enables a new host to be elected from the remaining connected players, minimizing disruption and ensuring the game session can continue seamlessly.

> ⚠️ Fish-Networking doesn't yet have built-in host migration, but it is a feature that may be added in the future.
