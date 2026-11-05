---
title: "Networked scenes in Unity"
---

> **Driving the core API directly?** See [Opening and closing scene instances](../../core-api/scenes/opening-scene-instances.md).

## Add the manager and loader

`UnityCoreManager` adds a `UnitySceneManager` with default settings when neither its GameObject nor any child has one. That `UnitySceneManager` adds a `UnitySceneLoader` when no `NetworkSceneLoader` exists in the loaded scenes, inactive objects included. For a first scene, the defaults are enough.

To change the scene manager's settings, add `UnitySceneManager` yourself to the `UnityCoreManager`'s GameObject or to a child of it. Keep that child active: a `UnitySceneManager` on an inactive child is never set up. A loader you place yourself is used instead of the one it would add. The settings are on [UnitySceneManager component](./unity-scene-manager.md).

## Give the scene an id

1. Add the scene to Build Settings. The [network scene manifest](./network-scene-manifest.md) rebuilds itself and gives the scene an id.
2. If it has not, open the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Scene Manifest**.

Leave the loader's **Manifest** field empty, and it uses the project's manifest. Assign one only if your project deliberately keeps more than one manifest.

## Open an instance and send a client to it

`UnitySceneManager.NucleusSceneManager` is the core scene manager:

```csharp
ushort sceneId; // the id the manifest gave your scene
if (unitySceneManager.NucleusSceneManager.TryOpenScene(sceneId, SceneScope.Connections, out uint sceneHandle))
{
    unitySceneManager.NucleusSceneManager.TryRequestSceneLoad(connection, sceneHandle);
}
```

`TryOpenScene` only opens the instance on the server, and a `SceneScope.Connections` instance places nobody. Nothing loads on a client until you call `TryRequestSceneLoad(connection, sceneHandle)`. If you skip it, the scene never appears on the client and no error is logged.

## Join placement only covers new joins

**Join Placement** (`JoinPlacement` on the core manager) decides which of the scenes already open a newly authenticated client is placed in. It does nothing for scenes opened later:

- A `SceneScope.Global` scene opened later still reaches every client, because opening it places every connected client.
- A `SceneScope.Connections` scene opened after a client joined is never offered to that client, even under the default `EveryOpenScene`. Call `TryRequestSceneLoad` for each connection you want in it.
