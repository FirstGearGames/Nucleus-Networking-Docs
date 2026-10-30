---
title: "Editor menus and authoring tools"
---

## The Nucleus window

Nucleus adds a single menu entry, **Tools > Nucleus**. It opens the Nucleus window, or focuses it when it is already open, on whichever tab it showed last. The banner at the top names the edition (Pro or Free) and shows the role of the running peer: Host, Server, Client or Stopped while playing, and Edit mode outside play mode. Below the banner are four tabs.

**Traffic** is the live readout of the running session. It shows the tick rate, bandwidth sent and received with a one-minute graph, connection and spawn counts, the latency and packet loss of each connection, and simulated network conditions, with buttons that start and stop the server and the client. [Developer tools in the editor](../unity/diagnostics/developer-tools-in-unity.md#the-traffic-tab) describes each readout.

**Setup** checks the open scene and offers a one-click fix for each item that fails. It checks that a `UnityCoreManager` is in the scene (**Create** adds a GameObject carrying one, with its loop and transport managers and a Synapse transport), that a transport is under that manager (**Add Synapse**), that the network prefab collection and the network scene manifest are built (**Rebuild**), and that the open scene is in the build (**Add**). A **Validate Network Prefabs** button sits under the checklist. Once the scene has a `UnityCoreManager`, the tab also shows its **Tick Rate**, which cannot change during play, and **Start On Play**, which decides how the session starts by itself when play begins.

**Build** holds the steps that rebuild or check the project's network assets, one row each with a button that runs it: Rebuild Network Prefab Collection, Rebuild Network Scene Manifest and Validate Network Prefabs, plus Build Content Bundles in the Pro edition. Each step is described below.

**External Resources** opens the Nucleus website, this documentation, the demos guide and the public tracker for bug reports and feature requests in your browser. The demos guide opens only once the demos are imported into the project.

## The build steps

Three of the steps on the Build tab rebuild the project's network assets, and Validate Network Prefabs checks them without changing anything. None is a runtime action, and each runs only when you press its button. The log messages and dialogs Nucleus shows name each step by its full path, such as **Tools > Nucleus > Build > Rebuild Network Prefab Collection**.

### Rebuild Network Prefab Collection

Scans the project for every prefab whose root carries a `NetworkSystemObject`, groups them by the asset bundle they're assigned to, and writes each group's `NetworkPrefabCollection` asset. The collection with no asset bundle assignment is the base build's shard, stored under `Assets/Resources/NetworkPrefabCollection.asset` so it loads by name at runtime.

Each prefab is stamped with a local prefab id and a bundle id. Ids are assigned once and then preserved: a prefab that already carries a valid, unique id keeps it on every rescan. Only an unset or duplicated id gets the next free number for its shard. Ids restart at one per shard, because a prefab is identified by its bundle id and local id together, not by the local id alone.

A rebuild that renumbers a duplicated id says so: it logs a warning naming the prefab that carried the id, the prefab that already holds it, and the new id. It logs an error when two collections resolve to the same prefab bundle, because the second of them to load is refused at runtime; give each content bundle assembly its own `[NetworkBundle(n)]`.

### Validate Network Prefabs

Checks every prefab in the project and logs each problem against the prefab it names, without changing anything: the prefab identity problems a player build refuses (below), a `NetworkSystemObject` on a prefab's child, a networked component with no `NetworkSystemObject` at or above it, and a `NetworkHitboxRoot` that would record nothing. It runs only on request, because it loads every prefab. [Developer tools in the editor](../unity/diagnostics/developer-tools-in-unity.md#validating-your-networked-prefabs) lists each check.

### Rebuild Network Scene Manifest

Scans the scenes enabled in Build Settings (and, with the Addressables package installed, scenes marked Addressable) and records each one's scene id, path and content bundle in the project's `NetworkSceneManifest`, at `Assets/Resources/NetworkSceneManifest.asset`. A scene keeps its id across the rescan; only a scene the manifest has never seen gets a new one, assigned from the highest id already recorded. Removing a scene from the build leaves its manifest entry in place rather than deleting it, so its id is never handed to a different scene later.

### Build Content Bundles

This step is in the Pro edition only. It runs the prefab collection rebuild and the scene manifest rebuild first, then builds every asset bundle a `NetworkPrefabCollection` is assigned to into `Assets/StreamingAssets`, and fills in `NetworkBundleManifest` with each built bundle's id and file name. Running the two rebuilds first matters: a scene or prefab records the bundle id it ships under by reading the collection assigned to that bundle, so building from stale identity is what bakes the wrong id into a shipped bundle.

## The automatic steps

Three more steps run without a button press, so an author never has to remember to invoke them.

**A prefab check runs before every player build.** It makes the same identity check as Validate Network Prefabs, and fails the build when any networked prefab does not carry the identity a rebuild would give it: no base collection, two collections sharing a prefab bundle, a prefab missing from its collection, a prefab with no id or with an id another prefab holds, or a prefab stamped with a different bundle than its collection. The build error lists every problem and tells you to run **Tools > Nucleus > Build > Rebuild Network Prefab Collection**, then build again. It stops the build rather than repairing the prefabs itself, because a repair made in the middle of a build could number a server and a client that were built apart differently.

**Saving a scene assigns scene object ids.** Any `NetworkSystemObject` in the saved scene whose `SceneObjectId` is unset or collides with another object in the same scene gets a new id. The first object holding a value keeps it, and the rest get the next free id. Duplicating an object that already carries an id is exactly what creates a collision, since the copy carries the same id until the next save reassigns it.

**A scene gets its id the moment it enters the build.** The scene manifest is updated when the Build Settings scene list changes, when a scene asset is imported, moved or deleted, when the project's Addressables entries change, and once more right before a player build. It does the same work as **Tools > Nucleus > Build > Rebuild Network Scene Manifest**, but logs only when the scan changed something.

## When to re-run each step

| Change | Step to run |
|---|---|
| Added, renamed, moved or duplicated a networked prefab | Rebuild Network Prefab Collection |
| Added or removed a scene from the build | Nothing. The scene manifest updates on its own; run Rebuild Network Scene Manifest by hand only if you want its log line confirming what mapped |
| Changed an asset bundle assignment (prefab or scene) | Rebuild Network Prefab Collection, then Build Content Bundles |
| Ready to ship the built asset bundles | Build Content Bundles (this also re-runs the prefab and scene rebuilds first) |

## Two authoring traps

**A copied prefab carries the original's stamped id.** Duplicating a prefab asset in the Project window duplicates its `NetworkSystemObject` component, id and all. Until the next `Rebuild Network Prefab Collection`, the copy has the same prefab id as the original. At runtime the registry keeps whichever of the two registered first and logs an error for the other, so a spawn of one can build the other, and a player build fails until you rebuild. Rebuild after every prefab duplication, not just after adding a new prefab. The rebuild keeps the id on the prefab the collection already lists, which is the original, and on a base over its own variant, gives the copy the next free id, and logs a warning for each prefab it renumbers.

**A scene object id only has to be unique within its own scene.** Saving a scene reassigns collisions inside that scene, but the same id in two different scenes is fine and expected, because each scene's own id tells them apart. Don't assume a scene object id has to be globally unique across the project; it doesn't.

## Scene reference fields

A `NetworkSceneReference` field is drawn as a scene-asset picker, with the scene id it currently resolves to shown read-only beside it. The id is looked up in the project's scene manifest each time, so the readout always shows the current id.

## What the Nucleus inspectors add

Several Nucleus components have inspectors that check their settings while you author and show extra readouts while playing:

- Every `NucleusBehaviour` shows its linked system, started state, id, state and control while playing.
- A `UnitySceneLoader` warns when no scene manifest is assigned, and a `UnityAssetBundleLoader` warns when no bundle manifest is assigned.
- A `NetworkCorrectionVisualizer` shows its flash count and the size of the last correction while playing.
- A `NetworkInterestOverlay` shows its options only while it is switched on, with a key to its colors.
