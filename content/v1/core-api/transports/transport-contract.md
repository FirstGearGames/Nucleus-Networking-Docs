---
title: "The Transport contract"
---

## What a Transport is

`Transport` is the abstract base every connection method implements against: a socket-backed transport like Synapse, an offline one like Yak, or anything else that can move bytes between peers. `TransportManager` drives it once per frame and never touches a socket directly.

## The required members

A concrete `Transport` must implement all of these:

1. `InitializeAsync(CoreManager coreManager, uint transportId)` - sets up the transport. The base assigns `CoreManager` and `Id`; an override calls base and does its own setup.
2. `ConnectAsync(Invoker invoker)` - begins a connection using the current configuration. A client invoker connects the local client to the server; a server invoker starts listening.
3. `OnSendPacket(OutgoingPacket outgoingPacket)` - the abstract method that actually transmits a packet. `SendPacket(OutgoingPacket)` is concrete: it runs the outbound packet transform, counts the transmitted bytes, and then calls `OnSendPacket`. Never override `SendPacket` itself; implement `OnSendPacket`.
4. `PollForIncomingPackets(Invoker invoker)` - polls the underlying transport for newly arrived packets.
5. `ReceivePackets(Invoker invoker, ref List<IncomingPacket> receivedPackets)` - drains polled packets onto the caller's list.
6. `TryGetConnection(Invoker invoker, out Connection connection)` - returns the `Connection` for the socket belonging to an `Invoker`.
7. `IsOwnClientConnection(Connection serverSideClientConnection)` - answers whether a `Connection` the server holds for a peer is in fact this transport's own client half. This one has no default and no warning: a transport that cannot tell must still return `false` rather than guess. Answering `false` costs a host the in-process delivery of its own traffic; a wrong `true` hands a stranger the server's own half.
8. `DisconnectLocalConnectionAsync(Invoker invoker)` - disconnects a local connection and closes any related open sockets.
9. `DisconnectRemoteClientAsync(Connection connection)` - disconnects a remote client from the server.
10. `ShutdownAsync()` - stops all local connections and cleans up.

## The virtuals

Two virtuals have a silent, working default:

- `DatagramOverheadBytes` returns `0`. Override it when the transport prepends its own header to every datagram, so the engine fills each segment up to the transmission unit less that overhead instead of chopping the result a second time.
- `OnApplyCommandLineArguments(CommandLineArguments commandLineArguments)` applies `PortArgument` to `Configuration.Port`. A transport with endpoint settings of its own overrides it, calls base, and reads its own flags.

Two virtuals warn when left at their default, because there is no honest fallback behavior for them:

- `IsLocalTransport()` - whether the transport only runs locally, offline (several security checks are disabled while true). Logs a warning and returns `false` until overridden.
- `SetPort(ushort port)` - sets which port to use. Logs a warning until overridden.

## SocketPairTransport: the shortcut for a server socket plus a client socket

Most transports have the same shape: one socket acting as the server, one acting as the client, each active per `Invoker`. `SocketPairTransport<TServerSocket, TClientSocket>` implements the whole `Transport` contract in terms of that shape, so a concrete transport supplies only its two socket types (both constrained to `CommonSocket`) and whatever behavior is genuinely specific to it.

It rents both sockets in `InitializeAsync`, calls `Initialize` on each, then calls the overridable `OnSocketsInitialized()` once both are ready - the hook for a transport that has to prepare its pair together. Every other contract member routes to whichever socket matches the calling `Invoker`, and `IsOwnClientConnection` is answered by reference identity against the transport's own client socket's `Connection`.

## CommonSocket's helpers

`CommonSocket` is a utility base for the sockets a `SocketPairTransport` pairs up - useful, not required. Two of its helpers do the payload copying a socket implementation needs:

- `CopyIntoOwnedPayload(ArraySegment<byte> receivedPayload, out byte[] rentedArray)` copies a payload the underlying engine only lends for the duration of its receive callback into a buffer rented from `ArrayPool<byte>.Shared`, so the copy outlives the callback. The caller owns the rented array from there on.
- `TryCopyIntoIncomingPacket(OutgoingPacket outgoingPacket, out IncomingPacket incomingPacket)` copies an `OutgoingPacket`'s payload into a new `IncomingPacket`, renting its own array. It is the offline-transport pattern: see `Yak`.

## The manager side a transport calls back into

`TransportManager` exposes the calls a transport implementation is expected to make:

- `RentInitializedConnection(CommonSocket commonSocket)` - rents and initializes a `Connection` for a socket that needs one.
- `ChangeLocalConnectionState(Invoker invoker, LocalConnectionState nextLocalConnectionState, Connection? connection)` - changes a connection's local state and invokes callbacks, or confirms it is already there.
- `SetRemoteConnectionStateAsConnected(uint idBySocket, Connection connection)` - server-only; marks a connection's remote state as connected and invokes callbacks.
- `SetRemoteConnectionStateAsDisconnected(Connection connection)` - server-only; marks a connection's remote state as disconnected and invokes callbacks.

## The payload-ownership rule

A received payload is copied into a pooled buffer exactly once, and that buffer is returned by exactly one owner. `CopyIntoOwnedPayload` and `TryCopyIntoIncomingPacket` are the two places that copying happens; whichever code queues the resulting `IncomingPacket` becomes the array's owner from that point on, and whatever path does not queue it must return the array to the pool itself. Two owners, or none, both corrupt the pool.

## The honest limit

You cannot write a `Transport` outside the Nucleus assembly today. `CommonSocket`'s `ConnectAsync`, `SendPacket`, and `ReceivePackets` are declared `internal`, and on `SocketPairTransport<TServerSocket, TClientSocket>` the `ServerSocket` and `ClientSocket` properties themselves are `internal` too - there is no public surface left to build a socket pair from outside the engine. `AssemblyInfo.cs` grants exactly one exception, `[assembly: InternalsVisibleTo("Nucleus.Integrations.BlitzRelay")]`, so that relay and rendezvous code can stay out of the engine rather than being folded into it to reach this machinery.

If you want to understand the shape of a real transport, read the source: `Yak` for the minimal offline case, `Synapse` for a full socket-backed one.
