---
title: "The Transport contract"
---

`Transport` is the abstract base every connection method derives from, whether socket-backed like Synapse, offline like Yak, or your own. `Transport`, `SocketPairTransport<TServerSocket, TClientSocket>` and `CommonSocket` are public, so a custom transport can live in your own assembly. See [Yak](./yak-offline-transport.md) for a minimal offline transport and [Synapse](./synapse-transport.md) for a socket-backed one.

## Implement the required members

1. `InitializeAsync(CoreManager coreManager, uint transportId)`: call base, which assigns `CoreManager` and `Id`, then do your own setup.
2. `ConnectAsync(Invoker invoker)`: a client invoker connects the local client to the server; a server invoker starts listening.
3. `OnSendPacket(OutgoingPacket outgoingPacket)`: transmit the packet. Never override `SendPacket`, which applies the packet transform and counts bytes before calling this.
4. `PollForIncomingPackets(Invoker invoker)`: required, but the engine never calls it. Poll inside `ReceivePackets` or from your own method.
5. `ReceivePackets(Invoker invoker, ref List<IncomingPacket> receivedPackets)`: called once per frame for each running half (the server while listening, the client while connecting or connected). Add every packet that arrived since the last call.
6. `TryGetConnection(Invoker invoker, out Connection connection)`: return the `Connection` for that invoker's socket.
7. `IsOwnClientConnection(Connection serverSideClientConnection)`: whether a connection the server holds is this transport's own client half. If the transport cannot tell, return `false`. That only costs a host in-process delivery of its own traffic; a wrong `true` hands a stranger the server's own half.
8. `DisconnectLocalConnectionAsync(Invoker invoker)`: disconnect a local connection and close its sockets.
9. `DisconnectRemoteClientAsync(Connection connection)`: disconnect a remote client from the server.
10. `ShutdownAsync()`: stop all local connections and clean up.

## Override the virtuals you need

| Virtual | Default | Override when |
|---|---|---|
| `DatagramOverheadBytes` | `0` | The transport adds its own header to every datagram. Return its size so packets still fit. |
| `OnApplyCommandLineArguments(CommandLineArguments commandLineArguments)` | Applies `PortArgument` to `Configuration.Port`. | The transport has its own endpoint settings. Call base, then read your flags. |
| `IsLocalTransport()` | Logs a warning and returns `false`. | The transport only runs locally and offline. Several security checks are disabled while it returns true. |
| `SetPort(ushort port)` | Logs a warning. | The transport has a port to set. |

## Derive from SocketPairTransport for a server socket plus a client socket

`SocketPairTransport<TServerSocket, TClientSocket>` implements the whole contract for a transport with one server socket and one client socket. Supply the two socket types, both deriving from `CommonSocket`, and only what is specific to your transport.

- Both sockets are rented and initialized in `InitializeAsync`. Override `OnSocketsInitialized()` to prepare the pair together once both are ready.
- Every other member routes to the socket for the calling `Invoker`. Reach them through `ServerSocket` and `ClientSocket`.
- In your sockets, override `CommonSocket`'s connect, disconnect, send and receive members, declaring each override `protected`.

## Call back into the manager

A transport reports state through these `TransportManager` calls:

- `RentInitializedConnection(CommonSocket commonSocket)`: rents and initializes a `Connection` for a socket.
- `ChangeLocalConnectionState(Invoker invoker, LocalConnectionState nextLocalConnectionState, Connection? connection)`: changes a connection's local state and raises callbacks.
- `SetRemoteConnectionStateAsConnected(uint idBySocket, Connection connection)`: server-only; marks a connection remotely connected and raises callbacks.

To report a client leaving, the socket asks its transport to call its protected, server-only `SetRemoteConnectionStateAsDisconnected(Connection connection, string? disconnectReason = null)`. The reason reaches game code as `ConnectionStateChange.DisconnectReason`. Game code drops a client with `Connection.Kick()` instead.

## Give each received payload exactly one owner

`CommonSocket` has two helpers that copy a received payload into a buffer rented from `ArrayPool<byte>.Shared`:

- `CopyIntoOwnedPayload(ArraySegment<byte> receivedPayload, out byte[] rentedArray)` copies a payload that is only lent for the receive callback, so the copy outlives it. The caller owns the rented array.
- `TryCopyIntoIncomingPacket(OutgoingPacket outgoingPacket, out IncomingPacket incomingPacket)` copies an `OutgoingPacket` into a new `IncomingPacket`. Offline transports such as `Yak` use it.

Whichever code queues the resulting `IncomingPacket` owns the array from then on. Any path that does not queue it must return the array to the pool itself. Two owners, or none, corrupt the pool.
