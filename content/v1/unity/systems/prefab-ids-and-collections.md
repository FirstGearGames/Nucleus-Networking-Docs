---
title: "Prefab identity and the prefab collection"
---

## The prefab collection

`NetworkPrefabCollection` is a `ScriptableObject` that lists the networked prefabs a client can instantiate for a dynamic spawn before the prefab is otherwise in hand. Create one from **Assets > Create > Nucleus > Network Prefab Collection**.

Each collection is one content shard:

- **Prefabs** — the networked prefabs this shard ships, in deterministic order.
- **PrefabBundleId** — the bundle identifier this shard registers its prefabs under. Zero is the base build's default shard.
- **BundleAssemblyName** — the simple name of the assembly whose `NetworkBundle` attribute supplies this shard's bundle identifier. Empty means the base build's default shard.

`RegisterAll()` claims the shard's bundle identifier and registers every listed prefab into the runtime registry; call it when the shard's content loads. `UnregisterAll()` removes those prefabs and releases the bundle claim; call it when the content unloads. A prefab with an unset prefab identifier logs an error and is skipped instead of registering.

## Rebuilding the collection

Prefab identity is not something you assign by hand. Run **Nucleus > Rebuild Network Prefab Collection** and the editor does it for you.

The build step (`NetworkPrefabCollectionBuilder`) scans every prefab in the project for a `NetworkSystemObject`, groups the networked ones by the asset bundle Unity has them assigned to, and writes one shard's `NetworkPrefabCollection` per group. The collection with no asset bundle assignment (the one under `Resources`) owns the base build's shard; a collection assigned to asset bundle `x` owns the prefabs assigned to `x`. Nothing new has to be authored to express that membership — asset bundle assignment already decides it.

Within a shard, prefabs are ordered by asset GUID so every machine that scans the same assets produces the same ordering, then each prefab's `NetworkSystemObject` marker is stamped with a local prefab identifier and the shard's bundle identifier. Stamping is deterministic and does **not** renumber existing entries: an identifier a prefab already carries is kept as long as it is still unique within its shard, and only a new or colliding marker gets `highestPrefabId + 1`. Renumbering on every scan would mean adding one prefab silently repoints every prefab after it, so a content bundle built before the change would resolve to the wrong prefab against a client that rebuilt after it.

Run the rebuild whenever you:

- Add a new networked prefab.
- Delete a networked prefab.
- Change a prefab's asset-bundle assignment (moving it between shards).

## The runtime registry

`NetworkPrefabRegistry` is the runtime lookup from a prefab's wire identity to the prefab a client instantiates for a dynamic spawn. It is populated as each shard's collection loads and cleared as it unloads.

- `EnsureClaimBundle(bundleId, collection)` claims a bundle identifier for a collection before its prefabs register. A second collection trying to claim a bundle identifier already owned by a different loaded collection is an error.
- `Register(bundleId, localId, prefab)` adds a prefab under its `(bundle id, local id)` identity.
- `TryGet(bundleId, localId, out prefab)` resolves the prefab registered for an identity.
- `TryGetPredictedSpawnPolicy(bundleId, localId, out predictedSpawnPolicy)` resolves what a client may do to that prefab ahead of the server, from the policy recorded at registration.
- `ReleaseBundle(bundleId, collection)` releases a bundle identifier when its collection unloads.

The base build ships bundle zero. Each content shard claims and registers its own bundle identifier when its content loads, so separately built content never collides — as long as every shard declares a unique `NetworkBundle` identifier on its assembly.

## The duplicated-id trap

A prefab's identity is stamped onto the prefab asset itself, in the `NetworkSystemObject` marker's serialized fields. Duplicating a prefab in the Project window duplicates that stamp along with everything else, so the copy carries the *same* prefab identifier as the original.

Two prefabs sharing one identity is invisible until a spawn resolves the wrong one: the receiver looks the identity up in `NetworkPrefabRegistry` and instantiates whichever prefab last registered under it, not necessarily the one that was actually spawned.

Running **Nucleus > Rebuild Network Prefab Collection** fixes it: the rebuild keeps an id that is set and unique and gives a duplicate the next free local id for its shard. Prefabs are visited in asset GUID order, so whichever of the two sorts later is renumbered, and that can be the original. To keep the original's id, which matters once a build or content bundle has shipped with it, clear the copy's identifier to `0` before rebuilding; the rebuild treats zero as unstamped and stamps the copy fresh. The inspector shows Prefab Id read-only, so change the `_prefabId:` line in the copy's `.prefab` file with a text editor. Then rebuild both the server and the client builds so every peer agrees.

## Wire identity

A prefab's wire identity is the `(bundle id, local id)` pair stamped onto its `NetworkSystemObject` marker and used as the key into `NetworkPrefabRegistry`.
