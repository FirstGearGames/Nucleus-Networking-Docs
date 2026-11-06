---
title: "The network scene manifest and scene references"
---

The server names a scene by a `ushort` scene id, never by its path or name. `NetworkSceneManifest`, a `ScriptableObject` in `Nucleus.Integrations.Unity.Scenes`, maps each id to a scene asset on every peer. A project has exactly one, named `NetworkSceneManifest` and kept under a `Resources` folder. It is found by that name, not assigned in an inspector.

## Scene ids are assigned for you

You never assign scene ids by hand. The editor rebuilds the manifest when:

- the Build Settings scene list changes,
- a scene asset is imported, moved or deleted (saving a scene re-imports it),
- the project's Addressables entries change,
- a player build starts.

To rebuild it yourself, open the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Scene Manifest**.

The rebuild covers scenes in Build Settings and scenes the project has made Addressable. Each entry's delivery mode follows the project, so making a scene Addressable is the whole change needed to deliver it through Addressables (see [Addressables-delivered scenes](./bundle-delivered-scenes.md)).

A scene's id is keyed to its GUID, so it survives a rename or move and is kept across rebuilds. A rebuild only adds ids for new scenes, and it keeps the entry of a scene that has left the build, so that id is never given to another scene.

## Look up a scene from code

`NetworkSceneManifest` exposes:

- `Entries`: every networked scene this peer knows, as an `IReadOnlyList<SceneEntry>`.
- `UnsetSceneId`: the constant `0`, which no scene uses, so a failed lookup can be told apart from the first scene.
- `ResourceName`: the constant `"NetworkSceneManifest"`, the file name the manifest must have under a `Resources` folder.
- `TryGetScene(ushort sceneId, out SceneEntry sceneEntry)`: finds the entry for an id.
- `TryGetSceneId(string scenePath, out ushort sceneId)`: finds the id for a scene's asset path.
- `TryGetSceneIdByGuid(string sceneGuid, out ushort sceneId)`: finds the id for a scene's GUID. Prefer it, since the id is keyed to the GUID.
- `LoadProjectManifest()`: a static method that loads the project's manifest with `Resources.Load<NetworkSceneManifest>(ResourceName)`. It does not cache the result.

```csharp
NetworkSceneManifest manifest = NetworkSceneManifest.LoadProjectManifest();

if (manifest != null && manifest.TryGetScene(sceneId, out NetworkSceneManifest.SceneEntry entry))
{
    // entry.ScenePath is what you hand to Unity's scene loader.
}
```

Each `SceneEntry` holds:

| Field | Purpose |
|---|---|
| `SceneId` | The id the server names this scene by. Assigned once and never renumbered. |
| `SceneGuid` | The scene asset's GUID, which the id is keyed to. |
| `ScenePath` | The scene asset's path, which the loader hands to Unity. |
| `RequiredBundleId` | The content bundle the scene ships in, or zero when it ships in the player build. A scene in a bundle cannot load until that bundle is held. |
| `DeliveryMode` | `SceneDeliveryMode.BuildSettings` or `SceneDeliveryMode.Addressables`: how the loader opens the scene. |

Each peer's own manifest decides how a scene is delivered, not the server. A build can point at different content, or ship a renamed scene, without changing the id the server uses.

## Name a scene in a field with NetworkSceneReference

For a serialized field that names a scene, use `NetworkSceneReference`. It stores only the scene asset's GUID (`SceneGuid`), and offers `HasScene` (true once a scene is assigned) and `TryGetSceneId(out ushort sceneId)`.

```csharp
[SerializeField]
private NetworkSceneReference _lobbyScene;

if (_lobbyScene.TryGetSceneId(out ushort sceneId))
{
    // Tell the server to open sceneId.
}
```

In the inspector it is a scene-asset picker, with the scene id it currently resolves to shown beside it. `TryGetSceneId` looks the id up in the project's manifest each time it is called. Renaming or moving the scene never breaks the field, a scene added to the manifest later resolves after the next rebuild, and a scene that stopped being networked resolves to `UnsetSceneId` instead of opening the wrong scene.
