---
title: "UnitySceneLoader component"
---

> **Driving the core API directly?** See [Registering a scene loader](../../core-api/scenes/scene-loader-api.md).

`UnitySceneLoader` is the Unity `ISceneLoader`. It looks up each scene id the server sends in the [network scene manifest](./network-scene-manifest.md), loads the scene additively, and reports back so withheld spawns can land. Add it to a GameObject that can reach the integration's `CoreManager`, and it registers itself.

## Set the inspector fields

| Label | Default | What it does |
|---|---|---|
| Auto Register | on | Registers with the integration's `CoreManager` in `Awake`, so your own code can load scenes from `Start`. Turn it off to call `Initialize(CoreManager)` yourself. |
| Manifest | empty | Maps scene ids to scene assets and the content bundle each ships in. Leave it empty to use the project's manifest from Resources. |
| Local Physics | off | Loads each scene into its own local physics world (`LocalPhysicsMode.Physics3D`) and has Nucleus step it every tick. Turn it on so stacked copies of one scene do not collide with each other. Unity never steps a local physics scene by itself. Bodies in such a scene need manual interpolation. |

The `Manifest` property returns the manifest in use, resolving the project's manifest when none is assigned.

## Write your own loader

`NetworkSceneLoader` is the abstract `MonoBehaviour` base that implements `ISceneLoader`, and `UnitySceneLoader` derives from it. It defines:

- `LoadSceneAsync(uint sceneHandle, ushort sceneId)` and `UnloadSceneAsync(uint sceneHandle)`: abstract and asynchronous. They may take as long as needed.
- `MaximumConcurrentScenes`: a `virtual uint` that defaults to `SceneManager.UnlimitedConcurrentScenes`. Override it only if your loader cannot hold every scene the server asks for at once.
- **Auto Register** and `Initialize(CoreManager)`, as above.

To change one part of `UnitySceneLoader`, subclass it and override one of these hooks:

- `TryGetScene(ushort sceneId, out NetworkSceneManifest.SceneEntry sceneEntry)`: looks up a scene id. Override it to read entries from somewhere other than a `NetworkSceneManifest`.
- `EnsureSceneContentAsync(ushort requiredBundleId)`: makes sure the content bundle a scene ships in is available before the scene loads.
- `LoadSceneCoreAsync(uint sceneHandle, ushort sceneId)`: the additive load, or `LoadAddressableSceneCoreAsync` when the entry is Addressable.
- `LoadAddressableSceneCoreAsync(uint sceneHandle, ushort sceneId, NetworkSceneManifest.SceneEntry sceneEntry, Task<bool> bindingTask)`: the Addressables load, through `Addressables.LoadSceneAsync`. It is compiled only under `NUCLEUS_ADDRESSABLES`.
- `UnloadSceneCoreAsync(uint sceneHandle)`: the unload.
- `ResolveManifest()`: returns the assigned manifest, or `NetworkSceneManifest.LoadProjectManifest()` when none is assigned.

`ResolveManifest` is `protected`; the others are `protected virtual`.

## Turn on Addressables support

Install `com.unity.addressables` 1.19 or newer, and the integration sets the `NUCLEUS_ADDRESSABLES` define for you, which turns on the Addressables load path. See [Addressables-delivered scenes](./bundle-delivered-scenes.md).
