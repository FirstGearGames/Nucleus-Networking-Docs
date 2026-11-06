---
title: "Starting and stopping a session in Unity"
---

> **Driving the core API directly?** See [Server, client and host roles](../../core-api/core/server-client-and-host-roles.md).

## Start on Play with no code

Set **Automatic Start Mode** on `UnityTransportManager`, shown as **Start On Play** in the **Setup** tab of the Nucleus window (**Tools > Nucleus**). It is a `NetworkStartMode`:

- `None` (the default): nothing starts until a script starts it.
- `Server`: starts every transport as a server.
- `Client`: starts every transport as a client, connecting to its configured remote host.
- `Host`: starts every transport as both a server and a client in one process.
- `Auto`: starts as a client in a ParrelSync clone or when another process already holds the server port, and as a host otherwise.

To get two editors talking, set one to `Server` or `Host` and the other to `Client`, or set both to `Auto`, and press Play in each.

## Start from code

Call the async methods on `UnityTransportManager` from `Start` or later, for example from a menu button:

```csharp
public UnityTransportManager TransportManager;

public async void OnHostButtonPressed()
{
    await TransportManager.StartHostAsync();
}

public void OnStopButtonPressed()
{
    TransportManager.ShutdownAll();
}
```

`StartServerAsync()`, `StartClientAsync()` and `StartHostAsync()` each add the transports first. To add them without starting anything, call `EnsureAddedAsync()`; a second call does nothing.

The transports are the `NetworkTransport` components on the `UnityTransportManager`'s GameObject and its children, added in the order they are found. With none present, a `SynapseTransport` component is added. Configure each transport on its own component.

## Stop a session

`ShutdownAll()` removes and shuts down every transport the manager added. The `CoreManager` stays until its `UnityCoreManager` is destroyed.

Unloading the scene shuts the transports down for you, so you do not need to call `ShutdownAll()` before a scene change.

## Check what is running

`NucleusTransportManager` has three booleans:

- `IsServerStarted`: a server connection is established on any added transport.
- `IsClientStarted`: a client connection is established **and authenticated**. It stays false after a socket-level connect until the local client finishes authenticating.
- `IsHostStarted`: both are true.

```csharp
if (unityTransportManager.NucleusTransportManager.IsClientStarted)
{
    // The local client is connected and authenticated.
}
```
