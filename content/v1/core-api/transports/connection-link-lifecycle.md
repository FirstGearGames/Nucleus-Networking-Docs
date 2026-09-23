---
title: "Link states and connection events"
---

## Invoker: which role acted

Most connection operations happen for a specific role, and one process can run both roles at once on a host. `Invoker` names which one:

```csharp
public enum Invoker : byte
{
    Client = 0,
    Server = 1,
}
```

Every state-change event and every connect/disconnect result carries an `Invoker` so a handler on a host build can tell which half of the process the change is about.

## LocalConnectionState and RemoteConnectionState

`LocalConnectionState` describes a socket this peer owns - its own client connection, or (on a server) one of its client sockets:

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

`Disconnected` is the zero value, so a `Connection` nothing has touched yet reads as down rather than as some other state. The values are not written to the wire and nothing orders them numerically; the walk from `Disconnecting` to `Disconnected` doesn't mean less than `Connecting` to `Connected`, it just names the state passed through.

The shipped transports never set `Error` or `TimedOut`. A connect that fails and a link that drops later both end at `Disconnected`.

`RemoteConnectionState` describes what this peer believes about the other side of a link, and only has two values:

```csharp
public enum RemoteConnectionState : byte
{
    Disconnected,
    Connected,
}
```

A `Connection`'s current values are read from its `LocalState` and `RemoteState` properties.

## The state-change events

`TransportManager` raises two events, both carrying a `ConnectionStateChange`:

```csharp
public event ConnectionStateChangedHandler? ConnectionLocalStateChanged;
public event ConnectionStateChangedHandler? ConnectionRemoteStateChanged;

public delegate void ConnectionStateChangedHandler(ConnectionStateChange connectionStateChange);
```

```csharp
public readonly struct ConnectionStateChange
{
    public readonly Invoker Invoker;
    public readonly Connection Connection;
    public readonly bool IsRemoteStateChange;
}
```

`ConnectionLocalStateChanged` fires when a `Connection.LocalState` changes - a socket this peer owns starting, connecting, or dropping. Check `Invoker.Client` alongside `LocalConnectionState.Connected` to see your own client socket come up, but that is not the same as the server accepting it: a `Synapse` client reaches `Connected` as soon as it has sent its handshake, before the server has answered. To know your own client has actually joined, use `ClientManager.LocalClientAuthenticated`, which fires once the server has accepted it and assigned its `Id`, or read `TransportManager.IsClientStarted`, which is only true once the client is both connected and authenticated.

`ConnectionRemoteStateChanged` fires when a `Connection.RemoteState` changes - this peer's belief about the far side of a link. On a server this is the event that answers "did a client arrive or leave". `ConnectionStateChange.IsRemoteStateChange` tells a shared handler which of the two events it's looking at without needing separate methods for each.

## ConnectionStateChangeResult

Every connect and disconnect call returns one of these instead of throwing:

```csharp
public enum ConnectionStateChangeResult : byte
{
    Success,
    AlreadyInState,
    InvalidConnection,
    InvalidSocketState,
    UnspecifiedError,
}
```

`Transport` exposes the calls that return it:

```csharp
public abstract Task<ConnectionStateChangeResult> ConnectAsync(Invoker invoker);
public abstract Task<ConnectionStateChangeResult> DisconnectLocalConnectionAsync(Invoker invoker);
public abstract Task<ConnectionStateChangeResult> DisconnectRemoteClientAsync(Connection connection);
```

`AlreadyInState` and `InvalidConnection`/`InvalidSocketState` are not failures worth alarming over - they mean the call was redundant or arrived after the link was already gone. Treat `UnspecifiedError` as the one worth logging.

## PeerConnectionDiscovered and PeerConnectionDropped

`TransportManager` also raises two peer-naming events, deliberately separate from the state-change events:

```csharp
public event PeerConnectionChangedHandler? PeerConnectionDiscovered;
public event PeerConnectionChangedHandler? PeerConnectionDropped;

public delegate void PeerConnectionChangedHandler(Connection connection);
```

`ConnectionRemoteStateChanged` is subscribed by the observer and interest managers with no server gate, so raising it for every peer arrival would have a client walk its whole system set removing an observer and an interest entry that were never there. `PeerConnectionDiscovered`/`PeerConnectionDropped` exist for game code that wants to know about peers specifically, including on a host: a client is told about a peer by the server reporting it, and the `Connection` handed over is a stand-in - an identity with no link behind it (`Connection.IsPeerStandIn`). A host is told through the same events rather than through its own roster copy, so code watching this seam hears about peers the same way whichever kind of peer it runs on. `PeerConnectionDropped` fires while the entry is still held, so a handler gets one last chance to clear anything referencing it before the `Connection` returns to its pool.

## Reading a link without holding it

Holding a `Connection` reference across time is unsafe: connections are pooled, and an entry returned to the pool is handed to the next peer that arrives. Read `LocalState`, `RemoteState`, and `Transport` while you have a live reference, but don't keep the reference itself around.

To remember a peer for longer than its link lasts, take its `ConnectionHandle` (`Connection.Handle`) instead of the `Connection`. A handle pairs the connection's `Id` with a `Generation`, so a handle taken from an earlier occupant of a recycled `Id` fails to resolve rather than silently naming whoever replaced it:

```csharp
public bool TryGetConnection(ConnectionHandle connectionHandle, out Connection connection)
```

Resolve it fresh each time you need it - don't cache the `Connection` the resolve returns either.

`LocalConnectionStateExtensions` (declared as `ConnectionStateExtensions`) adds two checks on `LocalConnectionState`:

```csharp
public static bool IsConnectedOrDisconnected(this LocalConnectionState localConnectionState);
public static bool IsAnyDisconnected(this LocalConnectionState localConnectionState);
```

`IsConnectedOrDisconnected` is true only for `Connected` or `Disconnected` - the two resting states. `IsAnyDisconnected` is true for anything but `Connecting` and `Connected`, which covers `Disconnecting`, `Disconnected`, `Error`, and `TimedOut` in one check.
