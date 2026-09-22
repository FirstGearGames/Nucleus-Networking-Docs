---
title: "Project assets and loaders"
---

## Prefabs

### NetworkPrefabCollection

A `ScriptableObject` (`Nucleus/Network Prefab Collection` in the Create menu) that lists the networked prefabs shipped with one content shard. The base build ships a default shard, and each asset bundle ships its own alongside the prefabs it carries.

- `_prefabs` — the prefabs in the shard, exposed as `Prefabs`.
- `_prefabBundleId` — the bundle identifier this shard registers its prefabs under; zero is the base build's default shard. Exposed as `PrefabBundleId`, stamped by the editor scan from the shard assembly's `[NetworkBundle]` attribute.
- `_bundleAssemblyName` — the simple name of the assembly whose `[NetworkBundle]` attribute supplies that identifier; empty for the base build's default shard. Exposed as `BundleAssemblyName`.

`RegisterAll()` claims the shard's bundle identifier and registers every prefab; `UnregisterAll()` removes them and releases the claim, called as the shard's content unloads. Two loaded collections claiming the same bundle identifier is an error, not a silent overwrite.

The base build's collection is loaded from `Resources/NetworkPrefabCollection` automatically at startup. A project with no prefab collection there registers nothing, and a dynamic spawn for a prefab identity nobody registered fails to resolve on the receiving peer.

### NetworkPrefabRegistry

The runtime lookup a collection registers into, keyed by `(BundleId, LocalId)`. A shard registers under its own bundle id, so separately built content never collides. `NetworkPrefabRegistry.TryGet` is what a spawn resolves its prefab through; a spawn whose identity has no entry cannot instantiate.

### The prefab pool seam

Every rent and return of a dynamic spawn's GameObject goes through `INetworkPrefabPool`:

```csharp
public interface INetworkPrefabPool
{
    GameObject Rent(GameObject prefabGameObject, ushort prefabBundleId, ushort prefabLocalId, Vector3 position, Quaternion rotation, Vector3 scale);
    void Return(GameObject pooledGameObject, ushort prefabBundleId, ushort prefabLocalId);
}
```

Two implementations ship:

- **DefaultNetworkPrefabPool** — instantiates on rent and destroys on return. No pooling, and the default a project starts with.
- **NetworkPrefabPool** — recycles: a returned instance is deactivated and parked under a shared inactive root, keyed by prefab identity, and a later rent reactivates the longest-rested parked instance instead of instantiating. `ReturnCooldownSeconds` keeps a just-returned instance parked before it is eligible for reuse; `InstantiatedCount` and `ReusedCount` report the cold-miss and recycle counts.

Because a recycled instance does not re-run `Awake`, a script needing per-life setup binds through the marker's `SystemLinked`/`SystemUnlinked` events, or initializes in `OnEnable` instead.

The active pool is assigned through `NucleusUnity.PrefabPool`:

```csharp
NucleusUnity.PrefabPool = new NetworkPrefabPool { ReturnCooldownSeconds = 1f };
```

Assigning `null` restores `DefaultNetworkPrefabPool`. A project that never touches this property keeps the default, instantiate-and-destroy behavior.

## Scenes

### NetworkSceneManifest

A `ScriptableObject` (`Nucleus/Network Scene Manifest` in the Create menu) mapping the scene identifiers the server names on the wire to the scene assets a peer loads them from, and the content bundle each scene ships in. It is also the identifier registry itself: a prefab is stamped on the prefab asset, but a scene has no comparable place to carry one, so the entry keyed by the scene's GUID is where the identifier lives.

`_sceneEntries` holds the list, exposed as `Entries`; each entry is a `SceneEntry`:

| Field | Purpose |
|---|---|
| `SceneId` | The identifier the server names this scene by on the wire. |
| `SceneGuid` | The scene asset's GUID — what the identifier is really keyed to. |
| `ScenePath` | The scene asset's path, handed to Unity's loader. |
| `RequiredBundleId` | The content bundle the scene ships in; the base build's identifier means it ships in the player. |
| `DeliveryMode` | How the peer gets the scene (`SceneDeliveryMode`), derived from the project by the build step. |

A project has one manifest, loaded by convention from `Resources/NetworkSceneManifest` (`NetworkSceneManifest.LoadProjectManifest()`), so nothing has to be dragged into an inspector.

### NetworkSceneReference

A struct field type that names a networked scene by dragging the scene asset in, instead of typing its wire number by hand. It stores only the scene's **GUID** (`_sceneGuid`) — never the scene identifier itself — so renaming or moving the scene asset never repoints the reference or silently starts naming a different scene. The identifier is resolved through the project's manifest at the moment it's used (`TryGetSceneId`), so a scene added after the reference was authored resolves as soon as the manifest is rebuilt.

### Handle-to-Scene lookups

Once a scene instance is loading, code resolves it through the `UnitySceneManager` component (the CoreManager's Unity-side scene driver), not by walking Unity's own `SceneManager` by name or path — several instances of the same scene asset can be loaded at once, and `GetSceneByName`/`GetSceneByPath` cannot tell them apart.

```csharp
public bool TryGetScene(uint sceneHandle, out Scene scene);
public bool TryGetSceneHandle(Scene scene, out uint sceneHandle);
```

`TryGetScene` turns the server's scene instance handle into the live Unity `Scene`; it answers false while the scene is still loading. `TryGetSceneHandle` is the inverse, for code holding a scene or object that needs to know which instance it belongs to — a true result with `NetworkSystem.UnsetSceneHandle` means the peer loaded that scene itself and no instance will ever claim it.

The correlation between a handle and its `Scene` is tracked internally; these two methods are the supported way to read it.

### NetworkSceneLoader and UnitySceneLoader

`NetworkSceneLoader` is the abstract `MonoBehaviour` base for loading networked scenes: it implements `ISceneLoader` and registers itself as the peer's scene loader automatically on `Awake` (toggle `_automaticRegistrationEnabled` off to call `Initialize` explicitly). Loading and unloading are left to the derived class via `LoadSceneAsync`/`UnloadSceneAsync`.

`UnitySceneLoader` is the shipped implementation, built on Unity's own additive scene loading. It resolves a scene through a manifest, takes the scene's content bundle first if it needs one, then loads the scene additively.

- `_sceneManifest` — the manifest this loader reads. Left empty, it falls back to the project's own manifest, so nothing needs assigning for the common case.
- `_localPhysicsEnabled` — loads each scene into its own local physics world (`LocalPhysicsMode.Physics3D`) with a `PhysicsSimulationDriver` stepping it each tick, so a stacked scene's physics runs independently of the default world.

A project doesn't have to place a `UnitySceneLoader` itself: `UnitySceneManager` adds one automatically if no `NetworkSceneLoader` of any kind is present in the loaded scenes.

## Content bundles (Pro)

`NetworkBundleManifest`, `NetworkBundleLoader`, and `UnityAssetBundleLoader` are Pro-only files — absent entirely from a Free build.

### NetworkBundleManifest

A `ScriptableObject` (`Nucleus/Network Bundle Manifest` in the Create menu) mapping the bundle identifiers the server names on the wire to the asset bundle files a client loads them from.

- `_bundleEntries` — the mapped bundles, exposed as `Entries`; each `BundleEntry` pairs a `BundleId` with a `FileName`.
- `_rootDirectory` — the directory file names resolve against; empty falls back to `Application.streamingAssetsPath`.

### NetworkBundleLoader and UnityAssetBundleLoader

`NetworkBundleLoader` is the abstract `MonoBehaviour` base for loading content bundles: it implements `IBundleLoader` and self-registers on `Awake`, the same way `NetworkSceneLoader` does for scenes. `LoadBundleAsync`/`UnloadBundleAsync` are left to the derived class.

`UnityAssetBundleLoader` is the shipped implementation over Unity asset bundles. Its `_bundleManifest` field maps bundle identifiers to files; left unassigned, a load request logs an error and fails rather than resolving anything. Once a bundle loads, it registers every `NetworkPrefabCollection` the bundle ships, so spawns waiting on that content can land.

## What a project actually needs

A project with only base-build prefabs and scenes needs:

- One `NetworkPrefabCollection` at `Resources/NetworkPrefabCollection` (registers automatically).
- One `NetworkSceneManifest` at `Resources/NetworkSceneManifest`, if it uses networked scenes at all.

Everything else is optional:

- **Prefab pool** — unassigned, spawns use `DefaultNetworkPrefabPool` (instantiate/destroy). Assign a `NetworkPrefabPool` through `NucleusUnity.PrefabPool` only to recycle instances.
- **Scene loader** — a project doesn't have to add one; `UnitySceneManager` provides a `UnitySceneLoader` automatically. Add one manually only to override the loading pipeline.
- **Content bundles** — only needed once the project ships prefabs or scenes in asset bundles rather than the base build. A `UnityAssetBundleLoader` with no manifest assigned fails every bundle load with a logged error, rather than silently doing nothing.
