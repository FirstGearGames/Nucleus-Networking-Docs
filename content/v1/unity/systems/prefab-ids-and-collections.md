---
title: "Prefab identity and the prefab collection"
---

## Rebuild the prefab collection after changing networked prefabs

You never assign prefab identity by hand. In the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Prefab Collection** whenever you:

- add a networked prefab,
- delete a networked prefab, or
- change a prefab's asset bundle assignment.

The rebuild finds every prefab with a `NetworkSystemObject`, groups them by the asset bundle Unity has them assigned to, and writes one `NetworkPrefabCollection` per group. The collection with no asset bundle (the one under `Resources`) is the base build's; a collection assigned to asset bundle `x` holds the prefabs assigned to `x`.

The rebuild leaves out Nucleus's own test prefabs, because their scripts are not in a player build. To leave out your own prefabs, such as test prefabs, drag their folders into **Excluded Folders** under the rebuild button, then rebuild. The list is saved in `ProjectSettings`, so it never ships in a build.

The rebuild stamps each prefab's `NetworkSystemObject` with a local prefab id and its collection's bundle id. This `(bundle id, local id)` pair is the prefab's identity on every peer. Every machine that rebuilds from the same assets gets the same result, and a rebuild never renumbers a prefab that already has a unique id, so adding a prefab never changes the id of one that already shipped.

## Fix a duplicated prefab id

Duplicating a prefab in the Project window copies its stamped id, so the copy has the same identity as the original and a spawn of one can build the other.

A player build fails while any networked prefab has an identity a rebuild would change, and the build error lists each problem:

- a missing base collection,
- two collections resolving to the same prefab bundle,
- a prefab missing from its collection,
- a prefab its collection lists but a rebuild would leave out, such as one in an excluded folder,
- a prefab with no id, or with an id another prefab holds,
- a prefab stamped with a different bundle than its collection.

To find these without building, click **Validate** next to **Validate Network Prefabs** on the **Build** tab (see [Developer tools in the editor](../diagnostics/developer-tools-in-unity.md#validating-your-networked-prefabs)).

To fix them:

1. Click **Rebuild** next to **Rebuild Network Prefab Collection**. The prefab the collection already lists keeps the shared id, and the copy gets a new one. A warning names the renumbered prefab, the prefab that held the id, and the new id.
2. Rebuild both the server and the client builds so every peer agrees.

If a clash reaches runtime, `NetworkPrefabRegistry.Register` keeps the first prefab registered under the identity and logs an error naming both prefabs.

## Register a collection when its content loads

`NetworkPrefabCollection` is a `ScriptableObject` listing the networked prefabs one content shard ships. The rebuild writes these for you; you can also create one from **Assets > Create > Nucleus > Network Prefab Collection**.

- **Prefabs**: the networked prefabs this shard ships.
- **PrefabBundleId**: the bundle id this shard registers its prefabs under. Zero is the base build's shard.
- **BundleAssemblyName**: the name of the assembly whose `NetworkBundle` attribute supplies the bundle id. Empty means the base build's shard.

Call `RegisterAll()` when the shard's content loads, and `UnregisterAll()` when it unloads. A prefab with an unset id logs an error and is skipped. The base build ships bundle zero; every other shard needs a unique `NetworkBundle` id on its assembly so separately built content never collides.

## Look up prefabs in the registry

`NetworkPrefabRegistry` maps a prefab's identity to the prefab a client instantiates. Collections fill it as they load and empty it as they unload.

- `EnsureClaimBundle(bundleId, collection)` claims a bundle id for a collection before its prefabs register. Claiming a bundle id another loaded collection owns is an error.
- `Register(bundleId, localId, prefab)` adds a prefab under its identity.
- `TryGet(bundleId, localId, out prefab)` finds the prefab registered for an identity.
- `TryGetPredictedSpawnPolicy(bundleId, localId, out predictedSpawnPolicy)` finds what a client may do to that prefab ahead of the server.
- `ReleaseBundle(bundleId, collection)` releases a bundle id when its collection unloads.
