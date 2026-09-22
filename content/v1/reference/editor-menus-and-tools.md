---
title: "Editor menus and authoring tools"
---

## The three menu commands

Nucleus adds three items under the `Nucleus` menu. Each one is a build step over the project's assets, not a runtime action.

### Nucleus/Rebuild Network Prefab Collection

Scans the project for every prefab whose root carries a `NetworkSystemObject`, groups them by the asset bundle they're assigned to, and writes each group's `NetworkPrefabCollection` asset. The collection with no asset bundle assignment is the base build's shard, stored under `Assets/Resources/NetworkPrefabCollection.asset` so it loads by name at runtime.

Each prefab is stamped with a local prefab id and a bundle id. Ids are assigned once and then preserved: a prefab that already carries a valid, unique id keeps it on every rescan. Only an unset or duplicated id gets the next free number for its shard. Ids restart at one per shard, because the runtime registry resolves a prefab by the `(bundle, local)` pair, not by the local id alone.

### Nucleus/Rebuild Network Scene Manifest

Scans the scenes enabled in Build Settings (and, with the Addressables package installed, scenes marked Addressable) and records each one's scene id, path and content bundle in the project's `NetworkSceneManifest`, at `Assets/Resources/NetworkSceneManifest.asset`. A scene keeps its id across the rescan; only a scene the manifest has never seen gets a new one, assigned from the highest id already recorded. Removing a scene from the build leaves its manifest entry in place rather than deleting it, so its id is never handed to a different scene later.

### Nucleus/Build Content Bundles

Runs the prefab collection rebuild and the scene manifest rebuild first, then builds every asset bundle a `NetworkPrefabCollection` is assigned to into `Assets/StreamingAssets`, and fills in `NetworkBundleManifest` with each built bundle's id and file name. Running the two rebuilds first matters: a scene or prefab records the bundle id it ships under by reading the collection assigned to that bundle, so building from stale identity is what bakes the wrong id into a shipped bundle.

## The two automatic stampers

Two more steps run without a menu command, so an author never has to remember to invoke them.

**`SceneNetworkObjectStamper`** runs on scene save. It assigns a `SceneObjectId` to any `NetworkSystemObject` in the saved scene whose id is unset or collides with another object in the same scene, keeping the first occurrence of any value it finds and handing the next free incremental id to the rest. Duplicating an object that already carries a stamped id is exactly what creates a collision, since the copy carries the same serialized id until the next save reassigns it.

**`NetworkSceneManifestAutoRebuild`** mints a scene id the moment a scene enters the build: when the Build Settings scene list changes, when a scene asset is imported, moved or deleted, when the project's Addressables entries change, and as a backstop right before a player build. It calls the same reconciliation the manual scene manifest rebuild uses, quietly.

## When to re-run each command

| Change | Command to run |
|---|---|
| Added, renamed, moved or duplicated a networked prefab | Rebuild Network Prefab Collection |
| Added or removed a scene from the build | Nothing to run manually — the auto-rebuild mints the scene id on its own; run the manual command only if you want the log line confirming what mapped |
| Changed an asset bundle assignment (prefab or scene) | Rebuild Network Prefab Collection, then Build Content Bundles |
| Ready to ship the built asset bundles | Build Content Bundles (this also re-runs the prefab and scene rebuilds first) |

## Two authoring traps

**A copied prefab carries the original's stamped id.** Duplicating a prefab asset in the Project window duplicates its `NetworkSystemObject` component, id and all. Until the next `Rebuild Network Prefab Collection`, the copy has the same prefab id as the original, and a receiver resolving that id will spawn the wrong one. Rebuild after every prefab duplication, not just after adding a new prefab.

**A scene object id only has to be unique within its own scene.** `SceneNetworkObjectStamper` reassigns collisions inside one scene, but the same id in two different scenes is fine and expected — the scene half of the correlation comes from the scene's own id, not from the object's. Don't assume a scene object id has to be globally unique across the project; it doesn't.

## Why every Nucleus inspector still shows the script row

A custom `[CustomEditor]` replaces Unity's whole default inspector, including the greyed-out script row that lets you ping or open the component's source. `NucleusInspectorGUI.DrawScriptField` redraws that row explicitly, and every Nucleus custom editor calls it before drawing anything else, so that row survives even though the rest of the inspector is custom-drawn. `NucleusInspectorGUI` also provides `DrawPropertiesWithoutScript` (the rest of the default inspector, minus the script row already drawn), plus two field-clamping helpers (`DrawClampedIntSlider`, `DrawNonNegativeLongField`) used by inspectors that need to correct an out-of-range serialized value without flattening a multi-object selection.

`NetworkSceneReferenceDrawer` is a property drawer, not a component inspector: it draws a `NetworkSceneReference` field as a scene-asset picker, with the scene id it currently resolves to (from the project's scene manifest) shown read-only beside it. Nothing about the id is stored on the reference itself — only the scene's GUID is — so the readout always reflects the current manifest rather than a baked-in number.

## The custom editors

Nineteen components have a `[CustomEditor]`, which is where to look for authoring-time validation and inspector-only readouts:

- `NucleusBehaviourBaseEditor` — covers every `NucleusBehaviourBase` subclass (`editorForChildClasses: true`); adds a runtime readout (linked system, started state, id, state, control) while playing.
- `UnitySceneLoaderEditor` — covers every `UnitySceneLoader` subclass; validates the assigned scene manifest and warns when none is set.
- `UnityAssetBundleLoaderEditor` — covers every `UnityAssetBundleLoader` subclass; validates the assigned bundle manifest and warns when none is set.
- `NetworkSystemObjectEditor`
- `NetworkTransformEditor`
- `NetworkAnimatorEditor`
- `NetworkNavMeshAgentEditor`
- `NetworkHostVisibilityEditor`
- `NetworkInterestObjectEditor`
- `NetworkPlayerSpawnerEditor`
- `UnityInterestManagerEditor`
- `UnityNetworkLoopManagerEditor`
- `UnityPhysicsManagerEditor`
- `UnitySceneManagerEditor`
- `UnitySystemManagerEditor`
- `PhysicsSimulationDriverEditor`
- `ProjectedRigidbodyEditor`
- `BlitzRelayTransportEditor`
- `SynapseTransportEditor`
