---
title: "Server, client and host roles"
---

> **Using Unity?** See [Starting and stopping a session in Unity](../../unity/core/unity-starting-and-stopping).

## Invoker

`Invoker` names which network role an operation acts for: `Client` or `Server`. It does not assert that the role is started - it is a parameter, not a status check. A single process can run both roles by starting server and client separately; that combination is host mode.

```csharp
public enum Invoker : byte
{
    Client = 0,
    Server = 1,
}
```

## Starting a role

A role starts on a `Transport`, after the transport has been constructed, configured, and added to the `TransportManager`. See the transports pages for construction and configuration.

```csharp
await transportManager.TryAddTransportAsync(transport);

await transport.ConnectAsync(Invoker.Server);
await transport.ConnectAsync(Invoker.Client);
```

`ConnectAsync(Invoker)` begins a connection using the transport's current configuration: a `Client` invoker connects the local client to the server, a `Server` invoker begins listening for connections. Calling both starts a host. The call returns a `ConnectionStateChangeResult`.

## Reading the roles

`TransportManager` exposes three booleans for the local peer's current state:

| Member | True when |
|---|---|
| `IsServerStarted` | The local server connection is connected. |
| `IsClientStarted` | The local client connection is connected **and authenticated**. |
| `IsHostStarted` | `IsServerStarted` and `IsClientStarted` are both true. |

`IsClientStarted` does not flip on socket connect - it waits for authentication, so gameplay code never sees a client as started before the server has accepted it.

`NetworkSystem` re-surfaces the same three members so gameplay code can branch without reaching through to the transport layer:

```csharp
if (networkSystem.IsServerStarted)
{
    // Authority-only logic.
}
```

## Why there is no IsAuthority

`IsAuthority` was removed. It conflated two different questions, and the roles above answer them separately:

- **"Is this peer the authority?"** - `IsServerStarted`. The server is always the authority.
- **"Does this peer control this system?"** - `NetworkSystem.IsController(ControllerType controllerType)`. This is a method, not a bool property, because control is checked against a specific role:

```csharp
if (networkSystem.IsController(ControllerType.Client))
{
    // This peer is the client controlling this system.
}
```

`ControllerType` is a flags enum (`None`, `Server`, `Client`, `AnyController`), so a check can ask "am I the server-side controller", "am I the controlling client", or "am I the controller at all" with `AnyController`.

The loud guards `EnsureIsController(ControllerType)` and `EnsureIsStarted(Invoker)` live on the Unity track's `NucleusBehaviourBase`, not on the core API - see the Unity page for them.

## Stopping a role

`DisconnectLocalConnectionAsync(Invoker)` disconnects the local connection for the given role and closes its open sockets. `ShutdownAsync` stops all of a transport's local connections at once, for teardown.

```csharp
await transport.DisconnectLocalConnectionAsync(Invoker.Client);

await transport.ShutdownAsync();
```

Neither call removes the transport from the `TransportManager` - the transport itself stays added, ready to `ConnectAsync` again, until it is explicitly removed.

## ConnectionStateChangeResult

A role change reports its outcome as a `ConnectionStateChangeResult`:

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

`ConnectAsync` and `DisconnectLocalConnectionAsync` both return it directly; `ShutdownAsync` does not, since it tears down every local connection on the transport rather than reporting on one. The same information also arrives as an event: `TransportManager.ConnectionLocalStateChanged` fires with a `ConnectionStateChange` (the `Invoker`, the `Connection`, and whether the change was for the local or remote state), so code that isn't the caller of `ConnectAsync` can still react to a role starting or stopping.
