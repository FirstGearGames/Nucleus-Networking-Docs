Instructions for how to unload networked scenes in FishNet.

## General

Unloading scenes is the same as loading scenes, except you call Unload rather than Load. Scenes can be unloaded by connection, or globally. When unloaded globally, scenes will be unloaded for all players. When unloading by connection, only the connections specified will unload the scenes.

## Unloading Scenes

### Global Scenes

Global scenes can be unloaded by calling `UnloadGlobalScenes()` in the `SceneManager`. You cannot unload a global scene with the `UnloadConnectionScenes()` method.

```csharp
SceneUnloadData sud = new SceneUnloadData("Town");
base.NetworkManager.SceneManager.UnloadGlobalScenes(sud);
```

### Connection Scenes

Connection scenes follow the same principle, but have a few method overloads. You can unload scenes for a single connection, multiple connections at once, or unload scenes on the server.

The server will only unload a connection scene on itself if all connections have been unloaded from that scene.

If you wish to unload a scene and all connections, get all the connections in the scene and call unload with those connections. `SceneManager.SceneConnections` holds all online scenes and the connections in them.

If you wish to keep a scene loaded on the server when unloading all connections, see Scene Caching.

```csharp
SceneUnloadData sud = new SceneUnloadData(new string[] { "Main", "Additive" });

// Unload scenes for a single connection.
NetworkConnection conn = base.Owner;
base.NetworkManager.SceneManager.UnloadConnectionScenes(conn, sud);

// Unload scenes for several connections at once.
NetworkConnection[] conns = new NetworkConnection[] { connA, connB };
base.NetworkManager.SceneManager.UnloadConnectionScenes(conns, sud);

// Unload scenes only on the server.
base.NetworkManager.SceneManager.UnloadConnectionScenes(sud);
```

## Advanced Info

The `SceneManager` class has very detailed XML comments on how the unload process works in detail. If you need to troubleshoot the scene unload process, these comments will help you understand the flow.

Make sure to check out the Scene Events that you can subscribe to for better control over your game.
