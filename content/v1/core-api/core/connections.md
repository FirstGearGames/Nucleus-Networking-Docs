---
title: "Connections"
---

## What a Connection is

A `Connection` represents one peer: a client from the server's point of view, or the server from a client's point of view. It is a pooled object (`Connection : IPoolResettable`), rented when a peer arrives and returned when it leaves.

Because instances are pooled, a `Connection` reference is only valid for the instant you have it. Do not store the instance itself, and do not store its `Id` past the moment you read it. The next peer to connect can be handed the very same object, and `Id` values are recycled the same way. If you need to remember a peer for longer than that, hold a `ConnectionHandle` instead (see below).

## Identity and role

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
| `IsPeerStandIn` | `true` when this Connection names a peer the server told a client about, rather than a link this peer itself holds. A stand-in carries identity only; there is no socket behind it. |
| `IsHostLoopback` | `true` when this Connection is one half of a host's own loopback pair (the same peer at both ends). |

## ConnectionHandle

`Connection.Id` alone is not safe to hold: identifiers are recycled just like the pooled instances are. `ConnectionHandle` fixes that by pairing the `Id` with a `Generation`, a counter bumped every time the underlying instance is rented.

```csharp
public readonly struct ConnectionHandle : IEquatable<ConnectionHandle>
{
    public readonly uint Id;
    public readonly uint Generation;

    public bool IsValid => Id != Connection.UnsetId;
}
```

Get a peer's handle from `Connection.Handle`, and resolve it later through `TransportManager.TryGetConnection`:

```csharp
ConnectionHandle handle = connection.Handle;

// ... later, possibly after the peer disconnected and another peer connected ...

if (transportManager.TryGetConnection(handle, out Connection resolved))
{
    // resolved is still the same peer the handle was taken from.
}
```

If the original connection has been recycled, or its Id reissued to a different peer, the generation no longer matches and resolution fails rather than silently naming whoever arrived next. `ConnectionHandle` is a plain value type: it allocates nothing, needs no pooling, and is local to the peer that took it (it never goes on the wire).

## RemoteAddress versus Identity

`RemoteAddress` is where the connection connected from, as the Transport reports it (the peer's address for a socket transport; `null` when the transport has no such notion, such as emulated or in-memory connections). The port is deliberately excluded, so a reconnecting peer's value stays stable across the fresh port it arrives on. It is observed by the server rather than asserted by the client, so it cannot be forged — but several clients behind one NAT share an address. `RemoteAddress` identifies a location, not a player.

`Identity` is the value naming a client across reconnects, stamped by the client authenticator when the client is approved. It is `null` until then, and stays `null` if the authenticator supplies none. Anything that needs to recognize the same player across a reconnect should key on `Identity`, not `RemoteAddress`.

## Finding connections

`TransportManager` exposes the active set and several lookups:

- `ActiveConnections` — the connections currently known to this peer. On the server this is the remote clients; on a client it is the peer stand-ins the server has reported (never the local client itself).
- `TryGetConnection(uint id, out Connection connection)` — resolves this peer's own Connection for an Id.
- `TryGetConnection(ConnectionHandle handle, out Connection connection)` — resolves a handle, failing if the generation is stale.
- `TryGetLocalClientConnection(out Connection connection)` — this peer's own connection as a client.
- `TryGetServerConnection(out Connection connection)` — this peer's own server socket connection.

## Reading connection state

Each `Connection` tracks two states:

- `LocalState` — the state of the connection this device created (connecting your own client, or the server socket when hosting). Typed as `LocalConnectionState`.
- `RemoteState` — the state of the connection as seen from the remote side. Typed as `RemoteConnectionState`, a smaller enum with only `Disconnected` and `Connected`.

`LocalConnectionState`:

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

`Disconnected` is the zero value, so an unwritten state reads as down. The values are never written to the wire.

`ConnectionStateExtensions` (in `LocalConnectionStateExtensions.cs`) adds two helpers, both on `LocalConnectionState`:

```csharp
public static bool IsConnectedOrDisconnected(this LocalConnectionState localConnectionState);
public static bool IsAnyDisconnected(this LocalConnectionState localConnectionState);
```

`IsConnectedOrDisconnected` is true only for `Connected` or `Disconnected`. `IsAnyDisconnected` is true for anything except `Connecting` or `Connected` — this covers `Disconnecting`, `Disconnected`, `Error`, and `TimedOut`.

`TransportManager` raises an event for each kind of state change:

```csharp
public event ConnectionStateChangedHandler ConnectionLocalStateChanged;
public event ConnectionStateChangedHandler ConnectionRemoteStateChanged;

public delegate void ConnectionStateChangedHandler(ConnectionStateChange connectionStateChange);
```

Each carries a `ConnectionStateChange`:

```csharp
public readonly struct ConnectionStateChange
{
    public readonly Invoker Invoker;
    public readonly Connection Connection;
    public readonly bool IsRemoteStateChange;
}
```

`Invoker` says which side raised it, `Connection` is the connection that changed, and `IsRemoteStateChange` tells you whether `RemoteState` or `LocalState` changed.

## Describing a connection

`ConnectionExtensions.AsString` gives a human-readable summary for logging, safe to call on a `null` connection:

```csharp
public static string AsString(this Connection? connection);
```

It reports the connection's `LocalState`, `Id`, `IdBySocket`, transport Id, `IsServer`, and `IsAuthenticated`.

For per-connection round-trip time and packet loss counters, see the diagnostics reference.
