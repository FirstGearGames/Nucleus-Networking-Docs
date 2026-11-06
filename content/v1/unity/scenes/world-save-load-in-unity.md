---
title: "Saving and loading a world from Unity"
---

> **Driving the core API directly?** See [Saving and loading a world](../../core-api/scenes/world-persistence.md).

There is no Unity persistence component. Call `CoreManager.WorldPersistenceManager` from a `MonoBehaviour` you write. World persistence needs Pro, and it runs only on the server: `SaveAsync` and `LoadAsync` are refused unless `TransportManager.IsServerStarted` is true.

## Register a store

`JsonWorldStore`, which ships with Nucleus, writes the world to a JSON file. Give it the `CoreManager` and a path under `Application.persistentDataPath`, which is writable on every platform Unity targets.

```csharp
UnityCoreManager unityCoreManager = GetComponent<UnityCoreManager>();
CoreManager coreManager = unityCoreManager.CoreManager;
WorldPersistenceManager worldPersistenceManager = coreManager.WorldPersistenceManager;

string filePath = Path.Combine(Application.persistentDataPath, "world.json");
JsonWorldStore jsonWorldStore = new(coreManager, filePath);

worldPersistenceManager.SetWorldStore(jsonWorldStore);
```

`JsonWorldStore` writes to a temporary file and moves it over the target only when the write finishes, so a crash mid-save leaves the previous world intact.

## Save the world

```csharp
bool saved = await worldPersistenceManager.SaveAsync();
```

## Load the world without blocking the main thread

A load can only finish while Unity keeps driving the network loop from `Update` on the main thread. Never block the main thread on the load task (`.Wait()`, or `.Result` before it completes): the load deadlocks. Await it from an `async` method, or start it and poll it from `Update`.

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

## A load replaces the whole world

A load despawns every object, closes every open scene, reopens the saved scenes through the registered `ISceneLoader` under their saved handles, then rebuilds the saved objects. Every connected client sees a world of despawns followed by a world of spawns, so consider putting players on a loading scene while it runs.

- A scene object is bound to the object already in its reopened scene, matched by `PlatformId`.
- Any other object is constructed from its saved system type, then looked up in the prefab registry by its `PrefabId` and prefab bundle id. A prefab missing from the collection that shipped that bundle cannot come back.
- A scene the loader cannot open is the most common failure. The store's `WorldLoadFailureAction` decides whether that scene's objects are dropped or the whole load fails. A failed load leaves an empty world, not the old one.
