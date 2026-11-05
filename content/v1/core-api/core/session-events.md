---
title: "Session events"
---

> **Using Unity?** See [Reacting to session events in Unity](../../unity/core/unity-session-events.md).

## Each event allows some work and asks you to defer the rest

| Event | Safe here | Defer instead |
|---|---|---|
| `ServerManager.ClientAuthenticated` | Read `Connection.Identity`; do per-connection setup. | Anything that assumes the connection already observes something; that may not be true until a round trip later. |
| `ServerManager.ClientDisconnecting` | Look up what this connection controlled or owned; nothing has been released yet. | Anything that needs its controlled systems already gone; they are released right after this returns. |
| `ClientManager.LocalClientAuthenticated` | Read this peer's own `Connection.Id` for the first time. | Assuming the roster of other peers has arrived; it arrives separately. |
| `TransportManager.PeerConnectionDiscovered` | Store a reference to the peer's `Connection`. | |
| `TransportManager.PeerConnectionDropped` | Drop every stored reference to the peer's `Connection`. | Holding it past this handler. |

## ClientAuthenticated fires when the server admits a client

```csharp
public event ClientAuthenticatedHandler? ClientAuthenticated;
public delegate void ClientAuthenticatedHandler(Connection connection);
```

Raised on the server from inside `ApproveClient`. The connection is already marked authenticated and its `Connection.Identity` is stamped, so a handler can read both.

- The client has not been told it was accepted yet, so nothing sent from here reaches it ahead of its own identity.
- Other clients have not been told about this connection yet.
- Per-player setup done here is tick-aligned with the roster: the roster add this connection is owed and the one announcing it to everyone else go out on the same tick.
- Interest may not have registered the connection as an observer yet. A connection whose `Connection.CanReceiveState` is already true, typically a host's own client, is registered at once. A fresh remote client is registered about one round trip later, once its round-trip time is known.

## ClientDisconnecting fires while a dropped client's objects are still readable

```csharp
public event ClientDisconnectingHandler? ClientDisconnecting;
public delegate void ClientDisconnectingHandler(Connection connection);
```

Raised on the server for a client that has dropped. Inside the handler you can still look up which systems the connection controlled; once it returns, they are released. Use this event rather than a lower-level transport disconnect event, whose handler order is not guaranteed.

## LocalClientAuthenticated tells a peer who it is

```csharp
public event LocalClientAuthenticatedHandler? LocalClientAuthenticated;
public delegate void LocalClientAuthenticatedHandler(Connection localClientConnection);
```

The local client connection's `Connection.Id` is `Connection.UnsetId` from socket connect until this fires. It is raised when the server's authentication response arrives, after the `Id` is set to the server-assigned value and the connection is marked authenticated. A host's own client half raises it the same way, so handlers need no special case for a host.

## PeerConnectionDiscovered and PeerConnectionDropped describe other peers

```csharp
public event PeerConnectionChangedHandler? PeerConnectionDiscovered;
public event PeerConnectionChangedHandler? PeerConnectionDropped;
public delegate void PeerConnectionChangedHandler(Connection connection);
```

These never fire for this peer's own session.

- On a client, `PeerConnectionDiscovered` fires when the server reports a new peer. The `Connection` is a stand-in, an identity with no live link behind it (`Connection.IsPeerStandIn` is true).
- On a host, it fires once `ApproveClient` admits the peer. The `Connection` is the server's own entry for that peer, so `IsPeerStandIn` is false. It never fires for the host's own client.

`PeerConnectionDropped` mirrors it: on a client when the server reports the peer gone, on a host when the peer leaves, in both cases while the entry is still held. Drop every reference to the `Connection` inside this handler.

## A host raises server and client events in one call

- For the host's own client, `ClientAuthenticated` fires and then `LocalClientAuthenticated`, inside the same `ApproveClient` call rather than a round trip later.
- For a remote peer joining a host, `ClientAuthenticated` and then `PeerConnectionDiscovered` fire for that peer out of the same `ApproveClient` call.
- On departure, `ClientDisconnecting` fires before the connection's controlled systems are released, and `PeerConnectionDropped` fires for the same departure, never for the host's own client.
