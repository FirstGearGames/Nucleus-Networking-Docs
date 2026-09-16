---
title: "Spawning Selected Player"
---
Tutorial for allowing your players to choose a character object before spawning it.

This guide lets clients call a `SpawnPlayer` ServerRpc to have the server spawn their chosen character. A list of permitted prefabs prevents clients from spawning arbitrary network objects.

## Create the Script

Create a new script called `SelectablePlayerSpawner` inheriting from `NetworkBehaviour`.

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using System.Linq;
using UnityEngine;

public class SelectablePlayerSpawner : NetworkBehaviour
{
}
```

> **Info:** Since this class is a `NetworkBehaviour`, it should not be placed on the `NetworkManager` GameObject or any of its children.

## Create an Array of Permitted Prefabs

```csharp
[SerializeField] private NetworkObject[] _playerPrefabs;
```

## Create a SpawnPlayer Method

The method is a `ServerRpc` with `RequireOwnership = false` so any client can call it. The `NetworkConnection sender` parameter is filled in automatically by FishNet.

```csharp
[ServerRpc(RequireOwnership = false)]
public void SpawnPlayer(NetworkObject _playerPrefab, NetworkConnection sender = null)
{
    if (sender.FirstObject != null)
    {
        Debug.LogWarning($"Client {sender.ClientId} already has a player object; not spawning another.");
        return;
    }

    if (!_playerPrefabs.Contains(_playerPrefab))
    {
        Debug.LogWarning("Invalid player prefab selected, cannot spawn.");
        sender.Kick(FishNet.Managing.Server.KickReason.ExploitAttempt);
        return;
    }

    NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
    Spawn(obj, sender, gameObject.scene);
}
```

## Handle Starting Scenes

Subscribe to `SceneManager.OnClientLoadedStartScenes` so clients are added to the scene's observer list automatically.

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

private void OnClientLoadedStartScenes(NetworkConnection conn, bool asServer)
{
    if (asServer && !conn.Scenes.Contains(gameObject.scene))
        SceneManager.AddConnectionToScene(conn, gameObject.scene);
}
```

## Final Script

```csharp
using FishNet.Connection;
using FishNet.Managing;
using FishNet.Object;
using System.Linq;
using UnityEngine;

public class SelectablePlayerSpawner : NetworkBehaviour
{
    [SerializeField] private NetworkObject[] _playerPrefabs;

    public override void OnStartServer()
    {
        SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
    }

    public override void OnStopServer()
    {
        if (SceneManager != null)
            SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
    }

    private void OnClientLoadedStartScenes(NetworkConnection conn, bool asServer)
    {
        if (asServer && !conn.Scenes.Contains(gameObject.scene))
            SceneManager.AddConnectionToScene(conn, gameObject.scene);
    }

    [ServerRpc(RequireOwnership = false)]
    public void SpawnPlayer(NetworkObject _playerPrefab, NetworkConnection sender = null)
    {
        if (sender.FirstObject != null)
        {
            Debug.LogWarning($"Client {sender.ClientId} already has a player object; not spawning another.");
            return;
        }

        if (!_playerPrefabs.Contains(_playerPrefab))
        {
            Debug.LogWarning("Invalid player prefab selected, cannot spawn.");
            sender.Kick(FishNet.Managing.Server.KickReason.ExploitAttempt);
            return;
        }

        NetworkObject obj = NetworkManager.GetPooledInstantiated(_playerPrefab, asServer: true);
        Spawn(obj, sender, gameObject.scene);
    }
}
```
