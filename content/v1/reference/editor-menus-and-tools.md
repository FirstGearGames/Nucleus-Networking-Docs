---
title: "Editor menus and authoring tools"
---

## Open the Nucleus window from Tools > Nucleus

**Tools > Nucleus** is the only Nucleus menu entry. It opens the Nucleus window, or focuses it, on the tab it showed last. The banner names the edition (Pro or Free) and the peer's role: Host, Server, Client or Stopped while playing, and Edit mode outside play mode.

- **Traffic** shows the running session live: tick rate, bandwidth sent and received with a one-minute graph, connection and spawn counts, each connection's latency and packet loss, and simulated network conditions. Its buttons start and stop the server and the client. See [Developer tools in the editor](../unity/diagnostics/developer-tools-in-unity.md#the-traffic-tab).
- **Setup** checks the open scene and offers a one-click fix for each failing row: **Create** a `UnityCoreManager`, **Add Synapse** as the transport, **Rebuild** the network prefab collection and the network scene manifest, and **Add** the open scene to the build. A **Validate Network Prefabs** button sits under the checklist. Once the scene has a `UnityCoreManager`, the tab also shows **Tick Rate**, which cannot change during play, and **Start On Play**, which decides how the session starts when play begins.
- **Build** has one row per build step, each with its own button: **Rebuild Network Prefab Collection** (**Rebuild**), **Rebuild Network Scene Manifest** (**Rebuild**), **Validate Network Prefabs** (**Validate**), and in Pro, **Build Content Bundles** (**Build**).
- **External Resources** opens the Nucleus website, this documentation, the demos guide (once the demos are imported) and the public tracker for bug reports and feature requests.

Log messages and dialogs name a build step by a path such as **Tools > Nucleus > Build > Rebuild Network Prefab Collection**. That means the step's button on the **Build** tab of the Nucleus window.

## Run a build step from the Build tab

None of these steps runs at runtime, and each runs only when you click its button or [call it from a build script](#run-the-rebuilds-from-a-build-script).

### Rebuild Network Prefab Collection

Writes a `NetworkPrefabCollection` asset for every group of prefabs whose root carries a `NetworkSystemObject`, grouped by asset bundle. Prefabs with no asset bundle go into the base build's collection at `Assets/Resources/NetworkPrefabCollection.asset`.

Nucleus's own test prefabs are always left out. Prefabs in a folder listed under **Excluded Folders**, just below the button, are left out too. Add a row with **+**, then type the folder's path relative to the project, such as `Assets/Prototypes`, and press Enter, or click **...** to pick the folder. A folder picked or pasted as a full path is stored relative to the project, and a path that is not a folder in the project is refused with a warning in the Console. The list is saved in `ProjectSettings/NucleusPrefabCollectionSettings.asset`; commit that file so every machine and every build script leaves out the same folders.

Each prefab is stamped with a local prefab id and a bundle id. A prefab that already has a valid, unique id keeps it; only a prefab with no id or a duplicated one gets a new id, and each renumbering logs a warning naming the prefab, the prefab that already holds the id, and the new id.

An error is logged when two collections resolve to the same prefab bundle, because the second to load is refused at runtime. Give each content bundle assembly its own `[NetworkBundle(n)]`.

### Validate Network Prefabs

Checks every prefab and logs each problem against the prefab, without changing anything: the identity problems a player build refuses (below), a `NetworkSystemObject` on a prefab's child, a networked component with no `NetworkSystemObject` at or above it, and a `NetworkHitboxRoot` that would record nothing. It loads every prefab, so it runs only when you ask. [Developer tools in the editor](../unity/diagnostics/developer-tools-in-unity.md#validating-your-networked-prefabs) lists each check.

### Rebuild Network Scene Manifest

Records the scene id, path and content bundle of every scene enabled in Build Settings, and of scenes marked Addressable when the Addressables package is installed, in `Assets/Resources/NetworkSceneManifest.asset`. A scene keeps its id across rebuilds; a new scene gets the next id above the highest recorded. A scene removed from the build keeps its entry, so its id is never reused.

### Build Content Bundles

Pro only. Runs the prefab collection and scene manifest rebuilds first, then builds every asset bundle a `NetworkPrefabCollection` is assigned to into `Assets/StreamingAssets`, and records each bundle's id and file name in `NetworkBundleManifest`.

## Run the rebuilds from a build script

The two rebuild steps are public static methods in the `Nucleus.Integrations.Unity.Editor` namespace, so an editor script or a CI job can run them without opening the Nucleus window.

| Method | Same as |
|---|---|
| `NetworkPrefabCollectionBuilder.Rebuild()` | **Rebuild Network Prefab Collection** |
| `NetworkSceneManifestBuilder.RebuildSceneManifest()` | **Rebuild Network Scene Manifest** |
| `NetworkSceneManifestBuilder.RebuildWithPrefabCollection()` | Both, prefab collection first, the order **Build Content Bundles** uses |

To run it from the command line, pass the method to Unity with `-executeMethod`:

```bash
Unity -batchmode -quit -projectPath <your project> -executeMethod Nucleus.Integrations.Unity.Editor.NetworkSceneManifestBuilder.RebuildWithPrefabCollection
```

If your CI fails a build on uncommitted changes, run this before that check. Anything the rebuild changes then shows up as a diff to commit, and the scene manifest rebuild before a player build finds nothing left to change.

## Some steps run on their own

- **Before every player build, a prefab check runs.** It fails the build when any networked prefab lacks the identity a rebuild would give it: no base collection, two collections sharing a prefab bundle, a prefab missing from its collection, a prefab its collection lists but a rebuild would leave out, a prefab with no id or a duplicated id, or a prefab stamped with a different bundle than its collection. The error lists every problem. Click **Rebuild** next to **Rebuild Network Prefab Collection** on the **Build** tab, then build every player you ship, server and client alike, again. The check never repairs prefabs itself.
- **Saving a scene assigns scene object ids.** A `NetworkSystemObject` whose `SceneObjectId` is unset or collides with another in the same scene gets the next free id; the first object holding a value keeps it.
- **A scene gets its id as soon as it enters the build.** The scene manifest updates when the Build Settings scene list changes, when a scene asset is imported, moved or deleted, when Addressables entries change, and right before a player build. It logs only when something changed.

## Know when to re-run a step

| Change | Step to run |
|---|---|
| Added, renamed, moved or duplicated a networked prefab | Rebuild Network Prefab Collection |
| Added or removed a scene from the build | Nothing. The scene manifest updates on its own; run Rebuild Network Scene Manifest by hand only if you want its log line confirming what mapped |
| Changed an asset bundle assignment (prefab or scene) | Rebuild Network Prefab Collection, then Build Content Bundles |
| Ready to ship the built asset bundles | Build Content Bundles (this also re-runs the prefab and scene rebuilds first) |

## Avoid two authoring traps

- **A duplicated prefab carries the original's id.** Until the next prefab collection rebuild, both share one prefab id. At runtime the first to register wins and the other logs an error, so spawning one can build the other, and player builds fail. Rebuild after every duplication. The rebuild keeps the id on the original, gives the copy a new one, and logs a warning.
- **A scene object id only has to be unique within its scene.** The same id in two different scenes is fine.

## Scene reference fields show the resolved id

A `NetworkSceneReference` field is drawn as a scene-asset picker, with the scene id it resolves to shown read-only beside it, looked up in the scene manifest each time.

## The Nucleus inspectors add checks and readouts

- Every `NucleusBehaviour` shows its linked system, started state, id, state and control while playing.
- A `UnitySceneLoader` warns when no scene manifest is assigned, and a `UnityAssetBundleLoader` warns when no bundle manifest is assigned.
- A `NetworkCorrectionVisualizer` shows its flash count and the size of the last correction while playing.
- A `NetworkInterestOverlay` shows its options only while it is switched on, with a key to its colors.
