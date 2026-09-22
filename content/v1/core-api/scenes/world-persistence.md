---
title: "Saving and loading a world"
---

> **Using Unity?** See [Saving and loading a world from Unity](../../unity/scenes/world-save-load-in-unity).

## WorldPersistenceManager

`CoreManager.WorldPersistenceManager` writes the authority's world to a store and builds it back. Register a store first:

```csharp
coreManager.WorldPersistenceManager.SetWorldStore(myWorldStore);
```

`SetWorldStore` replaces whatever store was previously registered; passing `null` unregisters it. `SaveAsync` and `LoadAsync` both fail immediately if no store is registered.

`IsBusy` is true for the duration of either operation. A second `SaveAsync` or `LoadAsync` called while one is already running is refused rather than allowed to interleave with it.

## Saving

```csharp
bool saved = await coreManager.WorldPersistenceManager.SaveAsync();
```

`SaveAsync` walks every open scene and every started system into the store's document, then awaits the store's own save. The store is arbitrary caller code, so the save can span any number of ticks before it resolves.

## Loading, and the deadlock rule

`LoadAsync` despawns and rebuilds the routing table, which only the network loop thread may touch. Because the store's load can resolve on any thread, `LoadAsync` marshals itself back onto the loop before it starts rebuilding.

This means the call from the thread that drives the loop must never simply `await` it. Awaiting from that thread blocks the loop from ever draining, the marshal never resolves, and the load deadlocks permanently. The caller must keep the loop being driven, the normal way the host application drives it, for as long as the returned task is outstanding.

```csharp
Task<bool> loadTask = coreManager.WorldPersistenceManager.LoadAsync();

bool loaded = await loadTask;
```

Await it from anywhere other than the thread that itself drives the network loop, and this is all it takes; the loop keeps running on its own and the task resolves once the build finishes. Only the loop-driving thread has to take care not to block on it directly.

## Authority only

Both `SaveAsync` and `LoadAsync` are refused on a peer whose server is not started. A client holds a copy of the authority's world, not one of its own, so there is nothing on a client worth saving and nothing a client can build without an authority behind it.

## What a save keeps

A save records:

- What objects existed
- What type each object was built from
- Where each object lived (its scene)
- What each object belonged to
- What each object's members held

## What a save drops, and why

A save does not record observer sets, interest membership, access rosters, acknowledgment positions, or controller assignments. All of these describe peers connected to a session, and a saved world outlives the session it was taken from. There is nothing to restore them to.

## Unregistered system types are skipped silently, per object

A save only writes systems whose type is registered with `NetworkTypeRegistry`. A started system of an unregistered type is left out of the save entirely, and an error is logged for that object naming its id and type. The rest of the save proceeds; there is no way to detect after the fact which objects were skipped other than by reading the logged errors.

## Loading replaces, it does not merge

A load first despawns everything currently standing, then builds the saved world in its place. Connected clients see exactly that sequence: a world of despawns followed by a world of spawns.

If no `ISceneLoader` is registered on `SceneManager`, a load logs a warning and drops every object inside every scene named by the saved world, because none of those scenes can be opened.

## Scenes are reopened before objects are rebuilt

A load closes all currently open scenes, then reopens each scene the saved world names before rebuilding any object into it. If a named scene cannot be opened, the store itself decides what happens next through its failure action: it can either let the load continue without that scene's objects, or fail the load outright, in which case no partial world is left standing.

## Whole-world only

A save always captures the entire world, and a load always replaces the entire world. There is no incremental or partial save.

## Pro only

World persistence is a Pro feature.
