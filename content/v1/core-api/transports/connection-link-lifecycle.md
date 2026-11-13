---
title: "Link states and connection events"
---

## Invoker names which role acted

A host runs a server and a client in one process. Every state-change event and connect or disconnect result carries an `Invoker` saying which half it is about:

```csharp
public enum Invoker : byte
{
    Client = 0,
    Server = 1,
}
```

## Read a connection's local and remote state

`Connection.LocalState` is a `LocalConnectionState`, the state of a socket this peer owns: its own client connection, or on a server one of its client sockets.

```csharp
public enum LocalConnectionState : byte
{
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
    Disconnecting = 3,
}
```

A `Connection` nothing has touched reads `Disconnected`. A failed connect and a later drop both end at `Disconnected`.

`Connection.RemoteState` is a `RemoteConnectionState`, what this peer believes about the other side:

```csharp
public enum RemoteConnectionState : byte
{
    Disconnected,
    Connected,
}
```

`ConnectionStateExtensions` adds two checks on `LocalConnectionState`:

```csharp
public static bool IsConnectedOrDisconnected(this LocalConnectionState localConnectionState);
public static bool IsAnyDisconnected(this LocalConnectionState localConnectionState);
```

- `IsConnectedOrDisconnected`: true only for `Connected` or `Disconnected`, the two resting states.
- `IsAnyDisconnected`: true for anything but `Connecting` and `Connected`.

## Subscribe to state changes

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
    public readonly bool IsLocallyRequested;
    public readonly string? DisconnectReason;
}
```

- `ConnectionLocalStateChanged` fires when `Connection.LocalState` changes.
- `ConnectionRemoteStateChanged` fires when `Connection.RemoteState` changes. On a server, this tells you a client arrived or left.
- `IsRemoteStateChange` tells a shared handler which event it is handling.
- `IsLocallyRequested` is true when this peer asked for its own link to go down.
- `DisconnectReason` says why a link went down, in the transport's words, such as `"The connection timed out."`. It is `null` when the transport gave no reason or the change is not a disconnect. Show it to players or write it to a log, but do not branch on its wording.

**A local `Connected` does not mean the server accepted you.** A `Synapse` client reaches `Connected` once it has sent its handshake, before the server answers. To know your client has joined, use `ClientManager.LocalClientAuthenticated`, which fires once the server accepts it and assigns its `Id`, or read `TransportManager.IsClientStarted`.

## Check connect and disconnect results

These `Transport` calls return a result instead of throwing:

```csharp
public abstract Task<ConnectionStateChangeResult> ConnectAsync(Invoker invoker);
public abstract Task<ConnectionStateChangeResult> DisconnectLocalConnectionAsync(Invoker invoker);
public abstract Task<ConnectionStateChangeResult> DisconnectRemoteClientAsync(Connection connection);
```

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

`AlreadyInState`, `InvalidConnection` and `InvalidSocketState` mean the call was redundant or the link was already gone. Log `UnspecifiedError`.

## Track peers with PeerConnectionDiscovered and PeerConnectionDropped

```csharp
public event PeerConnectionChangedHandler? PeerConnectionDiscovered;
public event PeerConnectionChangedHandler? PeerConnectionDropped;

public delegate void PeerConnectionChangedHandler(Connection connection);
```

These `TransportManager` events report peers the same way on a server, client or host. On a client, the `Connection` is a stand-in with no link behind it (`Connection.IsPeerStandIn`). `PeerConnectionDropped` fires while the `Connection` is still valid; clear anything that references it, and keep no reference after the handler returns.

## Keep a Connection only while its peer is connected

`Connection` objects are reused for later peers. Keep one while its peer is connected and remove it from your collections in its disconnect event, as [Connections](../core/connections.md#remove-a-connection-from-your-collections-when-its-peer-leaves) describes. To recognize a player who reconnects, key on `Connection.Identity`.
