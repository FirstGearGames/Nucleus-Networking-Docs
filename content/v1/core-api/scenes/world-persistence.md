---
title: "Saving and loading a world"
---

> **Using Unity?** See [Saving and loading a world from Unity](../../unity/scenes/world-save-load-in-unity.md).

World persistence is a Pro feature. `CoreManager.WorldPersistenceManager` saves the server's world to a store and builds it back.

## Register a store

```csharp
coreManager.WorldPersistenceManager.SetWorldStore(myWorldStore);
```

`SetWorldStore` replaces any store already registered, and `null` unregisters it. `SaveAsync` and `LoadAsync` fail at once when no store is registered. See [Writing a world store](./world-store.md).

## Save and load only on the server

`SaveAsync` and `LoadAsync` are refused unless this peer's server is started. A client holds a copy of the server's world, not its own.

`IsBusy` is true while either runs. A second `SaveAsync` or `LoadAsync` called during one is refused.

## Save the world

```csharp
bool saved = await coreManager.WorldPersistenceManager.SaveAsync();
```

`SaveAsync` writes every open scene and every started system, then awaits the store's own save, which can take any number of ticks. A save always captures the whole world. There is no partial or incremental save.

## Load without blocking the loop thread

```csharp
Task<bool> loadTask = coreManager.WorldPersistenceManager.LoadAsync();

bool loaded = await loadTask;
```

`LoadAsync` finishes its work on the network loop thread. You can await it from any thread, the loop thread included, but:

- Never block the thread that drives the loop on the task (`.Result`, `.Wait()`).
- Never await it inside the code that would go on to drive the next tick.
- Keep driving the loop until the task completes.

Breaking any of these stops the loop, and the load deadlocks permanently.

## Know what a save keeps

A save records each object, the type it was built from, its scene, what it belonged to, and its members' values.

It does not record observers, interest, access rosters, acknowledgment positions or controller assignments. These describe connected peers, and a saved world outlives its session.

Only systems whose type is registered with `NetworkTypeRegistry` are saved. A started system of an unregistered type is left out, and an error naming its id and type is logged; the log is the only record of what was skipped. The rest of the save goes ahead.

## A load replaces the whole world

A load does not merge. It:

1. Despawns everything and closes every open scene. Connected clients see the despawns, then the spawns.
2. Reopens each saved scene. If one cannot be opened, the store's `OnSceneUnavailable` either drops that scene's objects and continues, or fails the whole load. A failed load leaves an empty world, because the old world is already gone.
3. Rebuilds the saved objects.

If no `ISceneLoader` is registered on `SceneManager`, a load logs a warning and drops every object in every saved scene, because none of those scenes can be opened.
