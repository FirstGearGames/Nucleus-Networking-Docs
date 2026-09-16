Information about how to spawn and despawn objects on the network.

For objects to exist over the network they must have a `NetworkObject` component on them, and must be spawned using the server. To spawn an object it must first be instantiated, and then passed into a Spawn method. There are a variety of Spawn methods to access for your convenience, all of which provide the same outcome.

> **Important:** Networked addressable prefabs must be registered with the NetworkManager differently. See the Addressables guide for more information on this.

Spawning without an owner is done by passing in `null` for the owner, or simply leaving the argument out.

```csharp
GameObject go = Instantiate(_yourPrefab);
InstanceFinder.ServerManager.Spawn(go, null);
```

```csharp
GameObject go = Instantiate(_yourPrefab);
InstanceFinder.ServerManager.Spawn(go);
```

### Spawning with Ownership

```csharp
GameObject go = Instantiate(_yourPrefab);
InstanceFinder.ServerManager.Spawn(go, ownerConnection);
```

You may also access the spawn method within any script that inherits `NetworkBehaviour`, or by accessing the `NetworkObject`.

```csharp
GameObject go = Instantiate(_yourPrefab);
base.Spawn(go, ownerConnection);        // networkBehaviour.
// or
networkObject.Spawn(go, ownerConnection); // referencing a NetworkObject.
```

Despawning can be accessed the same ways as spawning — through a `NetworkBehaviour` script, a reference `NetworkObject`, or through the `ServerManager` directly.

```csharp
base.Despawn();                              // networkBehaviour. Despawns the NetworkObject.
networkObject.Despawn();                     // referencing a NetworkObject.
InstanceFinder.ServerManager.Despawn(gameObject); // through ServerManager.
```

When despawning you may also choose to pool the object rather than destroy it. There are optional parameters available to change this behavior.

```csharp
base.Despawn(DespawnType.Pool); // pools the object instead of destroying it.
```

You can check if an object is spawned at any time using the `IsSpawned` property within `NetworkBehaviour`, or `NetworkObject`.

Scene Objects are spawned and despawned like instantiated objects, except you pass in the reference of the already instantiated/placed scene object. A scene object becomes disabled rather than destroyed when despawned.
