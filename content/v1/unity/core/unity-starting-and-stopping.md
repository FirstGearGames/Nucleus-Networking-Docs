---
title: "Starting and stopping a session in Unity"
---

> **Driving the core API directly?** See [Server, client and host roles](../../core-api/core/server-client-and-host-roles).

## The Automatic Start Mode field

`UnityTransportManager` has an **Automatic Start Mode** field backed by `NetworkStartMode`:

- `None` (the default) - does nothing on `Start`.
- `Server` - starts every transport as a server.
- `Client` - starts every transport as a client, connecting to its configured remote host.
- `Host` - starts every transport as both a server and a client in one process.

Set it in the Inspector and press Play. It is the fastest way to get two editors talking: build one editor's `UnityTransportManager` with `Server` (or `Host`) and the other with `Client`, and both come up connected without a line of code.

## Starting from code

Call the async methods on `UnityTransportManager` directly instead:

```csharp
await unityTransportManager.StartServerAsync();
await unityTransportManager.StartClientAsync();
await unityTransportManager.StartHostAsync();
```

Each of these calls `EnsureAddedAsync()` first, so the transports are added before they connect. Call `EnsureAddedAsync()` on its own when you need the transports added to the core manager without starting anything yet:

```csharp
await unityTransportManager.EnsureAddedAsync();
```

`EnsureAddedAsync()` only adds once - a later call returns immediately if transports are already present.

## Shutting a session down

```csharp
unityTransportManager.ShutdownAll();
```

`ShutdownAll()` removes and shuts down every transport the manager added. It leaves the `CoreManager` itself standing; only `CoreManager`'s own teardown (driven by `UnityCoreManager.OnDestroy`) tears that down.

`UnityTransportManager.OnDestroy` calls `ShutdownAll()` itself, unless the `CoreManager` is already deinitialized (checked via `CoreManager.IsDeinitialized`). That means an ordinary scene unload does not leave sockets open behind it - you do not have to call `ShutdownAll()` manually before a scene change.

## Wiring a menu button

`UnityCoreManager.Awake` runs at execution order `-10000` and binds every `UnityManager`, `UnityTransportManager` included, before any other script's `Awake` runs. An ordinary menu-button script can call `StartServerAsync()`, `StartClientAsync()`, `StartHostAsync()`, or `ShutdownAll()` from its own `Awake` and find `NucleusTransportManager` already set. Only a script whose own execution order sits at or below `-10000` needs to wait until `Start` instead.

A minimal button hookup:

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

## How the manager finds its transports

`EnsureAddedAsync()` collects `NetworkTransport` components with `GetComponentsInChildren<NetworkTransport>()` - on the `UnityTransportManager`'s own GameObject and its children - and adds each to the core manager in the order they are found. When none are present, it adds a `SynapseTransport` component instead, so the manager always has a usable transport. Configure the transport's own settings on that component; they are not repeated here.

## Reading the result

`NucleusTransportManager` (the core `TransportManager` the `UnityTransportManager` drives) exposes three booleans:

- `IsServerStarted` - true when a server connection is established on any added transport.
- `IsClientStarted` - true when a client connection is established **and authenticated**. A socket-level connect is not enough: until the local client finishes authenticating, `IsClientStarted` stays false.
- `IsHostStarted` - true when both of the above are true at once.

```csharp
if (unityTransportManager.NucleusTransportManager.IsClientStarted)
{
    // The local client is connected and authenticated.
}
```
