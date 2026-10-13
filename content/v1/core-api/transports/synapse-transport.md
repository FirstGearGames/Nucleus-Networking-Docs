---
title: "The Synapse transport"
---

> **Using Unity?** See [Synapse Transport component](../../unity/transports/synapse-transport-component.md).

Synapse is Nucleus's production UDP transport, backed by SynapseSocket. It has no editor dependency; every setting is a plain C# property or field set before connecting.

## Adding and connecting

Add the transport through `TransportManager.AddTransportAsync<T0>()`, then configure it before calling `ConnectAsync`:

```csharp
Synapse synapse = (Synapse)await transportManager.AddTransportAsync<Synapse>();
synapse.RemoteHost = IPAddress.Loopback;

await synapse.ConnectAsync(Invoker.Server);
await synapse.ConnectAsync(Invoker.Client);
```

`RemoteHost` is the address the client half dials, and it defaults to `IPAddress.Loopback` so a single-process session works without setting anything. Override it before `ConnectAsync(Invoker.Client)` to reach a remote host; the server side always binds every local address, so `RemoteHost` has no effect on `Invoker.Server`.

A host process calls `ConnectAsync` with both invokers on the same `Synapse` instance, once for `Invoker.Server` and once for `Invoker.Client`.

## Configuration

`Synapse.Configuration` is the shared `Configuration` struct:

| Field | Default | Notes |
|---|---|---|
| `Port` | `0` | Server listen port and the port the client connects to. The engine's own default is `0`; the Unity component sets it to `7777`, but that default lives on the component, not here. |
| `MaximumTransmissionUnit` | `1200` | Packets beyond this length are split into multiple packets. |
| `ConnectedTimeoutSeconds` | `15` | How long a connected socket waits without remote data before the connection is considered timed out. One second is the floor, whatever value is set. Synapse also holds the heartbeat interval to at most a third of this value, so a link carrying nothing else is still heard from twice over before its peer gives up on it. |
| `ConnectingTimeoutSeconds` | `10` | Not applied by Synapse yet. A connect that goes unanswered is bounded by `ConnectedTimeoutSeconds` instead: Synapse gives up on a pending handshake after the same window it uses for a connected link. |

Cap how many clients the server accepts with `synapse.SetMaximumConnections(uint)`. The value lands in `ServerConfiguration.MaximumConnections`, which your code can read but not write, and `ServerConfiguration.UnsetMaximumConnections` (`0`, the default) accepts any number. Synapse applies the cap the next time the server starts. A client beyond it is refused during its handshake without an answer, so it gives up as it would on a server that never answered.

## Finding out why a connection dropped

A connection reported `Disconnected` carries no reason. To learn why, subscribe to `ViolationObserved` on the `Synapse` transport. It is raised for every violation the socket layer reports, before the socket layer acts on it, so a timeout or a reliable message that could not be delivered arrives just before the connection is reported `Disconnected`.

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

- `Reason` names the cause: `Timeout` when nothing was heard within `ConnectedTimeoutSeconds`, `ReliableExhausted` when a reliable message ran out of resends, `PeerDisconnect` when the other side said goodbye, and the security reasons when a peer sends something malformed, oversized or too fast.
- `Action` is the response the socket layer has already settled on. The event only reports it and cannot change it.
- On a server, `connection` is the remote client, still registered. On a client it is the server. It is null for a sender that never connected.

The event is raised on the network loop thread and allocates nothing. A handler may read what it is given, but must not block, stop the transport or disconnect anyone from inside it.

## Starting and stopping

- `ConnectAsync(Invoker.Server)` starts listening for remote clients.
- `ConnectAsync(Invoker.Client)` connects the local client to `RemoteHost`.
- `DisconnectLocalConnectionAsync(Invoker)` disconnects a local connection (server or client) and closes its sockets.
- `DisconnectRemoteClientAsync(Connection)` disconnects a specific remote client from the server.
- `ShutdownAsync()` stops all local connections.

## HostPairing

`HostPairing` controls how a `Synapse` transport recognizes its own client half when one process runs both server and client. It's read when the client socket is asked to connect, so it must be set before that.

- **`HostPairing.Endpoint`** (the engine default) — the two halves talk over the socket like any other pair. The server recognizes its own client by the source port of its datagrams, matched against the port the client socket bound. A host proves the same thing under this value that a remote client would prove: a real datagram, a real handshake, a real acknowledgment.
- **`HostPairing.Local`** — the two halves are paired in process and never exchange a datagram. Engaged only when the client is asked to dial a loopback address with its own server already up. Nothing about a host's own traffic crosses a socket, but a host also no longer proves anything about the transport with its own half.

`IsOwnClientConnection(Connection)` is how the transport answers "is this connection my own client half": under `Local` it's a reference check against the server socket's paired client connection, and under `Endpoint` it's the port match described above.

## DatagramOverheadBytes

`Synapse.DatagramOverheadBytes` reports the widest header the socket layer puts on a datagram. The engine subtracts it when sizing its own segments, so each one stays inside a single datagram instead of being chopped again by the socket layer.

## Other members

`SetPort(ushort)` sets both `Configuration.Port`, the port the server binds, and `RemotePort`, the port the client dials.

`IsLocalTransport()` returns `false`. Synapse always uses a real UDP socket, even under `HostPairing.Local`, where the traffic just never crosses one.
