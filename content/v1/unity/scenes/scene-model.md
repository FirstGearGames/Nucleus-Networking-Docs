---
title: "How networked scenes work"
---

## Three numbers identify a scene and its objects

- **Scene id** (`ushort`): which scene asset. The server names a scene only by its id, never by path or name, and the registered `ISceneLoader` turns the id into content on each peer.
- **Scene handle** (`uint`): which live instance of that asset. Opening the same scene id twice gives two handles and two independent worlds. A handle is never reused, so it always names the same instance.
- **Scene object id** (`uint`): which object inside a scene file. Editor tooling stamps it, and it is unique only within that scene asset.

None of these substitutes for another. An object authored into a scene is identified by `SceneObjectKey`, the pair of scene handle and scene object id, because the object id alone is ambiguous once two instances of the same scene are open.

`NetworkSystem.SceneHandle` reports which instance an object belongs to. Its unset value, `NetworkSystem.UnsetSceneHandle` (zero), means the object belongs to no server-opened scene, such as the scene a peer booted into.

## The server opens, places and closes

Only the server opens instances, places and removes clients, and closes instances. A client loads or releases a scene only when asked.

- `SceneManager.TryOpenScene` and `OpenSceneAsync` open instances.
- `TryRequestSceneLoad` and `RequestSceneUnload` place and remove clients.
- `EnsureCloseScene` and `CloseSceneAsync` close instances.

See [Opening and closing scene instances](../../core-api/scenes/opening-scene-instances.md) and [Placing clients in scenes](../../core-api/scenes/placing-clients-in-scenes.md) for the full API.

## Every open instance coexists

Opening a scene id again never reuses or merges with an instance already open, and closing an instance removes only that one. Opening one asset several times stacks it: each copy has its own handle, and the copies share the same world coordinates. `UnitySceneLoader` loads every instance additively, so several copies of one Unity scene can be open at once.

## SceneScope decides who an instance is for

The scope is set when the instance opens and cannot change afterward.

- `SceneScope.Connections`: nobody is placed until `TryRequestSceneLoad` asks. Use it for an arena, a dungeon or a match.
- `SceneScope.Global`: every connected client is placed at once, and every client that authenticates later is placed as it arrives. Use it for a single world or a lobby.

Scope belongs to the instance, not the asset, so one asset can run as a `Global` lobby while other instances run as private `Connections` matches.

## Set it up in Unity

See [UnitySceneLoader component](./unity-scene-loader.md) and [UnitySceneManager component](./unity-scene-manager.md).
