---
title: "TransportManager"
---

> **Using Unity?** See [Transport Manager component](../../unity/transports/transport-manager-component.md).

`CoreManager.TransportManager` owns the added `Transport` instances, tracks every `Connection`, and answers role and peer queries.

## Add a transport

`AddTransportAsync<T0>()` creates a `T0 : Transport` with its parameterless constructor, adds and initializes it, and returns it:

```csharp
Transport transport = await coreManager.TransportManager.AddTransportAsync<MyTransport>();
```

When the transport needs constructor arguments or other setup, build it yourself and pass it to `TryAddTransportAsync(Transport transport)`. It returns `false`, without adding it again, if that reference is already in `Transports`:

```csharp
MyTransport transport = new(customConfig);
bool added = await coreManager.TransportManager.TryAddTransportAsync(transport);
```

## Remove a transport

- `TryRemoveTransport(Transport transport)` removes and shuts down one transport, returning `false` if it was not found.
- `RemoveTransports<T0>()` removes and shuts down every transport of type `T0`, returning them as a `List<Transport>`.

`Transports` (`IReadOnlyList<Transport>`) lists everything currently added.

## Check the local role

- `IsServerStarted`: this peer's local server connection is `LocalConnectionState.Connected`.
- `IsClientStarted`: this peer's local client connection is `LocalConnectionState.Connected` **and** `IsAuthenticated`. A connected but unauthenticated client reads `false`.
- `IsHostStarted`: `IsServerStarted && IsClientStarted`.

## Find a connection

- `TryGetConnection(uint id, out Connection connection)` finds a connection by id, including a host's own client connection. Returns `false` for `Connection.UnsetId` and for an id this peer was never told about.
- `TryGetServerConnection(out Connection connection)` returns this peer's server connection.
- `TryGetLocalClientConnection(out Connection connection)` returns this peer's client connection; a pure server has none and returns `false`.
- `ActiveConnections` holds every `Connection` this peer knows. On the server, these are the connected remote clients. On a client, they are stand-ins for peers the server reported, never the local client itself.

Ids and `Connection` instances are reused, so an id kept after its peer left can later name a different peer. See [Connections](../core/connections.md#remove-a-connection-from-your-collections-when-its-peer-leaves) for when to let go of one.

## Read the channel and transmission unit

- `DefaultChannel` is the `Channel` used when nothing more specific is asked for. Default `Channel.Unreliable`.
- `GetMaximumTransmissionUnit(Transport transport)` returns how many bytes of that transport's transmission unit the engine may fill, after any [packet transform](./packet-transforms.md) reservation. Ask here rather than reading the transport's configuration.

## Leave HostLoopbackDelivery at Immediate

`HostLoopbackDelivery` controls how a host delivers a message or call its server half sends to its own client half, or the reverse. From game code it can only be `HostLoopbackDelivery.Immediate`: handlers run before the send call returns. Setting anything else is refused and logged.

`RentInitializedConnection`, `ChangeLocalConnectionState`, `SetRemoteConnectionStateAsConnected` and `SetRemoteConnectionStateAsDisconnected` are for transport implementations; see [The Transport contract](./transport-contract.md).
