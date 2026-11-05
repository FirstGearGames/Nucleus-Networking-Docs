---
title: "Sending a Message to Many Peers"
---

## Send to every authenticated client

`ServerManager.SendMessage<T0>` sends a message to every authenticated client, including a host's own client. A client still waiting to be authenticated is left out.

```csharp
CoreManager.ServerManager.SendMessage(Channel.Reliable, new SomeMessage());
```

Clients have no fan-out; see [The client direction](#the-client-direction).

## Send to a chosen set

This overload sends to exactly the connections you pass, with no authentication filter:

```csharp
CoreManager.ServerManager.SendMessage(Channel.Reliable, new SomeMessage(), myConnections);
```

`myConnections` is an `IReadOnlyCollection<Connection>`.

## Send to everyone but one

`SendMessageExcept<T0>` sends to every authenticated client except one:

```csharp
CoreManager.ServerManager.SendMessageExcept(Channel.Reliable, new SomeMessage(), excludedConnection);
```

The exclusion matches on `Connection.Id`, so any `Connection` for that player works, including one held from earlier. A null `excludedConnection` excludes nobody.

## Send to a scene's occupants

`SendMessageToScene<T0>` sends to every active connection for which `connection.IsSceneLoaded(sceneHandle)` is true:

```csharp
CoreManager.ServerManager.SendMessageToScene(Channel.Reliable, new SomeMessage(), sceneHandle);
```

## These calls need a started server

On a peer that has not started a server, each of these calls does nothing and logs an error naming the method.

## The client direction

A client only sends to the server it is connected to:

```csharp
if (CoreManager.TransportManager.TryGetServerConnection(out Connection serverConnection))
    serverConnection.SendMessage(Channel.Reliable, new SomeMessage());
```
