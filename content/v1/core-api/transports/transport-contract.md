---
title: "The Transport contract"
---

`Transport` is the abstract base of every transport, but its constructor is `private protected`, so a transport outside the engine cannot derive from it directly. Derive from `SocketPairTransport<TServerSocket, TClientSocket>` instead. It implements every member `Transport` requires by routing each call to a server socket or a client socket, so you write the two sockets and only what is specific to your transport. Every shipped transport is built this way. See [Yak](./yak-offline-transport.md) for a minimal offline transport and [Synapse](./synapse-transport.md) for a socket-backed one.

## Derive your transport from SocketPairTransport

```csharp
public class MyTransport : SocketPairTransport<MyServerSocket, MyClientSocket> { }
```

- Both sockets are rented and initialized in `InitializeAsync`. Override `OnSocketsInitialized()` to prepare the pair together once both are ready.
- Every other member routes to the socket for the calling `Invoker`. Reach the sockets through `ServerSocket` and `ClientSocket`.
- `Transport.SendPacket` applies the packet transform and counts bytes before it reaches your socket, so send anything the engine built through it, never through the socket directly.

## Write a server socket and a client socket

Derive each socket from `CommonSocket` and give it a public parameterless constructor. Its connect, disconnect, send and receive members are `protected internal`, so declare each override `protected`.

1. Implement `IsServer`, which is `true` on the server socket, and `IsEmulated`, which is `true` only for a socket that makes no remote connection.
2. Override `Initialize(Transport transport)`: call base, then call `InitializeConnection()` to give the socket its own `Connection`.
3. Override `SendPacket(OutgoingPacket outgoingPacket)` to transmit a packet.
4. Override `ReceivePackets(ref List<IncomingPacket> receivedPackets)` to add every packet that arrived since the last call. It is called once per frame while the socket is connected, and for a client socket also while it is connecting.
5. Override `ConnectAsync()` and `DisconnectAsync()`. On the server socket, also override `DisconnectRemoteClientAsync(Connection connection)` and `DisconnectRemoteClientAfterDeliveryAsync(Connection connection)`.

The engine never calls `PollForIncomingPackets()`, so poll inside `ReceivePackets` or from your own method.

## Override the virtuals you need

| Virtual | Default | Override when |
|---|---|---|
| `DatagramOverheadBytes` | `0` | The transport adds its own header to every datagram. Return its size so packets still fit. |
| `OnApplyCommandLineArguments(CommandLineArguments commandLineArguments)` | Applies `PortArgument` to `Configuration.Port`. | The transport has its own endpoint settings. Call base, then read your flags. |
| `IsLocalTransport()` | Logs a warning and returns `false`. | Always. Return `false` for a transport that crosses a network, and `true` only for one that runs locally and offline. Several security checks are disabled while it returns true. |
| `SetPort(ushort port)` | Logs a warning. | The transport has a port to set. |
| `GetMaximumConnectionsCeiling()` | Returns `ServerConfiguration.UnsetMaximumConnections` (`0`): no maximum of its own. | The transport cannot hold more than a fixed number of connections. Return that number, so `SetMaximumConnections` can only lower the cap below it. |

## Call back into the manager

A socket reports state through these `TransportManager` calls:

- `RentInitializedConnection(CommonSocket commonSocket)`: rents and initializes a `Connection` for a socket. `InitializeConnection()` calls it for you.
- `ChangeLocalConnectionState(Invoker invoker, LocalConnectionState nextLocalConnectionState, Connection? connection, string? disconnectReason = null)`: changes a connection's local state and raises callbacks.
- `SetRemoteConnectionStateAsConnected(uint idBySocket, Connection connection)`: server-only; marks a connection remotely connected and raises callbacks.

To report a client that has left, a server socket calls its own protected `SetRemoteConnectionStateAsDisconnected(Connection connection, string? disconnectReason = null)`. The reason reaches game code as `ConnectionStateChange.DisconnectReason`. Game code drops a client with `Connection.Kick()` instead.

## Give each received payload exactly one owner

`CommonSocket` has two helpers that copy a received payload into a buffer rented from `TrackedArrayPool<byte>` (`CodeBoost.Performance`), the pool the engine returns it to once the packet is read:

- `CopyIntoOwnedPayload(ArraySegment<byte> receivedPayload, out byte[] rentedArray)` copies a payload that is only lent for the receive callback, so the copy outlives it. The caller owns the rented array.
- `TryCopyIntoIncomingPacket(OutgoingPacket outgoingPacket, out IncomingPacket incomingPacket)` copies an `OutgoingPacket` into a new `IncomingPacket`. Offline transports such as `Yak` use it.

Whichever code queues the resulting `IncomingPacket` owns the array from then on. Any path that does not queue it must return the array to `TrackedArrayPool<byte>` itself. Two owners, or none, corrupt the pool.
