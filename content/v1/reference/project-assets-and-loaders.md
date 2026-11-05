---
title: "Project assets and loaders"
---

## A project needs a prefab collection and a scene manifest

A project with only base-build prefabs and scenes needs:

- One `NetworkPrefabCollection` at `Resources/NetworkPrefabCollection`. It registers automatically at startup. Without it nothing is registered, and a dynamic spawn fails to resolve its prefab on the receiving peer.
- One `NetworkSceneManifest` at `Resources/NetworkSceneManifest`, if it uses networked scenes.

The [Build tab of the Nucleus window](./editor-menus-and-tools.md) creates and rebuilds both. Everything else on this page is optional.

## Register networked prefabs

### NetworkPrefabCollection

A `ScriptableObject` (**Create > Nucleus > Network Prefab Collection**) listing the networked prefabs of one content shard. The base build has a default shard, and each asset bundle ships its own beside its prefabs.

- `_prefabs`, exposed as `Prefabs`: the prefabs in the shard.
- `_prefabBundleId`, exposed as `PrefabBundleId`: the bundle id the shard registers its prefabs under, taken from the shard assembly's `[NetworkBundle]` attribute. Zero is the base build's shard.
- `_bundleAssemblyName`, exposed as `BundleAssemblyName`: the simple name of the assembly that supplies that id; empty for the base build's shard.

`RegisterAll()` claims the shard's bundle id and registers every prefab; `UnregisterAll()` removes them and releases the claim when the shard's content unloads. Two loaded collections claiming the same bundle id is an error.

### NetworkPrefabRegistry

The runtime lookup collections register into, keyed by `(BundleId, LocalId)`. A spawn resolves its prefab through `NetworkPrefabRegistry.TryGet`; a spawn whose identity has no entry cannot instantiate.

### Recycle spawned instances with a prefab pool

Every dynamic spawn rents and returns its GameObject through an `INetworkPrefabPool`:

```csharp
public interface INetworkPrefabPool
{
    GameObject Rent(GameObject prefabGameObject, ushort prefabBundleId, ushort prefabLocalId, Vector3 position, Quaternion rotation, Vector3 scale);
    void Return(GameObject pooledGameObject, ushort prefabBundleId, ushort prefabLocalId);
}
```

- **`DefaultNetworkPrefabPool`** (default): instantiates on rent and destroys on return.
- **`NetworkPrefabPool`**: deactivates a returned instance and reuses it on a later rent of the same prefab, taking the one parked longest. `ReturnCooldownSeconds` keeps a just-returned instance parked before it can be reused. `InstantiatedCount` and `ReusedCount` count new instances and reuses.

Assign the pool through `NucleusUnity.PrefabPool`; `null` restores `DefaultNetworkPrefabPool`:

```csharp
NucleusUnity.PrefabPool = new NetworkPrefabPool { ReturnCooldownSeconds = 1f };
```

A reused instance does not run `Awake` again. Put per-life setup in the marker's `SystemLinked` and `SystemUnlinked` events, or in `OnEnable`.

## Map and load networked scenes

### NetworkSceneManifest

A `ScriptableObject` (**Create > Nucleus > Network Scene Manifest**) mapping the scene ids the server names to the scene assets a peer loads, and the content bundle each scene ships in. A project has one, loaded from `Resources/NetworkSceneManifest` by `NetworkSceneManifest.LoadProjectManifest()`, so nothing needs assigning in an inspector.

`_sceneEntries`, exposed as `Entries`, holds one `SceneEntry` per scene:

| Field | Purpose |
|---|---|
| `SceneId` | The identifier the server names this scene by. |
| `SceneGuid` | The scene asset's GUID, which the identifier is keyed to. |
| `ScenePath` | The scene asset's path, handed to Unity's loader. |
| `RequiredBundleId` | The content bundle the scene ships in; the base build's identifier means it ships in the player. |
| `DeliveryMode` | How the peer gets the scene (`SceneDeliveryMode`), set by the build step. |

### NetworkSceneReference

A field type that names a networked scene by dragging in the scene asset. It stores only the scene's GUID (`_sceneGuid`), so renaming or moving the scene never changes which scene it names. `TryGetSceneId` resolves the id through the project's manifest when you use it, so a scene added later resolves once the manifest is rebuilt.

### Go between a scene handle and a Scene

Use these methods on the `UnitySceneManager` component, not Unity's `SceneManager.GetSceneByName` or `GetSceneByPath`, which cannot tell apart several loaded instances of one scene:

```csharp
public bool TryGetScene(uint sceneHandle, out Scene scene);
public bool TryGetSceneHandle(Scene scene, out uint sceneHandle);
```

`TryGetScene` returns the live Unity `Scene` for the server's scene instance handle, and false while the scene is still loading. `TryGetSceneHandle` is the reverse. A true result with `NetworkSystem.UnsetSceneHandle` means this peer loaded the scene itself and no instance will claim it.

### NetworkSceneLoader and UnitySceneLoader

`NetworkSceneLoader` is the abstract `MonoBehaviour` base for loading networked scenes. It implements `ISceneLoader` and registers itself as the peer's scene loader on `Awake`; turn off `_automaticRegistrationEnabled` to call `Initialize` yourself. Derived classes implement `LoadSceneAsync` and `UnloadSceneAsync`.

`UnitySceneLoader` is the shipped loader. It resolves a scene through a manifest, loads the scene's content bundle first if it needs one, then loads the scene additively.

- `_sceneManifest`: the manifest to read. Left empty, it uses the project's manifest.
- `_localPhysicsEnabled`: loads each scene into its own physics world (`LocalPhysicsMode.Physics3D`) with a `PhysicsSimulationDriver` stepping it each tick, so a stacked scene's physics runs independently of the default world.

You do not need to place one: `UnitySceneManager` adds a `UnitySceneLoader` when no `NetworkSceneLoader` is in the loaded scenes. Add your own only to replace the loading.

## Load content bundles

`NetworkBundleManifest` exists in every edition. `NetworkBundleLoader` and `UnityAssetBundleLoader` are Pro only and absent from a Free build, so a Free project has nothing built in that loads bundles. You need these only once prefabs or scenes ship in asset bundles rather than the base build.

### NetworkBundleManifest

A `ScriptableObject` (**Create > Nucleus > Network Bundle Manifest**) mapping the bundle ids the server names to the asset bundle files a client loads.

- `_bundleEntries`, exposed as `Entries`: each `BundleEntry` pairs a `BundleId` with a `FileName`.
- `_rootDirectory`: the directory file names resolve against; empty uses `Application.streamingAssetsPath`.

### NetworkBundleLoader and UnityAssetBundleLoader (Pro)

`NetworkBundleLoader` is the abstract `MonoBehaviour` base for loading content bundles. It implements `IBundleLoader` and registers itself on `Awake`, like `NetworkSceneLoader`. Derived classes implement `LoadBundleAsync` and `UnloadBundleAsync`.

`UnityAssetBundleLoader` is the shipped loader. Assign its `_bundleManifest`; without one, every load logs an error and fails. Once a bundle loads, it registers every `NetworkPrefabCollection` the bundle ships, so spawns waiting on that content can land.
