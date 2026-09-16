---
title: "Set Player Number"
---
Tutorial for spawning players as soon as a set number of clients have joined your game.

## Create the Script

Create a new script in your project for your custom player spawner (e.g. `CountBasedPlayerSpawner`).

## Add the Needed Fields and Namespaces

Our class will take a `NetworkObject` prefab which will be spawned for our players and an integer for how many players need to connect before we spawn the players.

We're also storing a reference to the `NetworkManager` this script will use. This is necessary as we won't be inheriting from `NetworkBehaviour` for this player spawner script — as a result, we will be able to place this component directly on the `NetworkManager`.

```csharp
using FishNet;
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Managing.Server;
using FishNet.Object;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class CountBasedPlayerSpawner : MonoBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;
    [SerializeField] private int _requiredPlayerCount;
    private NetworkManager _networkManager;
}
```

## Get a Reference to the NetworkManager

Get a reference to the `NetworkManager`, first trying to get it from this object or one of its parents, and falling back to `InstanceFinder` if that fails.

```csharp
private void Awake()
{
    _networkManager = GetComponentInParent<NetworkManager>();
    if (_networkManager == null)
        _networkManager = InstanceFinder.NetworkManager;

    if (_networkManager == null)
    {
        Debug.LogWarning($"CountBasedPlayerSpawner cannot work as a NetworkManager couldn't be found.");
        return;
    }
}
```

## Listen for Clients Joining

With access to the `NetworkManager`, we can monitor when clients join the game using the `SceneManager.OnClientLoadedStartScenes` event, which is triggered once a client finishes loading the initial scenes after connecting.

Subscribe to the event at the end of the `Awake` method:

```csharp
_networkManager.SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
```

And unsubscribe when this object is destroyed:

```csharp
private void OnDestroy()
{
    if (_networkManager != null)
        _networkManager.SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
}
```

## Implement the OnClientLoadedStartScenes Method

This event runs for both the server and client, so we exit early if not running on the server. We then build a list of all authenticated connected clients. If the count hasn't reached `_requiredPlayerCount` yet, we return early. Otherwise, we spawn a player object for each authenticated client.

```csharp
private void OnClientLoadedStartScenes(NetworkConnection _, bool asServer)
{
    if (!asServer) return;

    List<NetworkConnection> authenticatedClients = _networkManager.ServerManager.Clients.Values
        .Where(conn => conn.IsAuthenticated).ToList();

    if (authenticatedClients.Count < _requiredPlayerCount) return;

    foreach (NetworkConnection client in authenticatedClients)
    {
        NetworkObject obj = Instantiate(_playerPrefab);
        _networkManager.ServerManager.Spawn(obj, client);
    }
}
```

## Enable Use of Object Pooling

Use `NetworkManager.GetPooledInstantiated` instead of `Instantiate` to make the script compatible with FishNet's Object Pooling system. This works even if you don't use Object Pooling, so it is a direct improvement.

```csharp
NetworkObject obj = _networkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
```

## Handle Starting Scenes

If the game begins in this scene without using the FishNet SceneManager to load it, we need to manually inform FishNet that the client has entered the scene. Insert the following code right after the `Spawn` call:

```csharp
// If the client isn't observing this scene, make them an observer of it.
if (!client.Scenes.Contains(gameObject.scene))
    _networkManager.SceneManager.AddOwnerToDefaultScene(obj);
```

## Final Script

You can add this script to your `NetworkManager` object or any object that exists before clients start connecting. Assign the `_playerPrefab` and `_requiredPlayerCount` fields in the Inspector.

```csharp
using FishNet;
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Managing.Server;
using FishNet.Object;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class CountBasedPlayerSpawner : MonoBehaviour
{
    [SerializeField] private NetworkObject _playerPrefab;
    [SerializeField] private int _requiredPlayerCount;
    private NetworkManager _networkManager;

    private void Awake()
    {
        _networkManager = GetComponentInParent<NetworkManager>();
        if (_networkManager == null)
            _networkManager = InstanceFinder.NetworkManager;

        if (_networkManager == null)
        {
            Debug.LogWarning($"CountBasedPlayerSpawner cannot work as a NetworkManager couldn't be found.");
            return;
        }

        _networkManager.SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
    }

    private void OnDestroy()
    {
        if (_networkManager != null)
            _networkManager.SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
    }

    private void OnClientLoadedStartScenes(NetworkConnection _, bool asServer)
    {
        if (!asServer) return;

        List<NetworkConnection> authenticatedClients = _networkManager.ServerManager.Clients.Values
            .Where(conn => conn.IsAuthenticated).ToList();

        if (authenticatedClients.Count < _requiredPlayerCount) return;

        foreach (NetworkConnection client in authenticatedClients)
        {
            NetworkObject obj = _networkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
            _networkManager.ServerManager.Spawn(obj, client);

            // If the client isn't observing this scene, make them an observer of it.
            if (!client.Scenes.Contains(gameObject.scene))
                _networkManager.SceneManager.AddOwnerToDefaultScene(obj);
        }
    }
}
```
