
![Object pool unassigned](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/object-pool-unassigned.png)
![Object pool automatically assigned](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/object-pool-automatically-assigned.png)
![NetworkObject despawn type set to pool](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/network-object-despawn-type-pool.png)

Fish-Networking has built-in functionality for Object Pooling that will allow the server and client to keep instances of loaded prefabs in memory for later use. This can potentially provide better spawning performance for clients and server.

## General

When despawning spawned `NetworkObject`s using FishNet, instead of destroying the object you may just want to disable it and store it to be used again at a later time. This is what Object Pooling is. FishNet has a default implementation that will allow the objects you have instantiated to be disabled and pooled, instead of being destroyed. This functionality works for clients and server. You can also pre-warm assets for later use, which is discussed later in this guide.

> **Note:** Scene `NetworkObject`s do not get added to the Object Pool and are already disabled instead of destroyed when despawned.

## Setup

As mentioned on the NetworkManager component page, there is an assignable field labeled **ObjectPool**. You may assign any script which inherits from the `ObjectPool` class. By default when examining the NetworkManager in the Editor nothing will be assigned to this field; however, when you enter play mode the NetworkManager will automatically populate it with the default implementation and attach the script to the NetworkManager GameObject.

> **Note:** By default the object pool is enabled, but your network objects will only use the pool if the default despawn behavior is modified, or through the despawn call. See below for examples to both of these.

## Default Despawn Behavior

On the `NetworkObject` component you can set what the default despawn behavior is for the object where the script is placed. This setting is set to **Destroy** by default, so make sure to switch this over to **Pool** if you want Fish-Networking to automatically use the default object pool.

## Manual Despawn Behavior

You can manually change the despawn behavior through code for specific situations.

```csharp
// When calling FishNet's Despawn method from any location, you can pass an enum
// parameter to deviate from the default behavior.
ServerManager.Despawn(nob, DespawnType.Pool);
```

## Spawning NetworkObjects

When using the object pool you will want to retrieve `NetworkObject`s from it prior to network spawning them. Doing so will pull from the pool rather than instantiate new objects.

```csharp
// There are many overrides which allow for a variety of information.
// You can use GameObjects, NetworkObjects, PrefabIds, CollectionIds,
// spawn positions, and more.
NetworkObject nob = NetworkManager.GetPooledInstantiated(...);

// Spawn normally.
ServerManager.Spawn(nob);
```

If you are certain you do not wish to use the object pool on a specific object you can still use the code above and simply set the **Default Despawn Type** to **Destroy** on the `NetworkObject`, or instantiate and spawn normally.

## Pre-Warming the ObjectPool

If you want to manually store `NetworkObject`s to the `ObjectPool` prior to needing them at runtime you may do so through the NetworkManager API.

Here is a very basic implementation of pre-warming the ObjectPool:

```csharp
[SerializeField] private NetworkObject _nobPrefab;

private void Start()
{
    /// <summary>
    /// Instantiates a number of objects and adds them to the pool.
    /// </summary>
    /// <param name="prefab">Prefab to cache.</param>
    /// <param name="count">Quantity to spawn.</param>
    /// <param name="asServer">True if storing prefabs for the server collection.</param>
    InstanceFinder.NetworkManager.CacheObjects(_nobPrefab, 100, IsServer);
}
```

## Custom Implementation

FishNet allows you to implement your own method of object pooling. First create your own class inheriting from the `ObjectPool` class. Place your new class component in your scene, typically directly on the NetworkManager object. Then assign your component to the **ObjectPool** field on the NetworkManager.
