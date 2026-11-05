---
title: "Terminology"
---

These are the words the Start Here pages use. Coming from FishNet? See the [FishNet to Nucleus name map](../reference/fishnet-name-map.md).

## Peers

- A **peer** is one running copy of your game.
- The **server** is the peer that decides what is true.
- A **client** is a peer that connects to the server.
- A **host** is one peer that runs a server and a client together, so the person running it can play too.
- A **connection** (`Connection`) is the link to one peer.

## Networked objects

- A **network system** (`NetworkSystem`) is one networked object. It is created and removed on every peer as a whole.
- A **network component** (`NetworkComponent`) is a class you write to list the values a network system replicates.
- A **network member** (`NetworkMember<T0>`) is one replicated value in a network component.
- To **replicate** a value is to send it from the server to the other peers so that every copy matches.
- To **spawn** an object is to create it on the server so that every client creates its own copy.

## Control

- The **controller** of an object is the peer that drives it, which other engines call the owner. The server is the controller until it gives control to a client, as `NetworkPlayerSpawner` does with each player's object.
- `IsController` tells a script whether this peer is the controller.

## Time

- A **tick** is one step of the network clock. Nucleus sends and applies updates once per tick.
- The **tick rate** is how many ticks run each second. It is 30 by default.

## Visibility

- A client **observes** an object when it receives that object's updates.
- **Interest** is the set of rules that decides which objects each client observes.

## Sending data

- A **message** is data you send to one connection with `Connection.SendMessage`.
- An **RPC** is a call you send on one network system with `NetworkSystem.TrySendRpc`, to the server, to every observer, or to one connection.
- `Channel.Reliable` data always arrives, in the order it was sent. `Channel.Unreliable` data can be lost.
