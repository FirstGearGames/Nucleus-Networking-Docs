---
title: "Your first networked scene"
---

> **Driving the core API directly?** See [Your first .NET host](./your-first-dotnet-host).

Every Unity scene that uses Nucleus needs exactly one `UnityCoreManager`. Everything else in this tutorial follows from that single component.

## Add the core manager

Create an empty GameObject at the root of your scene and add `UnityCoreManager` to it. Stop there — do not add any of the other Unity manager components yourself.

`UnityCoreManager` is marked `[DisallowMultipleComponent]`, so a scene can only ever have one on a given GameObject, and `[DefaultExecutionOrder(-10000)]`, so its `Awake` runs before every other script's. That ordering matters: other components resolve a ready `CoreManager` from their own `Awake`, and that only works if `UnityCoreManager` has already built one.

In its `Awake`, `UnityCoreManager`:

1. Adds a `UnityNetworkLoopStepProvider`, so the network loop is driven from Unity's own update loop instead of the engine's default background-timer provider.
2. Constructs the `CoreManager` from the tick rate and that step provider.
3. Calls `EnsureManagers`, which adds any of the following components that isn't already present on the GameObject:
   - `UnityNetworkLoopManager`
   - `UnityTransportManager`
   - `UnityServerManager`
   - `UnityClientManager`
   - `UnitySystemManager`
   - `UnityInterestManager`
   - `UnityPacketManager`
   - `UnityMessageManager`
   - `UnitySceneManager`
   - `UnityPhysicsManager`

You author one component and end up with ten, each mirroring a manager on the core `CoreManager`. You never pick a network loop step provider yourself — `UnityCoreManager` already added one before the `CoreManager` existed to need it.

## Set the tick rate

`UnityNetworkLoopManager` exposes a **Tick Rate** field in the Inspector. `UnityCoreManager.Awake` reads it before constructing the `CoreManager`, because the `CoreManager` bakes every rate-derived value in at construction and exposes no setter afterward. Set it before you press Play; changing it during play has no effect on the running session.

If no `UnityNetworkLoopManager` exists yet when `UnityCoreManager` wakes, the `CoreManager` falls back to the engine's default tick rate.

## Choose how the connection starts

`UnityTransportManager` has an **Automatic Start Mode** field, backed by:

```csharp
public enum NetworkStartMode
{
    None,
    Server,
    Client,
    Host,
}
```

It defaults to `None`, so nothing connects on its own — you choose Server, Client, or Host in the Inspector, and `UnityTransportManager.Start` calls the matching method for you when play begins.

To start the connection from your own code instead, call one of:

```csharp
await unityTransportManager.StartServerAsync();
await unityTransportManager.StartClientAsync();
await unityTransportManager.StartHostAsync();
```

Each of these ensures a transport is added to the core manager first, then connects it in the matching role. `StartHostAsync` connects both a server and a client on the same transport, in the same process.

## The default transport

`UnityTransportManager` needs at least one `NetworkTransport` component to connect. If you haven't added one yourself, it adds a `SynapseTransport` to the GameObject the first time a transport is needed, so the manager always has something to work with. Its defaults:

| Field | Default |
|---|---|
| Port | `7777` |
| Remote Host | `127.0.0.1` |
| Maximum Transmission Unit | `1200` |
| Idle Timeout Seconds | `15` |
| Connecting Timeout Seconds | `10` |
| Host Pairing | `Local` |

Host Pairing controls how a host reaches its own client half. `Local` pairs the two in process instead of routing that traffic over the socket, so a host's own connection comes up immediately.

## Tearing down

When the `UnityCoreManager` GameObject is destroyed — including on leaving Play mode — its `OnDestroy` unwinds the integration binding first, then deinitializes the `CoreManager`. This runs before Unity finishes destroying the rest of the scene's GameObjects, so nothing is left driving objects that no longer exist.

## Next steps

At this point you have a scene that can start a server, a client, or a host, and see the connection come up. Building a dedicated server with no Unity in the process at all works differently — see [Your first .NET host](./your-first-dotnet-host).
