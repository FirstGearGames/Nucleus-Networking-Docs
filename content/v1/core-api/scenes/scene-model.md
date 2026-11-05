---
title: "How networked scenes work"
---

## Three numbers identify a scene and its objects

Keep these apart. Mixing them up is the most common source of confusion.

- **Scene id** (`ushort`): which scene asset. The registered `ISceneLoader` turns an id into content on each peer. Nucleus never names a scene by a path or a name.
- **Scene handle** (`uint`): which live instance of that asset. Opening the same scene id twice gives two handles and two independent worlds.
- **Scene object id** (`uint`): which object inside a scene file. Editor tooling stamps it, and it is unique only within that one scene asset.

## A scene object is named by its handle and its object id

`SceneObjectKey` pairs the scene handle with the scene object id. A `SceneObjectId` alone is ambiguous once two instances of the same scene asset are open, because both instances carry the same ids.

`NetworkSystem.SceneHandle` reports which instance an object belongs to. `NetworkSystem.UnsetSceneHandle` (zero) means it belongs to no server-opened scene: it is in the scene the peer booted into.

## The server opens, places and closes

A client never decides. It loads a scene only when asked, releases one only when asked, and reports only what it was asked to report.

- Open instances: `SceneManager.TryOpenScene` and `OpenSceneAsync`.
- Place and remove clients: `TryRequestSceneLoad` and `RequestSceneUnload`.
- Close instances: `EnsureCloseScene` and `CloseSceneAsync`.

See [Opening and closing scene instances](./opening-scene-instances.md) and [Placing clients in scenes](./placing-clients-in-scenes.md).

## Instances of one scene coexist

Opening a scene id again never reuses or merges state with an instance already open, and closing an instance removes only that one. Handles are never recycled, so a handle always names the same instance.

This is scene stacking: several instances of one asset open at once, sharing the same world coordinates and told apart only by handle. `UnitySceneLoader` loads each instance additively, so several copies of one Unity scene can be open in one process.

## SceneScope sets who an instance is for

Scope is chosen when the instance opens and cannot change:

- `SceneScope.Connections`: nobody is placed until `TryRequestSceneLoad` asks. Use it for an arena, a dungeon or a match.
- `SceneScope.Global`: every connected client is placed at once, and every client that authenticates later is placed as it arrives. Use it for a single shared world or a lobby.

Scope is per instance, so one asset can run as a `Global` lobby while other instances run as private `Connections` matches.

## Set it up in Unity

See [UnitySceneLoader component](../../unity/scenes/unity-scene-loader.md) and [UnitySceneManager component](../../unity/scenes/unity-scene-manager.md).
