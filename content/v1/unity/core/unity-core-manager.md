---
title: "The Nucleus Core Manager component"
components: "UnityCoreManager"
---

> **Driving the core API directly?** See [Creating a CoreManager](../../core-api/core/core-manager.md).

`UnityCoreManager` is the one component a scene needs to bring up a Nucleus session. Drop it on a root GameObject and its `Awake` builds the `CoreManager`, wires the Unity integration to it, and fills in every other manager component the session needs.

## Adding it to a scene

Add `UnityCoreManager` to a single GameObject. Its `Awake` constructs the session's `CoreManager` and exposes it as the `CoreManager` property. Nothing else in the scene has to wire anything by hand.

## What Awake builds

Its `Awake` builds the session's `CoreManager` and adds any of these manager components that are missing, so the inspector always shows the full set:

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

A manager component you placed yourself, on this GameObject or on a child, is used as it is, and no default copy is added beside it. Once every manager exists, each `UnityManager` receives `ManagersInstantiated`, as described in [Unity manager components](./unity-manager-components.md).

## Execution order

`UnityCoreManager` carries `[DefaultExecutionOrder(-10000)]` and `[DisallowMultipleComponent]`. The execution order runs it before every other script in the scene, so a context-aware rent made from another script's `Awake` always finds a ready `CoreManager` instead of racing its construction. `DisallowMultipleComponent` keeps a GameObject from ending up with two, which would mean two `CoreManager` instances competing for the same manager components.

## When the managers are ready

Every manager exists once the `UnityCoreManager`'s `Awake` has run. Configure them from `Start`, or from a `ManagersInstantiated` override on your own `UnityManager`.

The tick rate is read from the `UnityNetworkLoopManager` once, when the session is built, so set it in the inspector before entering play mode. A scene without a `UnityNetworkLoopManager` uses `NetworkLoopManager.DefaultTickRate`. The network loop runs from Unity's own update and stays idle until the session starts.

## Reaching the session from elsewhere

`NucleusUnity.Initialize` binds the integration to the `CoreManager` that was just built. A script that is not on the `UnityCoreManager`'s own GameObject reaches the session through `NucleusUnity.BoundCoreManager`, a public property set by `Initialize`.

## Teardown

`OnDestroy` unwinds `Awake` in reverse: it calls `NucleusUnity.Deinitialize(CoreManager)` first, then `CoreManager.Deinitialize()`. Deinitializing releases the integration's bindings before the manager graph underneath them is torn down. Calling `CoreManager.Deinitialize()` a second time is safe; it is idempotent, so a `CoreManager` that another teardown path already deinitialized simply absorbs the call.
