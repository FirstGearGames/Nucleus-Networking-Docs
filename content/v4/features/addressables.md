---
title: "Addressables"
---
Both addressable scenes and prefabs work over the network.

## Scene Addressables

Scene addressables utilize Fish-Networking's Custom Scene Processors. With a few overrides you can implement addressable scenes.

## Prefab Addressables

To work reliably, each addressables package must have a unique `ushort` ID between 1 and 65535. Never use 0 as the ID, as the preconfigured `SpawnablePrefabs` uses this ID. You may assign your addressable IDs however you like, for instance using a dictionary that tracks your addressable names with IDs.

Registering addressable prefabs with Fish-Networking is easy once each package has been given an ID.

The code below shows one way of loading and unloading addressable prefabs for the network.

```csharp
/// <summary>
/// Reference to your NetworkManager.
/// </summary>
private NetworkManager _networkManager => InstanceFinder.NetworkManager;

/// <summary>
/// Used to load and unload addressables in async.
/// </summary>
private AsyncOperationHandle<IList<GameObject>> _asyncHandle;

/// <summary>
/// Loads an addressables package by string.
/// </summary>
public IEnumerator LoadAddressables(string addressablesPackage)
{
    /* FishNet uses an Id to identify addressable packages
     * over the network. A simple way is to use GetStableHash
     * helper methods to return a unique key for the package name.
     * This does require the package names to be unique. */
    ushort id = addressablesPackage.GetStableHash16();

    /* GetPrefabObjects will return the prefab
     * collection to use for Id. Passing in true
     * will create the collection if needed. */
    SinglePrefabObjects spawnablePrefabs = (SinglePrefabObjects)_networkManager.GetPrefabObjects<SinglePrefabObjects>(id, true);

    /* Get a cache to store NetworkObject references from our helper object pool.
     * FishNet has the helpful CollectionCaches and ObjectCaches to prevent allocations. */
    List<NetworkObject> cache = CollectionCaches<NetworkObject>.RetrieveList();

    /* Load addressables normally. If the object is a NetworkObject prefab
     * then add it to our cache! */
    _asyncHandle = Addressables.LoadAssetsAsync<GameObject>(addressablesPackage, addressable =>
    {
        NetworkObject nob = addressable.GetComponent<NetworkObject>();
        if (nob != null)
            cache.Add(nob);
    });
    yield return _asyncHandle;

    /* Add the cached references to spawnablePrefabs. */
    spawnablePrefabs.AddObjects(cache);

    // Store the collection cache for use later to prevent garbage.
    CollectionCaches<NetworkObject>.Store(cache);
}

/// <summary>
/// Unloads an addressables package by string.
/// </summary>
public void UnloadAddressables(string addressablesPackage)
{
    // Get the Id the same way as we did for loading.
    ushort id = addressablesPackage.GetStableHash16();

    /* Get the prefab collection for the Id and
     * clear it so that there are no references of the objects in memory. */
    SinglePrefabObjects spawnablePrefabs = (SinglePrefabObjects)_networkManager.GetPrefabObjects<SinglePrefabObjects>(id, true);
    spawnablePrefabs.Clear();

    // Release addressables.
    Addressables.Release(_asyncHandle);
}
```

> **Important:** When using addressables be sure the client has addressable bundles loaded before the server sends spawn messages for the objects. For example: if you are going to load a scene with addressables, ensure the client has already loaded the addressables bundle for that scene before the server adds the client to the scene.
