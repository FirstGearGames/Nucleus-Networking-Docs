---
title: "The Synapse transport"
---

> **Using Unity?** See [Synapse Transport component](../../unity/transports/synapse-transport-component.md).

Synapse is Nucleus's production UDP transport. Every setting is a plain C# property or field you set before connecting.

## Add and connect it

```csharp
Synapse synapse = (Synapse)await transportManager.AddTransportAsync<Synapse>();
synapse.RemoteHost = IPAddress.Loopback;

await synapse.ConnectAsync(Invoker.Server);
await synapse.ConnectAsync(Invoker.Client);
```

- `RemoteHost` is the address the client dials. It defaults to `IPAddress.Loopback`; set it before `ConnectAsync(Invoker.Client)` to reach another machine. The server always binds every local address, so `RemoteHost` does not affect it.
- A host calls `ConnectAsync` on the same `Synapse` instance twice, once with `Invoker.Server` and once with `Invoker.Client`.
- `SetPort(ushort)` sets both `Configuration.Port`, which the server binds, and `RemotePort`, which the client dials.

## Configure it

`Synapse.Configuration` is the shared `Configuration` struct:

| Field | Default | Notes |
|---|---|---|
| `Port` | `0` | The server's listen port and the port the client connects to. The Unity component defaults it to `7777`; the engine does not. |
| `MaximumTransmissionUnit` | `1200` | Larger packets are split. |
| `ConnectedTimeoutSeconds` | `15` | How long a connection waits without hearing from the other side before it times out. Never less than one second. |
| `ConnectingTimeoutSeconds` | `10` | How long a client waits for the server to answer its connect before returning to `Disconnected`. Zero uses `ConnectedTimeoutSeconds`. Client only. |

Cap how many clients the server accepts with `synapse.SetMaximumConnections(uint)`. It sets `ServerConfiguration.MaximumConnections`, which is read-only to your code. `ServerConfiguration.UnsetMaximumConnections` (`0`, the default) accepts any number. The cap applies the next time the server starts. A client over the cap gets no answer, so it gives up as it would on a server that never replied.

## Finding out why a connection dropped

A `Disconnected` connection carries no reason. Subscribe to `ViolationObserved` on the `Synapse` transport; it is raised for every violation the socket layer reports, just before the connection is reported `Disconnected`.

```csharp
using SynapseSocket.Core.Events;

Synapse synapse = (Synapse)await coreManager.TransportManager.AddTransportAsync<Synapse>();
synapse.ViolationObserved += OnViolationObserved;

void OnViolationObserved(Connection? connection, in ViolationEventArgs violationEventArgs)
{
    if (violationEventArgs.Reason is ViolationReason.Timeout or ViolationReason.ReliableExhausted)
    {
        // Record why this connection is about to drop.
    }
}
```

- `Reason`: `Timeout` when nothing was heard within `ConnectedTimeoutSeconds`, `ReliableExhausted` when a reliable message ran out of resends, `PeerDisconnect` when the other side disconnected, and the security reasons when a peer sends something malformed, oversized or too fast.
- `Action` is the response already decided. The event cannot change it.
- `connection` is the remote client on a server (still registered) and the server on a client. It is null for a sender that never connected.

The event is raised on the network loop thread. A handler must not block, stop the transport or disconnect anyone.

## Start and stop it

- `ConnectAsync(Invoker.Server)` starts listening for clients.
- `ConnectAsync(Invoker.Client)` connects the local client to `RemoteHost`.
- `DisconnectLocalConnectionAsync(Invoker)` disconnects the local server or client and closes its sockets.
- `DisconnectRemoteClientAsync(Connection)` disconnects one remote client from the server.
- `ShutdownAsync()` stops all local connections.

## Choose how a host pairs with itself

`HostPairing` sets how a host's server and client halves connect. Set it before the client connects.

- `HostPairing.Endpoint` (default): the halves talk over the socket like any remote pair, so a host exercises the same path a remote client does.
- `HostPairing.Local`: the halves are paired in process and never exchange a datagram. It applies only when the client dials a loopback address with its own server already running.

`IsOwnClientConnection(Connection)` reports whether a connection is the host's own client half. `IsLocalTransport()` returns `false`, even under `HostPairing.Local`.

`Synapse.DatagramOverheadBytes` is the socket layer's largest per-datagram header, which comes out of the transmission unit.
