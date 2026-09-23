---
title: "TransportManager"
---

> **Using Unity?** See [Transport Manager component](../../unity/transports/transport-manager-component.md).

`TransportManager` is the `CoreManager` member that owns the added `Transport` instances, tracks every `Connection`, and answers role and peer-resolution queries. Reach it through `CoreManager.TransportManager`.

## Adding a transport

`AddTransportAsync<T0>()` constructs a `T0 : Transport` with `Activator.CreateInstance<T0>()`, adds it, and initializes it, returning the new instance:

```csharp
Transport transport = await coreManager.TransportManager.AddTransportAsync<MyTransport>();
```

`TryAddTransportAsync(Transport transport)` adds and initializes a transport instance you built yourself, returning `false` instead of adding it again if the same reference is already in `Transports`:

```csharp
MyTransport transport = new(customConfig);
bool added = await coreManager.TransportManager.TryAddTransportAsync(transport);
```

Prefer `AddTransportAsync<T0>()` when a default-constructed transport is enough. Reach for `TryAddTransportAsync` only when the transport needs constructor arguments or other setup before it is added.

## Removing a transport

`TryRemoveTransport(Transport transport)` removes and shuts down one transport reference, returning `false` if it was not found. `RemoveTransports<T0>()` removes and shuts down every added transport of type `T0`, returning the removed instances as a `List<Transport>`.

`Transports` is the read-only view (`IReadOnlyList<Transport>`) of everything currently added.

## Role queries

- `IsServerStarted` — `true` when this peer's local server connection is `LocalConnectionState.Connected`.
- `IsClientStarted` — `true` when this peer's local client connection is `LocalConnectionState.Connected` **and** `IsAuthenticated`. A connected-but-unauthenticated client reads `false`.
- `IsHostStarted` — `IsServerStarted && IsClientStarted`.

## Resolving peers

`TryGetConnection(uint id, out Connection connection)` resolves this peer's own `Connection` for an id. It checks the local client connection first (so a host's own client connection resolves the same way a pure client's does), then the roster of `Connections`. It returns `false` for `Connection.UnsetId` and for an id this peer was never told about.

`TryGetConnection(ConnectionHandle connectionHandle, out Connection connection)` resolves a `ConnectionHandle` instead of a bare id, and only succeeds while `connection.Generation` still matches `connectionHandle.Generation`. Ids and pooled `Connection` instances are both recycled, so a bare id can alias a different peer than the one you meant; a handle is what to hold when a peer needs to be remembered longer than its link lasts.

```csharp
if (transportManager.TryGetConnection(storedHandle, out Connection connection))
{
    // connection is still the peer storedHandle was taken from.
}
```

`TryGetServerConnection(out Connection connection)` returns this peer's own server-socket connection, and `TryGetLocalClientConnection(out Connection connection)` returns this peer's own client connection — a pure server has none and returns `false`.

`ActiveConnections` is the read-only collection of every `Connection` currently known to this peer. What it holds depends on who is asking: on the server it is the connected remote clients; on a client it is peer stand-ins the server reported (never the local client itself, which `TryGetLocalClientConnection` answers for).

## Channel and transmission unit

`DefaultChannel` is the `Channel` (`Channel.Unreliable` by default) the framework prefers when nothing more specific is asked for.

`GetMaximumTransmissionUnit(Transport transport)` returns how many bytes of that transport's configured transmission unit the engine may fill. It reports the transport's own configured unit less whatever a configured packet transform reserves, so code that packs against a transport's budget always asks here rather than reading the transport's configuration directly.

## HostLoopbackDelivery

`HostLoopbackDelivery` governs when a host's server half delivers a message or call it addressed to its own client half (and vice versa), instead of that copy making a real round trip. It is only ever `HostLoopbackDelivery.Immediate` from game code — handlers run at the send site, before the send call returns. Setting it to anything else is refused, and logged, rather than silently ignored. `HostLoopbackDelivery.Deferred` exists so the engine's own tests can measure the alternative; it is not reachable from game code.

## The transport-implementer side

A few members exist for a `Transport` implementation to drive the manager, not for game code to call directly: `RentInitializedConnection`, `ChangeLocalConnectionState`, `SetRemoteConnectionStateAsConnected`, and `SetRemoteConnectionStateAsDisconnected`. These are covered on the Transport contract page.
