---
title: "Connections"
---

A `Connection` represents one peer: a client from the server's point of view, or the server from a client's. It is pooled (`Connection : IPoolResettable`): rented when a peer arrives and returned when it leaves.

Do not store a `Connection` or its `Id` past the moment you read them. The next peer to connect can be handed the same object, and `Id` values are recycled too. To remember a peer for longer, hold a [`ConnectionHandle`](#hold-a-connectionhandle-to-remember-a-peer).

## Read a connection's identity and role

| Member | Meaning |
|---|---|
| `Id` | The connection's unique Id across all transports. `UnsetId` (`0`) means no Id is assigned. |
| `IsIdUnset` | `true` when `Id == UnsetId`. |
| `IdBySocket` | The Id assigned by the socket-level Transport. Unique within that transport, not across transports. Server sockets always read `ServerIdBySocket`. |
| `ServerIdBySocket` | Constant (`uint.MaxValue`) used for `IdBySocket` when the connection is a server socket. |
| `IsServer` | `true` when `IdBySocket == ServerIdBySocket`. |
| `IsClient` | `!IsServer`. |
| `IsConnected` | `true` when `LocalState == LocalConnectionState.Connected`. |
| `IsAuthenticated` | `true` when this side is a client that has authenticated, or when `IsServer`, or when `IsEmulated`. |
| `IsEmulated` | `true` for a connection that uses no socket, such as a fake or test peer. |
| `IsPeerStandIn` | `true` when this Connection names a peer the server told a client about, rather than a link this peer holds. A stand-in carries identity only; there is no socket behind it. |
| `IsHostLoopback` | `true` when this Connection is one half of a host's own loopback pair (the same peer at both ends). |

## Hold a ConnectionHandle to remember a peer

`ConnectionHandle` pairs the `Id` with a `Generation`, a counter bumped every time the instance is rented:

```csharp
public readonly struct ConnectionHandle : IEquatable<ConnectionHandle>
{
    public readonly uint Id;
    public readonly uint Generation;

    public bool IsValid => Id != Connection.UnsetId;
}
```

Take it from `Connection.Handle` and resolve it later with `TransportManager.TryGetConnection`:

```csharp
ConnectionHandle handle = connection.Handle;

// ... later, possibly after the peer disconnected and another peer connected ...

if (transportManager.TryGetConnection(handle, out Connection resolved))
{
    // resolved is still the same peer the handle was taken from.
}
```

If the connection was recycled or its Id reissued, resolution fails rather than naming whoever arrived next. A handle is a plain value type that allocates nothing, and it is local to the peer that took it.

## Key players on Identity, not RemoteAddress

- `RemoteAddress` is where the connection came from, as the Transport reports it, without the port, so a reconnecting peer keeps the same value. It is `null` when the transport has no such notion, such as emulated or in-memory connections. The server observes it, so it cannot be forged, but several clients behind one NAT share an address. It identifies a location, not a player.
- `Identity` names a client across reconnects. The client authenticator stamps it when it approves the client; it is `null` until then, and stays `null` if the authenticator supplies none. Key anything that must recognize a returning player on `Identity`.

## Find connections through the TransportManager

- `ActiveConnections`: the connections this peer knows. On the server, the remote clients. On a client, the peer stand-ins the server has reported, never the local client itself.
- `TryGetConnection(uint id, out Connection connection)`: this peer's own Connection for an Id.
- `TryGetConnection(ConnectionHandle handle, out Connection connection)`: resolves a handle, failing if the generation is stale.
- `TryGetLocalClientConnection(out Connection connection)`: this peer's own connection as a client.
- `TryGetServerConnection(out Connection connection)`: this peer's own server socket connection.

## Read and react to connection state

Each `Connection` tracks two states:

- `LocalState` (`LocalConnectionState`): the connection this device created, your own client or the server socket when hosting.
- `RemoteState` (`RemoteConnectionState`): the connection as seen from the remote side. It has only `Disconnected` and `Connected`.

```csharp
public enum LocalConnectionState : byte
{
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
    Disconnecting = 3,
    Error = 4,
    TimedOut = 5,
}
```

`Disconnected` is the zero value, so an unwritten state reads as down.

`ConnectionStateExtensions` adds two helpers on `LocalConnectionState`:

```csharp
public static bool IsConnectedOrDisconnected(this LocalConnectionState localConnectionState);
public static bool IsAnyDisconnected(this LocalConnectionState localConnectionState);
```

`IsConnectedOrDisconnected` is true only for `Connected` or `Disconnected`. `IsAnyDisconnected` is true for `Disconnecting`, `Disconnected`, `Error` and `TimedOut`.

`TransportManager` raises an event for each kind of change:

```csharp
public event ConnectionStateChangedHandler ConnectionLocalStateChanged;
public event ConnectionStateChangedHandler ConnectionRemoteStateChanged;

public delegate void ConnectionStateChangedHandler(ConnectionStateChange connectionStateChange);

public readonly struct ConnectionStateChange
{
    public readonly Invoker Invoker;
    public readonly Connection Connection;
    public readonly bool IsRemoteStateChange;
}
```

`Invoker` says which side raised it, `Connection` is the connection that changed, and `IsRemoteStateChange` says whether `RemoteState` or `LocalState` changed.

## Log a connection with AsString

```csharp
public static string AsString(this Connection? connection);
```

`ConnectionExtensions.AsString` reports the connection's `LocalState`, `Id`, `IdBySocket`, transport Id, `IsServer` and `IsAuthenticated`, and is safe to call on `null`.

For round-trip time and packet loss, see [Round-trip time, jitter and packet loss](../diagnostics/link-quality-measurement.md).
