---
title: "Host mode"
---

> **Using Unity?** See [Host mode](../../unity/core/host-mode.md).

A host is one process that starts a server and connects its own client to it. `TransportManager.IsServerStarted` and `IsClientStarted` are both true, and `IsHostStarted` is `IsServerStarted && IsClientStarted`. It uses the same `CoreManager` and transport as any other peer.

## Start a host by connecting both invokers

```csharp
await transport.ConnectAsync(Invoker.Server);
await transport.ConnectAsync(Invoker.Client);
```

## A host holds one Connection for its own player

The server's roster entry for the host's own client is the client side's local `Connection` itself. So a call that names the host's own player by its local `Connection`, such as `RpcTarget.To` or `RpcTarget.ObserversExcept`, matches the roster entry the server holds.

Still compare players by `Connection.Id`, because a `Connection` is pooled and reused once its link ends:

```csharp
bool isSelf = someConnection.Id == localClientConnection.Id;
```

Or resolve each side through the `TransportManager` rather than holding a reference across the two halves:

```csharp
transportManager.TryGetLocalClientConnection(out Connection localClient);
transportManager.TryGetServerConnection(out Connection localServer);
```

- `TryGetLocalClientConnection` returns this peer's own client `Connection`. It is false on a pure server.
- `TryGetServerConnection` returns this peer's own server `Connection`. A controlling client uses it to find the upstream observer target.

## Both halves of the host's own link are marked IsHostLoopback

`Connection.IsHostLoopback` marks a real, live link whose two ends are this same process. It is neither `IsEmulated` (no socket at all) nor `IsPeerStandIn` (a peer this client cannot reach directly). State sent across a loopback link is discarded on arrival, because the receiving process wrote it.

A custom `Transport` must implement `Transport.IsOwnClientConnection(Connection serverSideClientConnection)`, which answers whether a server-side client connection is this process's own client. A transport that cannot tell must answer false. A false answer only costs the host in-process delivery of its own traffic, but a wrong true answer would hand a stranger connecting over loopback this peer's own server half.

## Loopback delivery is always Immediate

`TransportManager.HostLoopbackDelivery` controls when one half of a host sees what it addressed to the other. The only value a game may set is `HostLoopbackDelivery.Immediate`, the default: the receiving half's handlers run at the send site, before the send call returns, and the message is never serialized. Setting anything else logs an error and leaves it at `Immediate`:

```csharp
// Refused: logs an error and leaves HostLoopbackDelivery at Immediate.
transportManager.HostLoopbackDelivery = HostLoopbackDelivery.Deferred;
```

## Peer events name real connections on a host

On a client, `TransportManager.PeerConnectionDiscovered` and `PeerConnectionDropped` hand over a stand-in `Connection` (`IsPeerStandIn` true) for a peer the server reported. On a host they name the server's own live roster entry for the joining or leaving peer, so `IsPeerStandIn` is false. A host raises them itself as a peer joins or leaves. Neither is ever raised for the host's own client.

## Never pair RpcTarget.To with Immediate self delivery on a host

Do not pair an addressed send (`RpcTarget.To(connection)`) with immediate self delivery (`RpcSelfDelivery.Immediate`) on a surface the host's own client also listens on. The host's handler runs once for the send and once more for the host's own copy, so the host runs every player's copy of a call meant for one. See [RpcSelfDelivery](../messaging/rpc-self-delivery.md).
