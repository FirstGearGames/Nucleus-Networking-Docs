---
title: "Host mode"
---

> **Driving the core API directly?** See [Host mode](../../core-api/core/host-mode.md).

A host is one process that runs a server and its own client together. On a host, `TransportManager.IsServerStarted` and `IsClientStarted` are both true, and so is `IsHostStarted`.

## Start a host

Set **Automatic Start Mode** on `UnityTransportManager` to `Host`, or call `StartHostAsync()`, which starts every transport as a server and then as a client:

```csharp
await unityTransportManager.StartHostAsync();
```

## Compare players by Connection.Id

The host's own client has one `Connection`, and the server's roster entry for that client is the same object. A call that names the host's player by its local `Connection`, such as `RpcTarget.To` or `RpcTarget.ObserversExcept`, therefore matches the roster entry.

Still compare players by `Connection.Id`, never by reference. A `Connection` is reused once its link ends, so a kept reference can end up naming a different player.

```csharp
bool isSelf = someConnection.Id == localClientConnection.Id;
```

To get either side's own `Connection`, ask the `TransportManager`:

```csharp
transportManager.TryGetLocalClientConnection(out Connection localClient);
transportManager.TryGetServerConnection(out Connection localServer);
```

`TryGetLocalClientConnection` returns false on a pure server. A controlling client uses `TryGetServerConnection` to find the upstream observer target.

Both ends of the host's own link report `Connection.IsHostLoopback` as true. It is a real, live link, so `IsEmulated` and `IsPeerStandIn` are false on it.

## Leave HostLoopbackDelivery at Immediate

`TransportManager.HostLoopbackDelivery` controls when one half of a host sees what the other half addressed to it. `HostLoopbackDelivery.Immediate`, the default, runs the receiving handler at the send site, before the send call returns. It is the only value you can set: any other value logs an error and is ignored.

## Peer events name live connections on a host

On a client, `TransportManager.PeerConnectionDiscovered` and `PeerConnectionDropped` hand over a stand-in `Connection` (`IsPeerStandIn` true). On a host they name the server's live roster entry for the peer, so `IsPeerStandIn` is false. Neither event is raised for the host's own client.

## Never combine RpcTarget.To with immediate self delivery

Do not pair an addressed send (`RpcTarget.To(connection)`) with `RpcSelfDelivery.Immediate` on a surface the host's own client also listens on. The host runs the handler once for the send and once more for its own copy, so it runs every player's copy of a call meant for one. See [Sending a remote call from a component](../messaging/remote-calls-from-a-component.md).
