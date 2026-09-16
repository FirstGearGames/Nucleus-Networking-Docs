---
title: "On Scene Load"
---
Tutorial for spawning players as soon as they are loaded by FishNet into a specific scene.

To spawn a player when they load into a scene, add a `ScenePlayerSpawner` script to a NetworkObject in your desired scene.

## Basic Version

### Create the Script

Create a new script in your project named `ScenePlayerSpawner.cs`.

### Make the Script a NetworkBehaviour

Inherit from `NetworkBehaviour` to use its callbacks and properties.

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ScenePlayerSpawner : NetworkBehaviour
{
}
```

> **Info:** Since this class is a `NetworkBehaviour`, it should not be placed on the `NetworkManager` GameObject or any of its children, but rather on a Networked GameObject in the desired scene.

### Expose the Prefab in the Inspector

```csharp
[SerializeField] private NetworkObject _playerPrefab;
```

### Override the OnSpawnServer Method

`OnSpawnServer` is called by FishNet on the server as soon as the object is being spawned for a client, which tells us the client is in the scene and ready to receive a player object.

```csharp
public override void OnSpawnServer(NetworkConnection connection)
{
    NetworkObject obj = Instantiate(_playerPrefab);
    Spawn(obj, connection, gameObject.scene);
}
```

### Use FishNet's Object Pooling

Replace `Instantiate` with `NetworkManager.GetPooledInstantiated` to make the script compatible with FishNet's Object Pooling system. This works even without Object Pooling, so it is a direct improvement.

```csharp
NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
```

### Basic Final Script

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ScenePlayerSpawner : NetworkBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;

    // This method runs on the server when the client is about to spawn this object.
    // Since the player is about to spawn this object, we know he is in this scene.
    public override void OnSpawnServer(NetworkConnection connection)
    {
        NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
        Spawn(obj, connection, gameObject.scene);
    }
}
```

> **Warning:** This works great as long as the scene is not one of the starting scenes. If it is, FishNet may warn that you are trying to spawn an object before all starting scenes have loaded. See the section below to handle that case.

## Handling Starting Scenes

If this scene is loaded before or as soon as the client connects, the basic script will produce a warning. To fix this, we only spawn the player after the client has loaded all starting scenes.

### Listening for the Event

Override `OnStartServer` and `OnStopServer` to subscribe to `SceneManager.OnClientLoadedStartScenes`.

```csharp
public override void OnStartServer()
{
    SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
}

public override void OnStopServer()
{
    if (SceneManager != null)
        SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
}
```

### Handling the Event

Spawn the player when the event fires, but only if the client is actually in this scene.

```csharp
private void OnClientLoadedStartScenes(NetworkConnection connection, bool asServer)
{
    // Check if the client is observing this object (i.e. in this scene).
    // Alternatively: connection.Scenes.Contains(gameObject.scene)
    if (asServer && Observers.Contains(connection))
        SpawnPlayer(connection);
}
```

### Adjusting the OnSpawnServer Method

Update `OnSpawnServer` to only spawn a player if the client has already loaded the starting scenes.

```csharp
// This method runs on the server when the client is about to spawn this object.
// BUT he may not have loaded all start scenes yet, so we check that.
public override void OnSpawnServer(NetworkConnection connection)
{
    if (connection.LoadedStartScenes(true))
        SpawnPlayer(connection);
}
```

### The SpawnPlayer Method

Move the actual spawning logic into its own helper method.

```csharp
private void SpawnPlayer(NetworkConnection connection)
{
    NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
    Spawn(obj, connection, gameObject.scene);
}
```

The two-path approach ensures exactly one player is spawned per client: `OnSpawnServer` handles clients who loaded starting scenes before this object spawned, and `OnClientLoadedStartScenes` handles clients who load starting scenes after this object was already spawned.

### Final Script

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ScenePlayerSpawner : NetworkBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;

    public override void OnStartServer()
    {
        SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
    }

    public override void OnStopServer()
    {
        if (SceneManager != null)
            SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
    }

    private void OnClientLoadedStartScenes(NetworkConnection connection, bool asServer)
    {
        // Check if the client is observing this object (i.e. in this scene).
        // Alternatively: connection.Scenes.Contains(gameObject.scene)
        if (asServer && Observers.Contains(connection))
            SpawnPlayer(connection);
    }

    // This method runs on the server when the client is about to spawn this object.
    // Since the player is about to spawn this object, we know he is in this scene.
    // BUT he may not have loaded all start scenes yet, so we check that.
    public override void OnSpawnServer(NetworkConnection connection)
    {
        if (connection.LoadedStartScenes(true))
            SpawnPlayer(connection);
    }

    private void SpawnPlayer(NetworkConnection connection)
    {
        NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
        Spawn(obj, connection, gameObject.scene);
    }
}
```
