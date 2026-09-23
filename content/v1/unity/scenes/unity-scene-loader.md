---
title: "UnitySceneLoader component"
---

> **Driving the core API directly?** See [Registering a scene loader](../../core-api/scenes/scene-loader-api.md).

`UnitySceneLoader` is the shipped `ISceneLoader` implementation for Unity: it maps the scene identifiers a server sends to scene assets, loads them additively, and reports back so withheld spawns can land. Add it to a GameObject alongside (or reachable from) the integration's CoreManager and it registers itself automatically.

## Inspector fields

| Field | Inspector label | Description |
| --- | --- | --- |
| `_sceneManifest` | Manifest | Maps scene identifiers to scene assets and the content bundle each ships in. Optional: leave it empty and the loader resolves the project's manifest from Resources on first use. |
| `_localPhysicsEnabled` | Local Physics | Loads each networked scene into its own local physics world and attaches a driver so Nucleus steps it every tick. |
| `_automaticRegistrationEnabled` (inherited from `NetworkSceneLoader`) | Auto Register | Registers with the integration's CoreManager automatically on `Awake`. Turn it off to call `Initialize` yourself. |

`Manifest` is a public property that resolves through `ResolveManifest()`, so reading it triggers the same lazy Resources lookup.

### Local Physics

With Local Physics on, each scene loads with `LocalPhysicsMode.Physics3D` instead of the default physics world, and a physics simulation driver is attached to step it. This is what keeps two stacked copies of the same arena from colliding with each other: Unity never auto-simulates a local physics scene, so without this a stacked scene's bodies would just sit still. Bodies inside a locally-physics scene need manual interpolation.

## NetworkSceneLoader

`NetworkSceneLoader` is the abstract `MonoBehaviour` that implements `ISceneLoader`. `UnitySceneLoader` derives from it. It owns:

- `LoadSceneAsync(uint sceneHandle, ushort sceneId)` and `UnloadSceneAsync(uint sceneHandle)` — abstract, asynchronous, and may take as long as needed; the network loop never blocks on them.
- `MaximumConcurrentScenes` — a `virtual uint` defaulting to `SceneManager.UnlimitedConcurrentScenes`, because Unity loads scenes additively and holds as many as memory allows. Override it only if a replacement loading pipeline genuinely can't hold every scene the server asks for concurrently.
- `_automaticRegistrationEnabled` and `Initialize(CoreManager)` — registration is deliberately on `Awake`, not `Start`, so game code that loads scenes from its own `Start` always finds a loader already registered.

## Extension points

Subclass `UnitySceneLoader` and override its protected hooks instead of reimplementing `ISceneLoader` from scratch:

- `TryGetScene(ushort sceneId, out NetworkSceneManifest.SceneEntry sceneEntry)` — resolves a scene identifier through the manifest. Override to source scene entries from somewhere other than a `NetworkSceneManifest`.
- `EnsureSceneContentAsync(ushort requiredBundleId)` — makes sure the content bundle a scene ships in is available before the scene loads.
- `LoadSceneCoreAsync(uint sceneHandle, ushort sceneId)` — the default additive load via `UnitySceneManager.LoadSceneAsync`, or `LoadAddressableSceneCoreAsync` when the entry is an Addressable.
- `LoadAddressableSceneCoreAsync(uint sceneHandle, ushort sceneId, NetworkSceneManifest.SceneEntry sceneEntry, Task<bool> bindingTask)` — the Addressables load path, via `Addressables.LoadSceneAsync`. Only compiled under `NUCLEUS_ADDRESSABLES`.
- `UnloadSceneCoreAsync(uint sceneHandle)` — the unload counterpart to `LoadSceneCoreAsync`.
- `ResolveManifest()` — lazily resolves and caches `_sceneManifest`, falling back to `NetworkSceneManifest.LoadProjectManifest()` when none is assigned.

Each is `protected virtual` (`TryGetScene`, `EnsureSceneContentAsync`, `LoadSceneCoreAsync`, `UnloadSceneCoreAsync`, `LoadAddressableSceneCoreAsync`) or `protected` (`ResolveManifest`), so a subclass can override just the piece it needs while keeping the rest of `UnitySceneLoader`'s behavior.

## Addressables support

Addressable scene loading (`LoadAddressableSceneCoreAsync`) compiles only under the `NUCLEUS_ADDRESSABLES` define. The integration's assembly definition sets that define through a `versionDefines` entry keyed on the `com.unity.addressables` package at version `1.19` or newer — install Addressables and the define, and the Addressables load path, follow automatically.
