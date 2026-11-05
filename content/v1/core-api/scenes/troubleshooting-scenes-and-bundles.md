---
title: "Scenes and bundles: things that look broken"
---

## A client connects and sees nothing

1. Check `SceneManager.JoinPlacement`. The default, `JoinScenePlacement.EveryOpenScene`, places a new client in every open scene with no `TryRequestSceneLoad` call. Under `JoinScenePlacement.None` nobody is placed automatically, and under `JoinScenePlacement.GlobalScenes` scenes opened `SceneScope.Connections` are skipped. A client that is never asked into a scene with `TryRequestSceneLoad` sees nothing in it.
2. Check when the scene opened. Join placement runs once, when the client authenticates, and covers only the scenes open then. A `SceneScope.Connections` scene opened later must be requested for clients already connected. A `SceneScope.Global` scene places every connected client when it opens.

## Objects appear in the wrong copy of a stacked scene

Every copy of a stacked scene has the same name and path, so `GetSceneByName` and `GetSceneByPath` cannot tell them apart. Resolve the handle with `UnitySceneManager.TryGetScene`, and make that `Scene` active, or pass it to `MoveGameObjectToScene`, before spawning into it.

Handles are never reused, so the handle is not the cause. Look at the spawner: it instantiated while the wrong Unity scene was active, or moved the wrong copy.

A parented object shows the same symptom. Unity only moves root GameObjects between scenes, so an object with a parent is refused, stays in its parent's scene, and an error naming the parent is logged. Un-parent the object, or move its parent instead.

## A load never completes

- **Server side**: `SceneManager.LoadRequestTimeoutSeconds` (default 180; zero or less waits forever) is how long the server waits for a client's answer. When it expires, the server logs a warning naming the scene handle and the timeout, treats the load as failed, and raises `ClientSceneLoadFailed`.
- **Client side**: a custom `ISceneLoader.LoadSceneAsync` must return `true` or `false`, and Nucleus reports the result for you. One that awaits something that never resolves hangs until the server's timeout. A game that loads scenes itself, without a registered loader, must report through `SceneManager.NotifySceneLoaded` or `NotifySceneLoadFailed`.

## A load comes back as `Refused` rather than `Failed`

- `SceneLoadOutcome.Refused`: the client's `ISceneLoader.MaximumConcurrentScenes` was already reached, so the loader was never called. Asking again hits the same limit. Move the client with `SceneReplaceMode.AllScenes` so it releases what it holds first.
- `SceneLoadOutcome.Failed`: the loader was called and the load did not work. The content would not fetch, the scene would not resolve, or the load threw. Clear it with `SceneManager.TryClearSceneLoadFailure` and ask again.

## A client is kicked during scene or bundle traffic

Four violations, all defaulting to a kick, catch a client trying to drive placement or content that only the server may drive. A well-behaved client cannot cause any of them, so one means a modified or malicious client, not a race.

- **`UnsolicitedSceneReportViolation`**: the client reported a scene load or release the server never asked for. Carries `SceneHandle` and `IsLoadReported` (true for a claimed load, false for a claimed release). A report about the unset scene handle counts too, because it is never requested.
- **`UnexpectedSceneRequestViolation`**: the client sent a scene load request, a message that only travels server to client. Carries `SceneHandle` and `IsLoadRequested`.
- **`UnsolicitedBundleReportViolation`**: the client reported a bundle load the server never asked for, or an unload of a bundle the server does not record it holding. Carries `BundleId` and `IsLoadReported`.
- **`UnexpectedBundleRequestViolation`**: the client sent the server a bundle load request, which only the server sends. Carries `BundleId`.

## Prefabs silently never spawn for one client

`BundleInterestCondition` withholds a spawn from a client until it holds the object's bundle (`NetworkSystem.RequiredBundleId`). No error is logged; the object just does not exist there yet. It does not withhold scene objects, base-build content (`Connection.BaseBuildBundleId`), or a host's own local or loopback connection.

With `BundleManager.AutomaticRequestOnBlockedSpawnEnabled` on, the withheld spawn calls `BundleManager.RequestBundleLoad` for that client and bundle. With it off, nothing asks the client, and the spawn stays withheld until the client gets the bundle another way.

Check `Connection.IsBundleLoaded` for that client, and whether automatic requests are on.

## A load brings a world back missing objects

The save is not corrupt. One of two lookups failed, and each failure is logged and skipped rather than aborting the load. Check the log for the scene id or system type it names:

- **A saved scene id the manifest no longer resolves.** `IWorldStore.OnSceneUnavailable` decides: drop that scene's objects and continue, or abandon the whole load (logged as "the world is empty rather than half built").
- **A saved object that no longer resolves.** A scene object whose `WorldSystemIdentity.PlatformId` is not found in the restored scene is dropped and logged as not found. A constructed object whose `WorldSystemIdentity.SystemTypeName` is no longer registered (`NetworkTypeRegistry.TryCreateSystemByName` fails) is dropped the same way.

## A duplicated prefab or scene object keeps the original's id

In Unity, copying an object copies its stamped id, and two objects sharing an id collide.

**Scene objects**: saving the scene keeps the first occurrence of each `SceneObjectId` and gives any duplicate the next free id. Until you save, the duplicate keeps the copied id.

**Prefabs**: the id is stamped on the prefab asset, and saving does not change it. To renumber:

1. In the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Prefab Collection**. The original keeps its id because the collection already lists it. The copy, or a prefab variant that inherited its base's id, gets the next free id.
2. Rebuild both the server and the client builds so every peer has the same ids.

A player build made before the rebuild fails and lists the clash. Registering two prefabs that share an id logs an error naming both.
