---
title: "Sending a Message to Many Peers"
---

## Sending to everyone

`ServerManager.SendMessage<T0>` sends a message to every authenticated client. A host's own client is included, delivered in process rather than over a socket. A client still awaiting an authentication outcome is left out.

```csharp
CoreManager.ServerManager.SendMessage(Channel.Reliable, new SomeMessage());
```

There is no client-side equivalent that fans out to multiple peers. See [The client direction](#the-client-direction) below.

## Sending to a chosen set

The overload taking an `IReadOnlyCollection<Connection>` sends to exactly the clients you supply, without the authentication filter the whole-session overload applies. A caller that assembled its own set has already decided who belongs in it.

```csharp
CoreManager.ServerManager.SendMessage(Channel.Reliable, new SomeMessage(), myConnections);
```

## Sending to everyone but one

`SendMessageExcept<T0>` sends to every authenticated client except the one named.

```csharp
CoreManager.ServerManager.SendMessageExcept(Channel.Reliable, new SomeMessage(), excludedConnection);
```

The exclusion is matched on `Connection.Id`, not by reference. A host holds two `Connection` instances for its own client, and either one names the same player, so a reference comparison would let one of the two through. `excludedConnection` may be null, and null excludes nobody.

## Sending to a scene's occupants

`SendMessageToScene<T0>` sends to every client that has the given scene instance loaded.

```csharp
CoreManager.ServerManager.SendMessageToScene(Channel.Reliable, new SomeMessage(), sceneHandle);
```

`SceneManager.CollectConnectionsInScene` decides who counts as an occupant: every active connection for which `connection.IsSceneLoaded(sceneHandle)` is true. A scene is the observer rule most games actually want, so it's worth one call instead of renting a list and doing the filtering yourself.

## The refusal on a peer with no server

Each of these calls opens with `EnsureIsServerStarted`. On a peer that has not started a server, the call does nothing and logs an error naming the method that refused. This is a loud refusal rather than a silent no-op: a send from a peer that is not the server would otherwise walk an empty or stand-in-only connection set and go quietly nowhere, which reads as a lost message rather than as a call that was never valid.

## The client direction

There is no client-side fan-out API, by design: a client only ever has one peer to send to, the server it's connected to.

```csharp
if (CoreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
    serverConnection.SendMessage(Channel.Reliable, new SomeMessage());
```

`TransportManager.TryGetServerConnection` resolves the local server connection, then `Connection.SendMessage` sends on it directly.
