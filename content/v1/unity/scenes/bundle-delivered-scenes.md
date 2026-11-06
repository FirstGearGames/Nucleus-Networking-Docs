---
title: "Addressables-delivered scenes"
---

Each `NetworkSceneManifest.SceneEntry` in the [network scene manifest](./network-scene-manifest.md) has a `SceneDeliveryMode`, taken from the project:

- `SceneDeliveryMode.BuildSettings`: the scene ships in the player and is opened by path. Every scene not marked Addressable uses this.
- `SceneDeliveryMode.Addressables`: the scene is opened through Addressables, which fetches whatever carries it.

Nothing else about a scene's setup differs. An Addressables scene loads additively like any other, and the loader's **Local Physics** setting applies the same way. Loading a scene through Addressables works in any edition; only fetching content from an asset bundle needs Pro.

## Deliver a scene through Addressables

1. Install `com.unity.addressables` 1.19 or newer. The integration then sets the `NUCLEUS_ADDRESSABLES` define for you; without it, the Addressables path in `UnitySceneLoader` is compiled out.
2. Mark the scene Addressable, in whatever group and address your project uses. Keep the group's **Internal Asset Naming Mode** at Full Path (see below).
3. Rebuild the manifest. It rebuilds itself when Addressables entries change; to run it yourself, open the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Scene Manifest**. The scene's entry records `SceneDeliveryMode.Addressables`.

## Do not put scenes in asset bundles

The manifest rebuild always gives a scene the base build's bundle id (`Connection.BaseBuildBundleId`), so a scene entry's `RequiredBundleId` never points at an asset bundle. If a networked scene has any asset bundle name, including the same one as a `NetworkPrefabCollection`, the rebuild logs an error and maps the scene as base build anyway, so it still loads from the player. Scenes that are neither in the build nor Addressable are not networked and are ignored. Use Addressables to stream a scene's content ahead of the load.

## A failed Addressables load does not throw

A failed Addressables load does not throw or fault the task: an unresolvable key returns a handle that is already complete with a failed status. `UnitySceneLoader` checks that status and logs an error telling you to check that the scene is marked Addressable and its content is built. A loader subclass that calls Addressables itself must check the status the same way, or it will treat a failed load as a success.

The loader also checks that the loaded scene's path matches the entry's `ScenePath`. A group set to GUID or Dynamic naming fails this check, with an error telling you to set the group's Internal Asset Naming Mode to Full Path.
