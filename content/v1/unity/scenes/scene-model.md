---
title: "How networked scenes work"
---

## Three identifiers, never conflated

A networked scene involves three different numbers, and mixing them up is the most common source of confusion:

- **Scene id** (`ushort`) — which scene asset. The same id always resolves to the same content, through whatever `ISceneLoader` is registered.
- **Scene handle** (`uint`) — which live instance of that asset. Opening the same scene id twice gives two handles and two independent worlds.
- **Scene object id** (`uint`) — which object inside a scene file. It is stamped by editor tooling and is only unique within that one scene asset.

None of these substitutes for another. The id tells you what to load, the handle tells you which loaded copy you mean, and the object id only makes sense once you already know which instance it lives in.

## SceneObjectKey

An object authored into a scene is identified by the pair of scene handle and scene object id together, `SceneObjectKey`. A `SceneObjectId` alone is ambiguous the moment two live instances of the same scene asset are open, since both instances stamped their objects from the same file and both objects carry the same id. Pairing it with the handle is what lets a peer holding several scene instances at once bind a spawn to the right one.

`NetworkSystem.SceneHandle` reports which instance an object belongs to. Its unset value is `NetworkSystem.UnsetSceneHandle` (zero), which means the object belongs to no authority-opened scene — the scene a peer booted into, rather than one `SceneManager` opened and tracks.

## The authority drives everything

`SceneManager` opens instances, places and removes clients, and closes instances. A client never decides any of this for itself: it loads a scene only when asked, releases one only when asked, and reports back only what it was asked to report. That is what makes the authority's record of who holds what trustworthy enough to serve objects from — a client cannot inflate what the server believes it holds by loading or reporting on its own initiative.

`SceneManager.TryOpenScene` and `OpenSceneAsync` open instances. `RequestSceneLoad` and `RequestSceneUnload` place and remove clients. `EnsureCloseScene` and `CloseSceneAsync` close instances. See [Opening and closing scene instances](../../opening-and-closing-scene-instances) and [Placing clients in scenes](../../api/scenes/placing-clients-in-scenes) for the full API.

## Every instance coexists, nothing is replaced

Open scene instances are tracked by handle in a table the authority owns, and closing one only ever removes that one entry. Nothing about opening a scene id again reuses or merges state with an instance already open for that id. Handles are handed out from a counter that only climbs and is never recycled, so a handle you have seen always names the same instance for as long as anything remembers it, and a later instance can never be confused with an earlier, closed one.

This is what makes scene stacking possible: opening one asset several times gives you several coexisting instances, each with its own handle, and the handle is the only thing that tells them apart — they still share the same world coordinates. The shipped Unity scene loader (`UnitySceneLoader`) implements this by loading each instance additively (`LoadSceneMode.Additive`), so several copies of one Unity scene can be open in the same process at once. That is the loader's choice of how to realize the model, not a rule the model itself imposes.

## SceneScope: who an instance is for

`SceneScope` is decided once, when the instance is opened, and cannot change afterward:

- `SceneScope.Connections` — nobody is placed until `RequestSceneLoad` asks for it. The instancing case: an arena, a dungeon, a match.
- `SceneScope.Global` — every connected client is placed immediately, and every client that authenticates afterward is placed as it arrives. The single-world or lobby case.

Because scope is per instance rather than per asset, one scene asset can run as a shared `Global` lobby while a dozen other instances of a different (or the same) asset run as private `Connections` matches, all open at once.

## The wire carries a number

A scene is never sent as a path or a name. Every message that names a scene carries the scene id or the scene handle — plain numbers — and the registered `ISceneLoader` is what turns an id into actual content on each peer.

## Where to go next

- [UnitySceneLoader component](./unity-scene-loader) and [UnitySceneManager component](./unity-scene-manager) for the Unity setup.
- [Opening and closing scene instances](../../opening-and-closing-scene-instances) and [Placing clients in scenes](../../api/scenes/placing-clients-in-scenes) for the API.
