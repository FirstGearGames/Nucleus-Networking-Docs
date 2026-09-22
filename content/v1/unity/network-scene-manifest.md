---
title: "The network scene manifest and scene references"
---

## Why scenes need a manifest

The wire never carries a scene's path or name, only a `ushort` identifier. Something has to map that number back to an actual scene asset on each peer, and that something is `NetworkSceneManifest`, a `ScriptableObject` under `Nucleus.Integrations.Unity.Scenes`. It is also the identifier registry itself: a networked prefab carries its id stamped on the prefab asset, but a scene has nowhere comparable to hold one, so the manifest entry keyed by the scene's GUID *is* where the id lives.

A project has exactly one manifest. It lives under a `Resources` folder and is resolved by convention, not by being dragged into an inspector.

## NetworkSceneManifest

`NetworkSceneManifest` exposes:

- `Entries` — the `IReadOnlyList<SceneEntry>` of every networked scene this peer knows.
- `UnsetSceneId` — the constant `0`, reserved so a lookup that failed can be told apart from "the first scene."
- `ResourceName` — the constant `"NetworkSceneManifest"`, the file name the manifest must have under a `Resources` folder.
- `TryGetScene(ushort sceneId, out SceneEntry sceneEntry)` — resolves an entry from the id the authority named on the wire.
- `TryGetSceneId(string scenePath, out ushort sceneId)` — resolves an id from a scene's asset path.
- `TryGetSceneIdByGuid(string sceneGuid, out ushort sceneId)` — resolves an id from a scene's GUID; prefer this one, since it is what the id is actually keyed to.
- `LoadProjectManifest()` — a static method that loads the project's manifest via `Resources.Load<NetworkSceneManifest>(ResourceName)`. Nothing is cached: a manifest held in a static would keep answering for an asset a later session replaced.

```csharp
NetworkSceneManifest manifest = NetworkSceneManifest.LoadProjectManifest();

if (manifest != null && manifest.TryGetScene(sceneId, out NetworkSceneManifest.SceneEntry entry))
{
    // entry.ScenePath is what you hand to Unity's scene loader.
}
```

### SceneEntry

Each `SceneEntry` in `Entries` carries:

| Field | Purpose |
|---|---|
| `SceneId` | The identifier the authority names this scene by on the wire. Assigned once by the build and never renumbered. |
| `SceneGuid` | The scene asset's GUID. The identifier is keyed to this, so a rename or move keeps it. |
| `ScenePath` | The scene asset's path, which is what the loader hands to Unity. |
| `RequiredBundleId` | The content bundle this scene ships in, or zero when it ships inside the player build. A scene in a bundle can't load until that bundle is held. |
| `DeliveryMode` | A `SceneDeliveryMode`, either `BuildSettings` or `Addressables`, deciding which machinery the loader opens the scene through. |

## NetworkSceneReference

Fields that need to name a scene do not store a path or an id. They store a `NetworkSceneReference`, a serializable struct that holds only a scene asset's GUID (`SceneGuid`), plus `HasScene` (true once a GUID is assigned) and `TryGetSceneId(out ushort sceneId)`.

`TryGetSceneId` resolves through the project's manifest at the moment it's called, via `TryGetSceneIdByGuid`. Nothing is baked in at authoring time, so a scene added to the manifest after the reference was set resolves as soon as the manifest is rebuilt, and a scene that stopped being networked resolves to `UnsetSceneId` instead of silently opening the wrong thing.

```csharp
[SerializeField]
private NetworkSceneReference _lobbyScene;

if (_lobbyScene.TryGetSceneId(out ushort sceneId))
{
    // Tell the authority to open sceneId.
}
```

Because only the GUID is stored, renaming or moving the scene asset never repoints the field to a different scene and never breaks it.

In the inspector, `NetworkSceneReferenceDrawer` draws a `NetworkSceneReference` field as an ordinary scene-asset picker (an `ObjectField` for `SceneAsset`), with the resolved scene id shown alongside it as a small label. You drag a scene in exactly as you would for a plain `SceneAsset` field; the GUID is captured for you.

## Minting a scene id

Scene ids are not assigned by hand. **Nucleus > Rebuild Network Scene Manifest** rescans the project and writes `Entries`, and `NetworkSceneManifestAutoRebuild` runs that rebuild automatically. It listens for four triggers: the Build Settings scene list changing, a scene asset being imported, the project's Addressables entries changing, and a player build starting (the last is the backstop, catching anything the other three missed before it ships).

The scan covers both ways a scene can be networked: scenes listed in Build Settings, and scenes the project has made Addressable. The Addressables pass matters because marking a scene Addressable *removes it from Build Settings* — without a dedicated pass, the very act of making a scene streamable would drop it out of the manifest. Whichever way a scene is found, its `DeliveryMode` is derived from the project (Addressable scenes record `SceneDeliveryMode.Addressables`, everything else records `BuildSettings`), so making a scene Addressable is the whole of the change needed to switch it.

Once assigned, a scene's id is preserved across rebuilds; a rebuild only adds ids for newly-found scenes and drops entries for scenes no longer present.

## Why only a ushort crosses the wire

The authority names a scene by `SceneId` alone. No path, no name, no build index, and how the scene is delivered (`DeliveryMode`, `RequiredBundleId`) is never replicated either — those are purely how the local peer resolves the id into something it can load. This is deliberate: paths and names change with renames and refactors, but the manifest that maps a stable id to a stable GUID does not need to, so a build can point at different content, or ship a renamed scene, without ever touching what's on the wire.
