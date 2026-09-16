---
title: "Spawning Players Manually"
---
Tutorial for creating a script to manually spawn your players when you call a method.

You may find yourself needing to spawn your players from some custom action. This script exposes a public method you can call to trigger spawning whenever you need to.

## Create the Script

Create a new script in your project for your custom player spawner (e.g. `ManualPlayerSpawner`).

## Add Namespaces and Inheritance

The script inherits from `NetworkBehaviour` to make use of its exposed properties.

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ManualPlayerSpawner : NetworkBehaviour
{
}
```

> **Info:** Since this class is a `NetworkBehaviour`, it should not be placed on the `NetworkManager` GameObject or any of its children, but rather on a Networked GameObject in the desired scene.

## Expose the Prefab in the Inspector

Add a `NetworkObject` variable for the player prefab reference.

```csharp
[SerializeField] private NetworkObject _playerPrefab;
```

## Create a SpawnPlayers Method

The method loops through all connected clients and spawns a prefab for each authenticated client. The `[Server]` attribute prevents accidentally calling this on the client side and enables code stripping in FishNet Pro.

```csharp
[Server]
public void SpawnPlayers()
{
    if (_playerPrefab == null)
    {
        Debug.LogWarning("Player prefab is not assigned and thus cannot be spawned.");
        return;
    }

    foreach (NetworkConnection client in ServerManager.Clients.Values)
    {
        if (!client.IsAuthenticated) continue;

        // If the client isn't observing this scene, make them an observer of it.
        if (!client.Scenes.Contains(gameObject.scene))
            SceneManager.AddConnectionToScene(client, gameObject.scene);

        NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
        Spawn(obj, client, gameObject.scene);
    }
}
```

Using `NetworkManager.GetPooledInstantiated` instead of `Instantiate` makes the script compatible with FishNet's Object Pooling system.

## Final Script

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ManualPlayerSpawner : NetworkBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;

    [Server]
    public void SpawnPlayers()
    {
        if (_playerPrefab == null)
        {
            Debug.LogWarning("Player prefab is not assigned and thus cannot be spawned.");
            return;
        }

        foreach (NetworkConnection client in ServerManager.Clients.Values)
        {
            if (!client.IsAuthenticated) continue;

            if (!client.Scenes.Contains(gameObject.scene))
                SceneManager.AddConnectionToScene(client, gameObject.scene);

            NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
            Spawn(obj, client, gameObject.scene);
        }
    }
}
```

Add this script to a game object in your desired scene and assign the player prefab to it.
