---
title: "Content bundles in Unity"
---

> **Driving the core API directly?** See [The content bundle protocol](../../core-api/scenes/content-bundle-protocol.md).

Content bundles ship networked prefabs outside the base build, as asset bundles loaded into a running game. The server withholds spawns of a bundle's prefabs from a client until that client has loaded the bundle.

Content bundles need Pro. A Free build has no `CoreManager.BundleManager`, and the runtime loaders (`NetworkBundleLoader`, `UnityAssetBundleLoader`) exist only to register with it.

## Shard your prefabs

A shard is one `NetworkPrefabCollection` asset. Unity's asset bundle assignment decides what it holds: the collection assigned to asset bundle `x` owns every networked prefab assigned to `x`, and the collection assigned to no bundle owns the prefabs assigned to none, which is the base build.

Each collection has:

- `BundleAssemblyName`: the simple name of the assembly whose `[assembly: NetworkBundle(n)]` attribute supplies the bundle id. Empty means the base build, bundle `0`.
- `PrefabBundleId`: the bundle id this shard's prefabs register under. It is stamped from `BundleAssemblyName` when the collection is rebuilt, so never set it yourself.

Give each separately built assembly that ships its own content its own bundle id:

```csharp
[assembly: NetworkBundle(1)]
```

The main assembly is bundle `0` without the attribute. A named assembly that is not loaded, or carries no `NetworkBundleAttribute`, also falls back to bundle `0` and logs an editor error, so do not rely on that fallback.

## Build the shards

In the Nucleus window (**Tools > Nucleus**), select the **Build** tab, then:

1. Click **Rebuild** next to **Rebuild Network Prefab Collection**. It groups every prefab carrying a `NetworkSystemObject` by its asset bundle, and stamps each prefab's `PrefabId` and its shard's `PrefabBundleId`. Ids are kept across rebuilds, so a bundle built before a change still resolves on a client built after it.
2. Click **Build** next to **Build Content Bundles**. It rebuilds the collections, builds every asset bundle into `Assets/StreamingAssets`, and fills in the `NetworkBundleManifest` from what it built.

If the project has no `NetworkBundleManifest`, the build creates one and reports where. If it finds more than one, it changes none of them and warns, so keep exactly one.

## The bundle manifest maps bundle ids to files

`NetworkBundleManifest` has:

- `Entries`: a list of `BundleEntry { BundleId, FileName }`. **Build Content Bundles** writes them, replacing entries by id, so an entry you keep for content loaded through another pipeline survives.
- `RootDirectory`: the directory file names resolve against. When unset it is `Application.streamingAssetsPath`, which is `Assets/StreamingAssets` in the editor and the shipped copy in a build.
- `TryGetBundlePath(ushort bundleId, out string path)`: the full file path for a bundle id.

## Load bundles at runtime

1. Add a `UnityAssetBundleLoader` component to a GameObject in your bootstrap scene.
2. Set its **Manifest** field to your `NetworkBundleManifest` asset.

With **Auto Register** on (the default), the loader registers with the integration's `CoreManager` in `Awake`, so your own code can request a bundle from `Start`. Turn it off and call `Initialize(CoreManager)` yourself if your game has more than one `CoreManager` or creates one later.

`UnityAssetBundleLoader.LoadBundleAsync(ushort bundleId)` loads the bundle and registers every `NetworkPrefabCollection` inside it before its task completes. To load bundles from a patcher or download cache instead of `StreamingAssets`, override its `protected virtual` `TryGetBundlePath`.

## Override a prefab's required bundle

Use the override when a prefab needs a different bundle than the one that ships it, such as content the editor scan could not stamp, or a prefab that ships in the base build while the assets it needs do not. On the `NetworkSystemObject`:

- **Override Required Bundle**: turns the override on. When off, the required bundle is the prefab's own `PrefabBundleId`.
- **Required Bundle Id**: the bundle a client must hold before the object spawns for it. Shown only while the override is on.

`NetworkSystemObject.RequiredBundleId` returns the override when it is on, otherwise `PrefabBundleId`. The prefab's identity, `PrefabBundleId` paired with `PrefabId`, does not change.
