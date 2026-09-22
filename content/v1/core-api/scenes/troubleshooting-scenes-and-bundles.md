---
title: "Scenes and bundles: things that look broken"
---

## A client connects and sees nothing

`SceneManager.JoinPlacement` decides what a newly authenticated client is put into, and its default, `JoinScenePlacement.EveryOpenScene`, is what most projects want without calling `RequestSceneLoad` anywhere. If `JoinPlacement` was set to `JoinScenePlacement.None`, or a scene was opened `SceneScope.Connections` rather than `SceneScope.Global`, no client is placed automatically, and a client that never receives a `RequestSceneLoad` call sees nothing.

The other cause is timing rather than configuration: a scene opened *after* a client already joined is not retroactively pushed to that client. Placement happens once, when the client authenticates. A client connected before a scene existed has to be asked for it explicitly.

Check `JoinPlacement`, the scope the scene was opened with, and whether the scene existed before the client connected.

## Objects appear in the wrong copy of a stacked scene

A stacked scene is one asset opened more than once, so every copy shares the same name and path — `GetSceneByName` and `GetSceneByPath` cannot tell them apart, only the scene handle can. `UnitySceneManager.TryGetScene` resolves a handle to the live Unity `Scene`, and that resolved scene is what has to be made active, or the target for `MoveGameObjectToScene`, before anything spawns into it.

The handle itself is never the cause: a handle is issued once per open scene instance and never reused across opens (`SceneManager.RemoveOpenScene`). If objects are landing in the wrong copy, look at the spawner instead — it instantiated while the wrong Unity scene was active, or it moved the wrong scene's copy.

A second, unrelated cause produces the same symptom for a parented object: `UnitySystemSpawnHandler.PlaceInScene` only moves a root `GameObject` between scenes, because that is the only kind of move Unity itself supports. An object with a parent is refused rather than moved and stays in its parent's scene — logged as an error naming the parent. Un-parent the object, or move its parent instead.

## A load never completes

Two different timeouts produce this, and they are not the same failure:

- `SceneManager.LoadRequestTimeoutSeconds` (default 180 seconds, zero or less waits indefinitely) is how long the authority waits for a client to answer a scene load request. If the client never answers, the authority treats it as a failure, logs a warning naming the scene handle and the timeout, and raises `ClientSceneLoadFailed`.
- On the client, nothing completes if the loader never calls back. A custom `ISceneLoader.LoadSceneAsync` implementation has to eventually call `SceneManager.NotifySceneLoaded` (or fail through `NotifySceneLoadFailed`) — a loader that awaits something that never resolves leaves the load hanging until the authority's own timeout catches it.

If the load is stuck client-side with no timeout firing at all, check that the loader in use actually reports back through `NotifySceneLoaded`.

## A load comes back as `Refused` rather than `Failed`

`SceneLoadOutcome.Refused` means the client's `ISceneLoader.MaximumConcurrentScenes` was already at its limit — the loader was never consulted, because the request was rejected before it got there. `SceneLoadOutcome.Failed` means the loader was asked and the load itself did not work: the content would not fetch, the scene would not resolve, or the load threw.

The two are deliberately distinct outcomes because the remedy differs. A `Failed` load can just be asked for again with `SceneManager.ClearSceneLoadFailure`. A `Refused` load cannot — asking again hits the same limit — the client has to be moved with `SceneReplaceMode.AllScenes` instead, so it releases what it holds before taking on the new one.

## A client is kicked during scene or bundle traffic

Four violations cover unexpected scene and bundle messages, and all default to a kick:

- **`UnsolicitedSceneReportViolation`** — a client reported a scene load or release the authority never asked for. Carries `SceneHandle` and `IsLoadReported` (true for a claimed load, false for a claimed release).
- **`UnexpectedSceneRequestViolation`** — a client sent a scene load request, a message that only ever travels authority to client. Carries `SceneHandle` and `IsLoadRequested`.
- **`UnsolicitedBundleReportViolation`** — a client reported a bundle load or unload the server never asked for, or does not record it holding. Carries `BundleId` and `IsLoadReported`.
- **`UnexpectedBundleRequestViolation`** — a client sent the server a bundle load request, a message that only the server sends. Carries `BundleId`.

All four are a client trying to drive placement or content that only the authority is allowed to drive. A well-behaved client cannot produce any of them, so seeing one means a modified or malicious client, not a legitimate race — including the unset scene handle, which is never requested and never recorded held, and which reports as unsolicited too.

## Prefabs silently never spawn for one client

`BundleInterestCondition` withholds a `NetworkSystem`'s spawn from a `Connection` until that client holds the content bundle its prefab shipped in (`NetworkSystem.RequiredBundleId`), so the spawn is never delivered to a peer that cannot instantiate it — no error, the object just does not exist there yet. It abstains for a scene object (already bound rather than instantiated), for the base build (`Connection.BaseBuildBundleId`), and for a host's own local or loopback connection.

Whether the client is ever told to fetch the missing bundle depends on `BundleManager.AutomaticRequestOnBlockedSpawnEnabled`. When it is on, the withheld spawn triggers `BundleManager.RequestBundleLoad` for that connection and bundle automatically. When it is off, nothing asks the client for the bundle — the spawn stays withheld until the client is given the bundle some other way. If an object is missing for exactly one client and no error appears, check whether that client holds the required bundle (`Connection.IsBundleLoaded`) and whether automatic requesting is enabled.

## A load brings a world back missing objects

Two different lookups can fail on a world load, and each is logged and skipped rather than aborting the whole load:

- A saved scene instance names a `sceneId` the manifest no longer resolves. `WorldPersistenceManager` calls `SceneManager.OpenSavedSceneAsync` for each saved scene; if it fails, `IWorldStore.OnSceneUnavailable` decides what happens — either the whole load is abandoned (logged as "the world is empty rather than half built"), or the objects in that scene are dropped and the rest of the load continues.
- A saved object's identity no longer resolves. For a scene object, `WorldSystemIdentity.PlatformId` is looked up in the restored scene with `SystemManager.TryBindRestoredSceneObject`; if nothing matches, that object is dropped and logged as not found. For a constructed object, `WorldSystemIdentity.SystemTypeName` is looked up with `NetworkTypeRegistry.TryCreateSystemByName`; a type no longer registered in this build is dropped the same way.

Missing objects after a load are one of these two lookups failing, not a corrupted save — check the log for which scene id or system type it named.

## In Unity: a duplicated prefab or scene object carrying a copied stamped id

Copying an object that already carries a stamped id copies the id with it, and two objects sharing one id is a correlation collision.

For scene objects, `SceneNetworkObjectStamper` runs on every scene save: it keeps the first occurrence of each `SceneObjectId` and reassigns any later duplicate to the next free value, so a duplicated scene object gets a fresh id automatically the next time the scene is saved. Until that save happens, the duplicate still carries the copied id.

For a duplicated prefab, the network id is stamped onto the prefab asset itself, so copying the prefab duplicates its id along with it and a spawn built from the copy resolves to the wrong object. There is no equivalent automatic re-stamp for a prefab copy — clear the copied prefab's stamped id and let it be reassigned.
