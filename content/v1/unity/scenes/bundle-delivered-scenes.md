---
title: "Addressables-delivered scenes"
---

## What delivery mode means

Every scene the server can send a peer to is one row in the project's `NetworkSceneManifest`, built by `Nucleus/Rebuild Network Scene Manifest`. Each `NetworkSceneManifest.SceneEntry` carries a `SceneDeliveryMode`, derived from the project rather than chosen by hand:

- `SceneDeliveryMode.BuildSettings` — the scene ships inside the player and is opened by path. This is the default for any scene not marked Addressable, and it is what every scene mapped before delivery modes existed still reads as.
- `SceneDeliveryMode.Addressables` — the scene is an Addressables entry, opened through Addressables, which resolves and fetches whatever carries it.

Making a scene Addressable in the project and rebuilding the manifest is the whole of the change; nothing else in the scene's setup differs between the two modes.

## Why scenes don't ship in raw asset bundles

`SceneEntry` also has a `RequiredBundleId`, but the shipped tooling never produces a scene entry pointing at a raw asset bundle.

Rebuilding the manifest always gives a scene the bundle id `Connection.BaseBuildBundleId`, and logs an error if the scene's importer has an asset bundle name assigned. The reason is a Unity limitation: it cannot pack a scene and an asset into one bundle, and a scene-only bundle has no assembly to carry an identifier. If the build finds a scene assigned to the same asset bundle name as a `NetworkPrefabCollection`, or assigned to any asset bundle name at all, it reports the conflict and maps the scene as base build anyway, so the scene still loads correctly out of the player. This applies only to scenes the build ships or the project has made Addressable. A scene in neither is not networked and is ignored, whatever asset bundle name it carries.

Net effect: for scene content, `RequiredBundleId` is never anything but the base build id. Addressables is the only supported way to stream a scene's content ahead of the load.

## Turning it on

1. Mark the scene Addressable in the project (its own group, address, whatever the project's Addressables setup calls for).
2. Rebuild the manifest with `Nucleus/Rebuild Network Scene Manifest`. The builder finds the scene among the project's Addressable GUIDs and records `DeliveryMode = SceneDeliveryMode.Addressables` for it.
3. Make sure `com.unity.addressables` 1.19 or newer is installed. The integration's assembly definition then sets the `NUCLEUS_ADDRESSABLES` define for you through a `versionDefines` entry, so there is no scripting define symbol to add by hand. The Addressables code path in `UnitySceneLoader` is compiled out without it.

Loading a scene through Addressables is not gated by edition. Only fetching content out of an asset bundle needs Pro.

An Addressables scene loads additively, the same as a build-settings scene, and the loader's **Local Physics** setting applies to it the same way.

## The one gotcha: failed loads don't throw

A failed Addressables load does not throw and does not fault the returned task. An unresolvable key comes back as a handle that is already complete with a failed status. The loader checks that status itself and logs an error telling you to check that the scene is marked Addressable and that its content has been built. A loader subclass that calls Addressables itself has to check the handle's status the same way, or it will treat a failed load as if it succeeded.

The loader also checks that the loaded scene's path matches the manifest's `ScenePath`, because Addressables names a scene by its asset path only while the group keeps the default internal naming. A group set to GUID or Dynamic naming fails the load with an error telling you to set the group's Internal Asset Naming Mode to Full Path.
