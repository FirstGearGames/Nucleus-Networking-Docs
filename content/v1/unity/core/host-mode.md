---
title: "Host mode"
---

## What a host is

A host is one process running both roles at once: it starts a server and connects its own client to that server. `TransportManager.IsServerStarted` and `TransportManager.IsClientStarted` are both true, and `IsHostStarted` is defined as `IsServerStarted && IsClientStarted`. Nothing else distinguishes host mode from a pure server or a pure client: the same `CoreManager`, the same transport, both halves live in one process.

## Two Connections, one player

A host's own client is described by more than one `Connection` at once. The server side holds a roster entry for that client, the same as it holds one for every other connected player, while the client side holds its own local `Connection` for itself. On a transport that mints its roster entry fresh (Synapse does, under either pairing), these are two distinct objects describing the same peer.

Comparing them by reference fails even though they name the same player:

```csharp
// Wrong: these are two different Connection instances for the same peer.
bool isSelf = someRosterConnection == localClientConnection;
```

Compare `Connection.Id` instead, which is the same value on both:

```csharp
bool isSelf = someRosterConnection.Id == localClientConnection.Id;
```

Or resolve each side explicitly through the `TransportManager` rather than holding a reference across the two halves:

```csharp
transportManager.TryGetLocalClientConnection(out Connection localClient);
transportManager.TryGetServerConnection(out Connection localServer);
```

`TryGetLocalClientConnection` returns this peer's own client `Connection`; it is false on a pure server. `TryGetServerConnection` returns this peer's own server `Connection`; a controlling client uses it to find the upstream observer target. Both resolve to the owner-held instance for that side rather than scanning transports.

## IsHostLoopback

Both halves of the pairing above, plus the server's roster entry for its own client, are marked `Connection.IsHostLoopback`. The mark identifies a link whose two ends are the same process. It is neither `IsEmulated` (no socket at all) nor `IsPeerStandIn` (a peer this client cannot reach directly) — it names a real, live link where both ends happen to be this peer.

State addressed across a loopback link is discarded on arrival rather than applied: whatever was sent was written by the process it would be delivered to, so there is nothing to learn from serializing it and reading it back. Neither half owes the other an acknowledgment either; the sending half settles its own outstanding ticks as it serializes them.

A `Transport` answers the same question at the socket level, before a `Connection` can be marked at all, through the abstract `Transport.IsOwnClientConnection(Connection serverSideClientConnection)`. It exists because a `Connection` itself carries no endpoint or handshake to prove the two ends are the same process — only the transport underneath it knows what it's holding. A transport that cannot tell must answer false rather than guess: a false answer costs a host the in-process delivery of its own traffic, but a wrong true answer would hand a stranger connecting over loopback this peer's own server half.

## HostLoopbackDelivery

`TransportManager.HostLoopbackDelivery` controls when a host's two halves see what one of them addressed to the other. It is settable only to `HostLoopbackDelivery.Immediate`; setting anything else is refused with a `LogError` rather than silently ignored:

```csharp
// Refused: logs an error and leaves HostLoopbackDelivery at Immediate.
transportManager.HostLoopbackDelivery = HostLoopbackDelivery.Deferred;
```

`Immediate` (the default, and the only value a game may set) runs the receiving half's handlers at the send site, before the send call returns — the same shape every other callback in the engine already uses. `Deferred` would run those handlers a tick later, at the loop step a genuinely remote copy lands on; it exists only so the engine's own tests can measure that alternative, reached through an internal setter game code cannot call.

A message delivered this way is never serialized. Under `Immediate` its handler runs synchronously at the send site, with nothing queued. `Deferred` queues it instead, and the queue is run at `NetworkLoopSteps.EarlyVariableUpdate`, the same step a wire copy would be read on.

## Callbacks a host raises for itself

`TransportManager.PeerConnectionDiscovered` and `PeerConnectionDropped` normally hand a client a stand-in Connection (`Connection.IsPeerStandIn` true) for a peer it was told about. On a host these events instead name the server's own live roster entry for a joining or leaving peer — `IsPeerStandIn` reads false, because the Connection carries a real link rather than a bare identity. A host is told through `RaiseHostPeerConnectionDiscovered` / `RaiseHostPeerConnectionDropped` rather than through the roster, because the roster message it writes to its own client is the one discarded on its own loopback.

Neither event is ever raised for the host's own client. No client is told about itself.

## The self-delivery hazard

Never pair an addressed send (`RpcTarget.To(connection)`) with immediate self delivery (`RpcSelfDelivery.Immediate`) on a surface the host's own client also listens on. On a host, the process running the server is the same process running that client, so a handler registered for the surface runs once for the send and once more for the host's own copy — the host ends up running every player's copy of a call meant for one. See the RPC page for the detail on `RpcSelfDelivery` and `RpcTarget`.

## Starting a host

In Unity, set `UnityTransportManager`'s automatic start mode to `NetworkStartMode.Host` in the inspector, or call `StartHostAsync()` directly:

```csharp
await unityTransportManager.StartHostAsync();
```

`StartHostAsync` connects every added transport as both a server and a client, in that order.

From plain C#, connect both invokers on the transport:

```csharp
await transport.ConnectAsync(Invoker.Server);
await transport.ConnectAsync(Invoker.Client);
```
