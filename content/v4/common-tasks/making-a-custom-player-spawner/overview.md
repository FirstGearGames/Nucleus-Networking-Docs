---
title: "Overview"
---

## Spawning Players Manually

Tutorial for creating a script to manually spawn your players when you call a method.

You may find yourself needing to spawn your players from some custom action. We can write a script that has a public method you can easily call to trigger it whenever you need to.

### Step 1 — Create the Script

Create a new script in your project for your custom player spawner. We've called ours `ManualPlayerSpawner`.

### Step 2 — Add the Namespaces and Inheritance

Our script will make use of a few different FishNet namespaces and will inherit from `NetworkBehaviour` to make use of its exposed properties.

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ManualPlayerSpawner : NetworkBehaviour
{
}
```

> **Info:** Since this class is a `NetworkBehaviour`, it should not be placed on the NetworkManager GameObject or any of its children, but rather on a Networked GameObject in the desired scene.

### Step 3 — Expose the Prefab in the Inspector

Add a `NetworkObject` variable for holding a reference to our player prefab.

```csharp
[SerializeField] private NetworkObject _playerPrefab;
```

### Step 4 — Create a SpawnPlayers Method

Now we can create the method that we will call when we want to spawn in the players.

The method will first do a simple null check to make sure we don't get any null reference errors if we forget to assign the player prefab. After that it will loop through all the connected clients and, as long as they are authenticated, it will instantiate and spawn the prefab for them.

```csharp
public void SpawnPlayers()
{
    if (_playerPrefab == null)
    {
        Debug.LogWarning("Player prefab is not assigned and thus cannot be spawned.");
        return;
    }

    foreach (NetworkConnection client in ServerManager.Clients.Values)
    {
        // Since the ServerManager.Clients collection contains all clients (even non-authenticated ones),
        // we need to check if they are authenticated first before spawning a player object for them.
        if (!client.IsAuthenticated) continue;

        NetworkObject obj = Instantiate(_playerPrefab);
        Spawn(obj, client, gameObject.scene);
    }
}
```

### Step 5 — Prevent Accidentally Running on Client

Let's prevent ourselves from accidentally running this method on the client side — spawning should only happen by the server.

Add the `[Server]` attribute to the method:

```csharp
[Server]
public void SpawnPlayers()
```

This will also allow FishNet to strip out this code from client builds when using FishNet Pro's code stripping feature.

### Step 6 — Enable Use of Object Pooling

We can also make the script work with FishNet's Object Pooling system by changing the `Instantiate` method call to one provided by FishNet. This code will work even if we don't use Object Pooling, so it's a direct improvement:

```csharp
NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
```

### Step 7 — Handle Starting Scenes

Now the script works well for situations where clients are loaded into the scene by the FishNet `SceneManager`, but what if you start the game in this scene and don't use the FishNet SceneManager to load it? In that case we can tell FishNet that the client has loaded this scene and should observe it:

```csharp
// If the client isn't observing this scene, make him an observer of it.
if (!client.Scenes.Contains(gameObject.scene))
    SceneManager.AddConnectionToScene(client, gameObject.scene);
```

Alternatively, if you only want clients who are already loaded in this scene to have a player spawned:

```csharp
// If the client isn't in this scene, ignore him.
if (!client.Scenes.Contains(gameObject.scene)) continue;
```

### Step 8 — The Final Script

Here is the complete `ManualPlayerSpawner` script. Add it to a game object in your desired scene and assign the player prefab to it.

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using UnityEngine;

public class ManualPlayerSpawner : NetworkBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;

    // The Server attribute here prevents this method from being called except on the server.
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
            // Since the ServerManager.Clients collection contains all clients (even non-authenticated ones),
            // we need to check if they are authenticated first before spawning a player object for them.
            if (!client.IsAuthenticated) continue;

            // If the client isn't observing this scene, make him an observer of it.
            if (!client.Scenes.Contains(gameObject.scene))
                SceneManager.AddConnectionToScene(client, gameObject.scene);

            NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
            Spawn(obj, client, gameObject.scene);
        }
    }
}
```
