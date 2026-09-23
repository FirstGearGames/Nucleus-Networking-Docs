---
title: "UnitySceneManager component"
---

> **Driving the core API directly?** See [Placing clients in scenes](../../core-api/scenes/placing-clients-in-scenes.md).

`UnitySceneManager` is the inspector-side driver for the core `SceneManager`. It pushes its serialized fields into the core manager once on `ManagersInstantiated`, and gives the peer a scene loader if the project has not placed one itself.

## Fields

| Inspector label | Field | Default | Pushed into |
|---|---|---|---|
| Join Placement | `_joinPlacement` | `JoinScenePlacement.EveryOpenScene` | `SceneManager.JoinPlacement` |
| Auto Request On Blocked Spawn | `_automaticRequestOnBlockedSpawnEnabled` | `false` | `SceneManager.AutomaticRequestOnBlockedSpawnEnabled` |
| Scene Loader Enabled | `_sceneLoaderEnabled` | `true` | nothing on `SceneManager`; gates whether `EnsureSceneLoader()` adds a `UnitySceneLoader` |
| Auto Simulate Stacked Scenes | `_automaticStackedSceneSimulationEnabled` | `false` | nothing on `SceneManager`; sets `UnitySceneLoader.LocalPhysicsEnabled` |
| Scene Load Timeout (s) | `_sceneLoadTimeoutSeconds` | `180` | `SceneManager.LoadRequestTimeoutSeconds` |

Only three of the five reach the core manager. Join Placement, Auto Request On Blocked Spawn, and Scene Load Timeout are assigned straight onto `SceneManager` in `ManagersInstantiated`. The other two only affect the scene loader this component may add.

Scene Loader Enabled decides whether `EnsureSceneLoader()` runs at all. When true, and no `NetworkSceneLoader` exists yet anywhere in the loaded scenes (active or inactive), a `UnitySceneLoader` is added to this component's GameObject. A loader the project placed itself is found first and always wins; this only fills a gap.

Auto Simulate Stacked Scenes only writes `UnitySceneLoader.LocalPhysicsEnabled` on the loader this component adds through `EnsureSceneLoader()`. A loader the project placed itself keeps whatever `LocalPhysicsEnabled` value it was given directly; this field never touches it.

Scene Load Timeout controls how long the server waits for a client to answer a scene load request before treating the load as failed. Zero or less waits indefinitely.

## Reaching the core SceneManager

`NucleusSceneManager` is the property every script uses to reach the core manager from this component:

```csharp
public Nucleus.Managers.Scenes.SceneManager NucleusSceneManager { get; private set; }
```

It is set once, in `ManagersInstantiated`, from `unityCoreManager.CoreManager.SceneManager`.

## Translating between a scene handle and a Unity Scene

Every scene loads additively, so a world that opens the same asset more than once holds several Unity scenes with the same name and the same path, and Unity's `GetSceneByName`/`GetSceneByPath` answer with an arbitrary one of them. The scene handle - the instance id the server assigned when it opened the scene - is the only thing that tells those copies apart, and `TryGetScene`/`TryGetSceneHandle` are the only supported translation between it and a live `Scene`:

```csharp
public bool TryGetScene(uint sceneHandle, out Scene scene)
public bool TryGetSceneHandle(Scene scene, out uint sceneHandle)
```

`TryGetScene` resolves the live Unity scene that a server-opened instance became on this peer. It returns false while the scene is still loading, and false on a peer the instance was never opened for. A handle can be known - the server already told this peer about the instance - before its `Scene` exists locally, because the load is still in progress; that is the gap this method reports.

`TryGetSceneHandle` is the inverse: given a live `Scene`, it resolves which instance it is. It has three possible outcomes, not two: false means the scene is still loading and its objects are running `Awake` right now; true with `NetworkSystem.UnsetSceneHandle` means this peer loaded the scene itself and no instance will ever claim it; true with any other value names the instance. Collapsing the last two into one "false" would lose the difference between "not yet" and "never".
