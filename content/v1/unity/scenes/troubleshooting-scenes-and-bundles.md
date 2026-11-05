---
title: "Scenes and bundles: things that look broken"
---

## A client connects and sees nothing

A client that is never placed in a scene, by join placement or by `TryRequestSceneLoad`, sees nothing. Check:

- **`SceneManager.JoinPlacement`.** The default, `JoinScenePlacement.EveryOpenScene`, places a joining client in every open scene. `JoinScenePlacement.None` places nobody, and `JoinScenePlacement.GlobalScenes` skips scenes opened with `SceneScope.Connections`.
- **When the scene opened.** Join placement runs once, when the client authenticates, and covers only the scenes open then. A `SceneScope.Connections` scene opened after the client joined is never pushed to it, so call `TryRequestSceneLoad` for that client. Opening a `SceneScope.Global` scene places every connected client.

## Objects appear in the wrong copy of a stacked scene

Stacked copies share a name and path, so `GetSceneByName` and `GetSceneByPath` cannot tell them apart. Resolve the handle with `UnitySceneManager.TryGetScene`, and make that scene active, or pass it to `MoveGameObjectToScene`, before spawning into it. A handle is never reused, so the handle is not the cause: the spawner instantiated while the wrong scene was active, or moved the wrong copy.

A parented object shows the same symptom for another reason. Unity only moves root GameObjects between scenes, so Nucleus refuses to move an object with a parent, leaves it in its parent's scene and logs an error naming the parent. Un-parent the object, or move its parent instead.

## A load never completes

Two different timeouts cause this:

- **On the server**, `SceneManager.LoadRequestTimeoutSeconds` (default 180 seconds; zero or less waits indefinitely) is how long it waits for a client to answer a scene load request. When it runs out, the server treats the load as failed, logs a warning naming the scene handle and the timeout, and raises `ClientSceneLoadFailed`.
- **On the client**, a custom `ISceneLoader.LoadSceneAsync` must return: `true` when the scene loaded, `false` when it failed. Nucleus reports the result to the server for you. A loader that awaits something that never resolves hangs until the server's timeout.

If the load is stuck on the client with no timeout firing at all, check that your loader's `LoadSceneAsync` returns.

## A load comes back as `Refused` rather than `Failed`

- **`SceneLoadOutcome.Refused`**: the client's `ISceneLoader.MaximumConcurrentScenes` was already reached, so the loader was never asked. Asking again hits the same limit. Move the client with `SceneReplaceMode.AllScenes` instead, so it releases what it holds first.
- **`SceneLoadOutcome.Failed`**: the loader was asked and the load did not work. The content would not fetch, the scene would not resolve, or the load threw. Ask for it again with `SceneManager.TryClearSceneLoadFailure`.

## A client is kicked during scene or bundle traffic

Four violations cover a client trying to drive placement or content that only the server may drive. All default to a kick. A well-behaved client cannot raise any of them, so one means a modified or malicious client, not a race.

| Violation | Raised when a client | Carries |
|---|---|---|
| `UnsolicitedSceneReportViolation` | Reports a scene load or release the server never asked for, including any report for the unset scene handle. | `SceneHandle`, `IsLoadReported` (true for a load, false for a release) |
| `UnexpectedSceneRequestViolation` | Sends a scene load request, which only travels server to client. | `SceneHandle`, `IsLoadRequested` |
| `UnsolicitedBundleReportViolation` | Reports a bundle load or unload the server never asked for, or does not record it holding. | `BundleId`, `IsLoadReported` |
| `UnexpectedBundleRequestViolation` | Sends the server a bundle load request, which only the server sends. | `BundleId` |

## Prefabs silently never spawn for one client

`BundleInterestCondition` withholds a `NetworkSystem`'s spawn from a `Connection` until that client holds the content bundle its prefab shipped in (`NetworkSystem.RequiredBundleId`). No error is logged; the object just does not exist there yet. It does not apply to scene objects, to the base build (`Connection.BaseBuildBundleId`), or to a host's own local or loopback connection.

With `BundleManager.AutomaticRequestOnBlockedSpawnEnabled` on, a withheld spawn calls `BundleManager.RequestBundleLoad` for that connection and bundle. With it off, the spawn stays withheld until the client gets the bundle some other way.

Check whether the client holds the bundle (`Connection.IsBundleLoaded`) and whether automatic requesting is on.

## A load brings a world back missing objects

Missing objects after a world load mean a lookup failed, not that the save is corrupted. Each failure is logged and skipped, so check the log for the scene id or system type it names.

- **A saved scene's `sceneId` no longer resolves.** `WorldPersistenceManager` reopens each saved scene, and if that fails, `IWorldStore.OnSceneUnavailable` decides: abandon the whole load (logged as "the world is empty rather than half built"), or drop that scene's objects and continue.
- **A saved object no longer resolves.** A scene object is looked up in the restored scene by `WorldSystemIdentity.PlatformId`. A constructed object is looked up by `WorldSystemIdentity.SystemTypeName` through `NetworkTypeRegistry.TryCreateSystemByName`. An object with no match is dropped and logged as not found.

## A duplicated prefab or scene object keeps the original's id

Copying an object copies its stamped id, and two objects sharing an id can make a spawn resolve to the wrong one.

- **Scene object:** save the scene. The first occurrence of each `SceneObjectId` keeps it and a later duplicate gets the next free value. Until you save, the duplicate keeps the copied id.
- **Prefab:** the id is stamped on the prefab asset, and saving does not change it. In the Nucleus window (**Tools > Nucleus**), select the **Build** tab and click **Rebuild** next to **Rebuild Network Prefab Collection**. The original keeps its id, and the copy, or a prefab variant that inherited its base's id, gets the next free one. Then rebuild both the server and client builds so every peer has the same ids.

A player build made before the rebuild fails and lists the clash, and registering two prefabs that share an id logs an error naming both, so the problem shows in the Console rather than as a wrong spawn.
