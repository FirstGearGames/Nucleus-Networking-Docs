---
title: "Addressables-delivered scenes"
---

## What delivery mode means

Every scene the server can send a peer to is one row in the project's `NetworkSceneManifest`, built by `Nucleus/Rebuild Network Scene Manifest`. Each `NetworkSceneManifest.SceneEntry` carries a `SceneDeliveryMode`, derived from the project rather than chosen by hand:

- `SceneDeliveryMode.BuildSettings` — the scene ships inside the player and is opened by path. This is the default for any scene not marked Addressable, and it is what every scene mapped before delivery modes existed still reads as.
- `SceneDeliveryMode.Addressables` — the scene is an Addressables entry, opened through Addressables, which resolves and fetches whatever carries it.

Making a scene Addressable in the project and rebuilding the manifest is the whole of the change; nothing else in the scene's setup differs between the two modes.

## Why scenes don't ship in raw asset bundles

`SceneEntry` also has a `RequiredBundleId`, and `UnitySceneLoader.EnsureSceneContentAsync` does honor it if it's set to a non-base-build value — that plumbing exists. But the shipped tooling never actually produces a scene entry pointing at a raw asset bundle.

`NetworkSceneManifestBuilder`'s `ResolveLegacyBundleId` always resolves a scene's bundle id to `Connection.BaseBuildBundleId`, and logs an error instead if the scene's importer has an asset bundle name assigned. The reason is a Unity limitation: it cannot pack a scene and an asset into one bundle, and a scene-only bundle has no assembly to carry an identifier. If the build finds a scene assigned to the same asset bundle name as a `NetworkPrefabCollection`, or assigned to any asset bundle name at all, it reports the conflict and maps the scene as base build anyway, so the scene still loads correctly out of the player.

Net effect: for scene content, `RequiredBundleId` is never anything but the base build id. Addressables is the only supported way to stream a scene's content ahead of the load.

## Turning it on

1. Mark the scene Addressable in the project (its own group, address, whatever the project's Addressables setup calls for).
2. Rebuild the manifest with `Nucleus/Rebuild Network Scene Manifest`. The builder finds the scene among the project's Addressable GUIDs and records `DeliveryMode = SceneDeliveryMode.Addressables` for it.
3. Add the `NUCLEUS_ADDRESSABLES` scripting define symbol. The Addressables code path in `UnitySceneLoader` is compiled out without it.

The Addressables path itself ships in the non-Pro `UnitySceneLoader.cs`. It is not gated by edition — only fetching content out of an asset bundle is.

## How the load actually runs

`UnitySceneLoader.LoadSceneCoreAsync` resolves the manifest entry, then calls `EnsureSceneContentAsync(sceneEntry.RequiredBundleId)` before it does anything else — content has to be held before a scene can be loaded out of it. `EnsureSceneContentAsync` calls the protected `LoadSceneContentBundle` partial method hook.

Without the Pro assembly present, that hook has no implementation, so it does nothing and the load proceeds straight to the scene. `UnitySceneLoader.Bundles.Pro.cs` supplies the Pro implementation: for a scene whose `RequiredBundleId` is `Connection.BaseBuildBundleId` it also does nothing (the common, base-build case pays nothing), and only for a non-base-build id does it ask `CoreManager.BundleManager.LoadBundleAsync` to fetch the bundle. Since the manifest builder never assigns a scene a non-base-build id, this hook is a no-op for every scene in practice — Addressables content isn't fetched through it.

Once content is confirmed (or, for `BuildSettings` scenes, immediately), `LoadSceneCoreAsync` branches on `sceneEntry.DeliveryMode`. `SceneDeliveryMode.Addressables` routes to `LoadAddressableSceneCoreAsync`, which calls `Addressables.LoadSceneAsync` keyed by the scene's GUID (`sceneEntry.SceneGuid`), additive, with local physics settings carried over the same way the build-settings path does.

## The one gotcha: failed loads don't throw

A failed Addressables load does not throw and does not fault the returned task. An unresolvable key comes back as a handle that is already complete with a failed status. `LoadAddressableSceneCoreAsync` checks `loadAsyncOperationHandle.Status is not AsyncOperationStatus.Succeeded` explicitly and logs an error if so — that check is the only way the failure is ever noticed. Anything that calls into this path without checking the handle's status will treat a failed load as if it succeeded.

The same method also checks that the loaded scene's path matches the manifest's `ScenePath`, because Addressables names a scene by its asset path only while the group keeps the default internal naming; a group set to GUID or Dynamic naming breaks the match silently otherwise.
