---
title: "Saving and loading a world from Unity"
---

> **Driving the core API directly?** See [Saving and loading a world](../../core-api/scenes/world-persistence.md).

There is no Unity persistence component. `WorldPersistenceManager` lives on `CoreManager`, and you drive it from a `MonoBehaviour` you write yourself: resolve `CoreManager` from `UnityCoreManager`, then call into `CoreManager.WorldPersistenceManager`.

## Getting to the manager

```csharp
UnityCoreManager unityCoreManager = GetComponent<UnityCoreManager>();
CoreManager coreManager = unityCoreManager.CoreManager;
WorldPersistenceManager worldPersistenceManager = coreManager.WorldPersistenceManager;
```

Both `SaveAsync` and `LoadAsync` are refused unless `TransportManager.IsServerStarted` is true. A client holds a copy of the server's world, not one of its own, so persistence only runs on the server.

## Registering a store

`WorldPersistenceManager` needs a store before it will save or load anything. `JsonWorldStore` is the store Nucleus ships: it takes the `CoreManager` and a file path, and writes/reads a JSON file there.

```csharp
string filePath = Path.Combine(Application.persistentDataPath, "world.json");
JsonWorldStore jsonWorldStore = new(coreManager, filePath);

worldPersistenceManager.SetWorldStore(jsonWorldStore);
```

`Application.persistentDataPath` is the usual choice in Unity because it is writable on every platform Unity targets. `JsonWorldStore` writes to a temporary file beside the target and moves it over the real path only once the write finishes, so a crash mid-save leaves the previous world intact rather than a truncated one.

## Saving

```csharp
bool saved = await worldPersistenceManager.SaveAsync();
```

`SaveAsync` runs on the loop and doesn't need the pump described below - it completes without switching threads.

## Loading, and why the MonoBehaviour has to pump the loop

`LoadAsync` is different. Despawning and rebuilding the routing table can only happen on the network loop, but the awaited store call (`JsonWorldStore.LoadAsync`, file I/O) can resume on any thread. To get back onto the loop, `LoadAsync` queues the rest of its work onto the network loop, which only runs it when the loop is being driven and drains its work.

That means the loop has to keep being driven while the load is outstanding. In Unity, the loop is driven from `Update`/`LateUpdate` on the main thread, so blocking the main thread on this task deadlocks: the load is waiting for the loop to drain, and the loop is waiting for your thread to come back and drive it. An ordinary `await` from an `async` method on the main thread does not block. It hands the thread back to Unity, which keeps ticking, and your method resumes once the load finishes.

Await it from an `async` method:

```csharp
public class WorldLoader : MonoBehaviour
{
    public void BeginLoad() => _ = LoadWorldAsync();

    private async Task LoadWorldAsync()
    {
        bool loaded = await GetComponent<UnityCoreManager>().CoreManager
            .WorldPersistenceManager.LoadAsync();

        // handle the result
    }
}
```

Or start the task and poll it from `Update`:

```csharp
public class WorldLoader : MonoBehaviour
{
    private Task<bool> _loadTask;

    public void BeginLoad()
    {
        _loadTask = GetComponent<UnityCoreManager>().CoreManager
            .WorldPersistenceManager.LoadAsync();
    }

    private void Update()
    {
        if (_loadTask is { IsCompleted: true })
        {
            bool loaded = _loadTask.Result;
            _loadTask = null;
            // handle the result
        }
    }
}
```

Either way, control goes back to Unity while the load runs, so its own `Update` loop keeps pumping the network loop on subsequent frames, which is what lets the load get back onto the loop and finish. Anything that blocks synchronously on the task (`.Wait()`, `.Result` before it completes) from that same main thread reproduces the deadlock.

## What a load does to the hierarchy

A load replaces the world rather than merging into it:

1. Every standing object is despawned.
2. Every open scene is closed.
3. Saved scenes are reopened through the registered `ISceneLoader`, under the handle each was saved by. A scene the loader cannot open is the most common load failure - the object can be dropped or the whole load can fail, depending on the store's `WorldLoadFailureAction`. A failed load does not restore the old world, since steps 1 and 2 have already run: it leaves an empty one.
4. Saved objects are rebuilt. A scene object is bound to the placed object already in the reopened scene, matched by `PlatformId`. A non-scene object is constructed from its saved system type and, once built, is looked up in the prefab registry by its stamped `PlatformId` (exposed as `PrefabId` on `NetworkSystemObject`) and prefab bundle id. A prefab missing from the collection that shipped that bundle cannot come back.

On every connected client this looks like a world of despawns followed by a world of spawns - there's no incremental diff between the old and new world.

## Requirements

- Pro only.
- Authority only (`TransportManager.IsServerStarted`).
- A load over a live session is disruptive to every connected client for the reasons above; consider whether players should be on a loading scene while it runs.
