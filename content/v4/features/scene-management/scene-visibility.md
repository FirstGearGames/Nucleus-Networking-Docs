## General

You can control if clients become an observer of GameObjects in a scene that they are in. This is possible if you set your `ObserverManager` to include a Scene Condition. The Scene Condition ensures that `NetworkObject`s — both scene and spawned — are only visible to players in the same scene as the object. In most cases you will want to add a `NetworkObserver` component with a scene condition to your networked objects.

> **Note:** When encountering an error about being unable to find a `NetworkObject` or `RPCLink` during a scene change, you likely forgot to add the scene condition.

## Managing Visibility

### Initial Scene Load

When a client is loading into the game for the first time, the first scene/offline scene loaded is done so by the Unity `SceneManager`. This means that clients were not automatically added to the scene when connected, which also means they do not have visibility of that scene.

Once a client connects to a host or server, if you use the `PlayerSpawner` component FishNet provides on the NetworkManager, there is logic in that component that will add the client to the default scene on the player object's spawn.

> **Warning:** If you decided not to use the `PlayerSpawner` component provided on the NetworkManager in FishNet, you will either have to load a client into a scene using FishNet's `SceneManager`, or call `SceneManager.AddOwnerToDefaultScene()` on an object that you gave that client ownership of.

### Adding Client Connections to Scenes

When loading a scene globally or by connection, the `SceneManager` will automatically place that connection into the scene. Once added, that client will be able to view all `NetworkObject`s that are part of that scene.

You can add client connections to scenes manually if the scene is already loaded on the client by using `SceneManager.AddConnectionsToScene()`.

> **Note:** Manually adding and removing client connections is recommended for power users only.

### Removing Client Connections from Scenes

When unloading a scene from a client, the server will automatically remove the client connection from the scene.

If you are the host, and you unload the host's client from a scene, it will only remove the host from the scene and the host's client will lose visibility. See Host Behaviour in the Scene Caching guide for more details.

You can remove a client manually from a loaded scene by using `SceneManager.RemoveConnectionsFromScene()`.
