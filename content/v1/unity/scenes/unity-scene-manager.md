---
title: "UnitySceneManager component"
---

> **Driving the core API directly?** See [Placing clients in scenes](../../core-api/scenes/placing-clients-in-scenes.md).

`UnitySceneManager` sets up the core `SceneManager` from the inspector and gives the peer a scene loader if the project has none. `UnityCoreManager` adds one with default settings if you have not.

## Set the fields

The fields are applied once, when the managers are created.

| Inspector label | Default | What it does |
|---|---|---|
| Join Placement | `JoinScenePlacement.EveryOpenScene` | Sets `SceneManager.JoinPlacement`. |
| Auto Request On Blocked Spawn | off | Sets `SceneManager.AutomaticRequestOnBlockedSpawnEnabled`. |
| Scene Loader Enabled | on | Adds a `UnitySceneLoader` to this GameObject when no `NetworkSceneLoader` exists in the loaded scenes, active or inactive. A loader the project placed itself always wins. |
| Auto Simulate Stacked Scenes | off | Sets `UnitySceneLoader.LocalPhysicsEnabled` on the loader this component adds. A loader the project placed itself keeps its own value. |
| Scene Load Timeout (s) | `180` | Sets `SceneManager.LoadRequestTimeoutSeconds`: how long the server waits for a client to answer a scene load request before treating the load as failed. Zero or less waits indefinitely. |

## Reach the core SceneManager

`NucleusSceneManager` holds the core `Nucleus.Managers.Scenes.SceneManager`. It is set when the managers are created.

## Translate between a scene handle and a Unity scene

Stacked copies of one scene asset share a name and path, so Unity's `GetSceneByName` and `GetSceneByPath` return an arbitrary copy. Only the scene handle tells them apart. Use these methods instead:

```csharp
public bool TryGetScene(uint sceneHandle, out Scene scene)
public bool TryGetSceneHandle(Scene scene, out uint sceneHandle)
```

`TryGetScene` returns the live Unity scene for a handle. It returns false while the scene is still loading, and on a peer the instance was never opened for.

`TryGetSceneHandle` returns the handle for a live scene, with three outcomes:

- False: the scene is still loading, and its objects are running `Awake` now.
- True with `NetworkSystem.UnsetSceneHandle`: this peer loaded the scene itself, and no instance will ever claim it.
- True with any other value: the handle of the instance.
