---
title: "Content bundles in Unity"
---

> **Driving the core API directly?** See [The content bundle protocol](../../core-api/scenes/content-bundle-protocol).

Content bundles let you ship a set of networked prefabs outside the base build and load them into a running game as an asset bundle. Clients that have not yet loaded a bundle simply do not receive spawns for the prefabs it ships — the server withholds them until the bundle is loaded and registered.

## Shard your prefabs

A shard is one `NetworkPrefabCollection` asset. Which prefabs belong to it is decided by Unity's own asset bundle assignment: the collection assigned to asset bundle `x` owns every networked prefab assigned to `x`, and the collection assigned to no bundle owns the prefabs assigned to none — the base build.

Each collection exposes:

- `PrefabBundleId` — the bundle identifier this shard's prefabs register under. You never author this directly; it is stamped at rebuild time from `BundleAssemblyName`.
- `BundleAssemblyName` — the simple name of the assembly whose `[assembly: NetworkBundle(n)]` attribute supplies the bundle identifier. Empty means the base build's default shard, bundle id `0`.

Each separately built assembly that ships its own content declares its own bundle identifier:

```csharp
[assembly: NetworkBundle(1)]
```

`NetworkBundleAttribute` is assembly-scoped (`AttributeUsage(AttributeTargets.Assembly)`). The main assembly defaults to bundle `0` when the attribute is absent. A named assembly that isn't loaded, or that carries no `NetworkBundleAttribute`, resolves to the default shard (bundle `0`) as well, with an editor error logged either way — so give every other bundle its own id rather than relying on that fallback.

## Build the shards

Two menu items, run in order:

1. **Nucleus > Rebuild Network Prefab Collection** scans the project for prefabs carrying a `NetworkSystemObject`, groups them by the asset bundle they're assigned to, and stamps each prefab's local `PrefabId` plus the shard's `PrefabBundleId`. Identifiers are preserved across rescans, never renumbered from position, so a bundle built before a change keeps resolving correctly against a client that rebuilt after it.
2. **Nucleus > Build Content Bundles** rebuilds the collections (so identity is never stale), builds every authored asset bundle into `Assets/StreamingAssets`, and then fills in the `NetworkBundleManifest` from what was actually produced.

If your project has no `NetworkBundleManifest` yet, the build creates one and reports where. If it finds more than one, it leaves them all alone and warns, because it can't tell which owns the content it just built — keep a single manifest so this step stays automatic.

## The manifest

`NetworkBundleManifest` maps the bundle identifiers the server names on the wire to the files a client loads them from:

- `Entries` — a list of `BundleEntry { BundleId, FileName }`.
- `RootDirectory` — the directory file names resolve against; falls back to `Application.streamingAssetsPath` when left unset, which is `Assets/StreamingAssets` in the editor and the shipped copy in a build.
- `TryGetBundlePath(ushort bundleId, out string path)` — resolves a bundle identifier to its full file path, combining `RootDirectory` with the matching entry's `FileName`.

You don't hand-author entries. **Build Content Bundles** writes them for you, upserting by identifier so an entry you keep for content loaded through some other pipeline survives.

## Load bundles at runtime

Add a `UnityAssetBundleLoader` component to a GameObject in your bootstrap scene and assign its **Bundle Manifest** field to your `NetworkBundleManifest` asset.

`UnityAssetBundleLoader` derives from `NetworkBundleLoader`, which self-registers as the CoreManager's bundle loader. With `_automaticRegistrationEnabled` on (the default), this happens in `Awake` by resolving the integration's `CoreManager`, so ordinary game code can request a bundle from its own `Start` and find a loader already registered. Turn that flag off and call `Initialize(CoreManager)` yourself if your game owns more than one `CoreManager` or constructs one later.

`UnityAssetBundleLoader.LoadBundleAsync(ushort bundleId)` resolves the file through the manifest, loads the Unity asset bundle, and registers every `NetworkPrefabCollection` it finds inside — all before the returned task completes, since completing tells the server this client may now be spawned into.

`TryGetBundlePath` on `UnityAssetBundleLoader` is `protected virtual` specifically so a project can override it to resolve a bundle's path from a patcher or a downloaded cache instead of `StreamingAssets`, while keeping the rest of the loader's behavior.

## Overriding a prefab's required bundle

Normally a prefab's required content is read straight from the shard it shipped in. Occasionally a prefab needs a different bundle than the one that ships it — content the editor scan couldn't stamp, or an object whose prefab ships in the base build while the assets it needs do not.

`NetworkSystemObject` exposes this as an override:

- **Required Bundle Override Enabled** (`_requiredBundleOverrideEnabled`) — turns the override on. Left off, the requirement comes from the prefab's own `PrefabBundleId`.
- **Required Bundle Id** (`_requiredBundleId`) — the bundle identifier required when the override is enabled.

`NetworkSystemObject.RequiredBundleId` resolves between the two: the override value when enabled, otherwise `PrefabBundleId`. This never changes the prefab's own wire identity — that stays `PrefabBundleId` paired with `PrefabId` — it only changes which bundle must be loaded before the server will spawn it.

## Pro only

Content bundles are a Pro feature. `CoreManager.BundleManager` lives in a Pro-only partial file; a Free build has no such field at all, and the runtime loaders (`NetworkBundleLoader`, `UnityAssetBundleLoader`) exist only to register against it. A Free project builds and ships without content bundles.
