---
title: "The Nucleus Core Manager component"
---

> **Driving the core API directly?** See [Creating a CoreManager](../../core-api/core/core-manager).

`UnityCoreManager` is the one component a scene needs to bring up a Nucleus session. Drop it on a root GameObject and its `Awake` builds the `CoreManager`, wires the Unity integration to it, and fills in every other manager component the session needs.

## Adding it to a scene

Add `UnityCoreManager` to a single GameObject. Its `Awake` constructs the session's `CoreManager` and exposes it as the `CoreManager` property. Nothing else in the scene has to wire anything by hand.

## What Awake builds

`EnsureManagers()` adds any manager component missing from the GameObject, so the inspector always shows the full set:

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

`EnsureManagers` only adds to the `UnityCoreManager`'s own GameObject, but the notify pass afterward uses `GetComponentsInChildren<UnityManager>()`, so a manager authored on a child GameObject is still found and bound. Each one is notified through `ManagersInstantiated`.

## Execution order

`UnityCoreManager` carries `[DefaultExecutionOrder(-10000)]` and `[DisallowMultipleComponent]`. The execution order runs it before every other script in the scene, so a context-aware rent made from another script's `Awake` always finds a ready `CoreManager` instead of racing its construction. `DisallowMultipleComponent` keeps a GameObject from ending up with two, which would mean two `CoreManager` instances competing for the same manager components.

## Order inside Awake

Before constructing anything, `Awake` reads `UnityNetworkLoopManager.TickRate` from a `UnityNetworkLoopManager` found with `GetComponentInChildren`. This has to happen first because `CoreManager` bakes every rate-derived value into itself at construction and exposes no setter afterward; the tick rate can only be supplied at the point of construction. If no `UnityNetworkLoopManager` exists yet in the scene, the tick rate falls back to `NetworkLoopManager.DefaultTickRate`.

`Awake` also adds a `UnityNetworkLoopStepProvider` component before constructing the `CoreManager`, and hands it in as the step provider. This is deliberate: the core installs its own background-timer provider when given none, and that provider would start driving the loop from the thread pool immediately, racing every loop callback the rest of `Awake` still has to register. Supplying the Unity step provider up front means the loop only ever advances from Unity's own update, and stays inert until `CoreManager` starts it.

With the tick rate and step provider in hand, `Awake`:

1. Constructs `CoreManager = new(tickRate, unityNetworkLoopStepProvider)`.
2. Calls `NucleusUnity.Initialize(CoreManager)`.
3. Calls `EnsureManagers()`.
4. Calls `ManagersInstantiated` on every `UnityManager` found via `GetComponentsInChildren<UnityManager>()`.

## Reaching the session from elsewhere

`NucleusUnity.Initialize` binds the integration to the `CoreManager` that was just built. A script that is not on the `UnityCoreManager`'s own GameObject reaches the session through `NucleusUnity.BoundCoreManager`, a public property set by `Initialize`.

## Teardown

`OnDestroy` unwinds `Awake` in reverse: it calls `NucleusUnity.Deinitialize(CoreManager)` first, then `CoreManager.Deinitialize()`. Deinitializing releases the integration's bindings before the manager graph underneath them is torn down. Calling `CoreManager.Deinitialize()` a second time is safe; it is idempotent, so a `CoreManager` that another teardown path already deinitialized simply absorbs the call.
