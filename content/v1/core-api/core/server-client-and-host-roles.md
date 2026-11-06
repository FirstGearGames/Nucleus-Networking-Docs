---
title: "Server, client and host roles"
---

> **Using Unity?** See [Starting and stopping a session in Unity](../../unity/core/unity-starting-and-stopping.md).

## Invoker names the role an operation acts for

```csharp
public enum Invoker : byte
{
    Client = 0,
    Server = 1,
}
```

`Invoker` is a parameter, not a status check: it does not assert that the role is started.

## Start a role on a transport

Construct and configure the transport (see the transports pages), add it to the `TransportManager`, then connect each role you want:

```csharp
await transportManager.TryAddTransportAsync(transport);

await transport.ConnectAsync(Invoker.Server);
await transport.ConnectAsync(Invoker.Client);
```

`ConnectAsync(Invoker.Server)` begins listening, and `ConnectAsync(Invoker.Client)` connects the local client to the server, using the transport's current configuration. Calling both starts a host.

## Read which roles are started

| `TransportManager` member | True when |
|---|---|
| `IsServerStarted` | The local server connection is connected. |
| `IsClientStarted` | The local client connection is connected **and authenticated**. |
| `IsHostStarted` | `IsServerStarted` and `IsClientStarted` are both true. |

`IsClientStarted` waits for authentication, not just the socket, so gameplay code never sees a client as started before the server accepts it.

`NetworkSystem` has the same three members, so gameplay code can branch without reaching the transport layer:

```csharp
if (networkSystem.IsServerStarted)
{
    // Authority-only logic.
}
```

Being the server and controlling a system are separate questions. Use `IsServerStarted` for the first and `NetworkSystem.IsController(ControllerType)` for the second; see [What control means](../control/the-control-model.md). The guards `EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` exist only on the Unity `NucleusBehaviourBase`.

## Stop a role

```csharp
await transport.DisconnectLocalConnectionAsync(Invoker.Client);

await transport.ShutdownAsync();
```

`DisconnectLocalConnectionAsync(Invoker)` disconnects the local connection for that role and closes its open sockets. `ShutdownAsync` stops all of a transport's local connections at once. Neither removes the transport from the `TransportManager`; it stays added, ready to `ConnectAsync` again.

## Check the ConnectionStateChangeResult

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

`ConnectAsync` and `DisconnectLocalConnectionAsync` return it. `ShutdownAsync` does not. Code that did not make the call can react to a role starting or stopping through `TransportManager.ConnectionLocalStateChanged`; see [Connections](./connections.md#read-and-react-to-connection-state).
