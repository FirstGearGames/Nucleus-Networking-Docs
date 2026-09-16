---
title: "Area of Interest (Observer System)"
---
Fish-Networking features an advanced area-of-interest system that controls which clients receive updates about specific objects.

An observer is a client which can see an object and use communications for the object. You may control which clients can observe an object by using the `NetworkObserver` and/or `ObserverManager` components.

If a client is not an observer of an object, then the object will not activate, and the client will not receive network messages or callbacks for that object. Should the object be a scene object then it will remain disabled on the client until they become an observer of it. If the object is instantiated, then the client will simply not instantiate the object until after becoming an observer.

The observer system is designed to work out of the box for new developers. When it comes time to customize how clients observe objects, the observer system additionally offers a large amount of flexibility — there are many condition types, and you may also create your own.

FishNet comes with a NetworkManager prefab which contains the recommended minimum components to begin working on a new project. Within that prefab is the `ObserverManager` with an included Scene Condition. If you have not familiarized yourself with the `ObserverManager` and condition types, please do so now.

![PlayerSpawner component on the NetworkManager](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-a1811284dcc27fd42275e35933d4ada3e7100e82%2Fplayer-spawner-component.png?alt=media)

## Common Issue: Scene Objects Not Spawning for Clients

A common problem new developers encounter is scene network objects not being enabled for clients. This occurs when the client is not considered part of the scene where the object resides, and the scene condition is preventing that object from spawning for the client. The NetworkManager prefab contains a `PlayerSpawner` script which adds the player to the current scene; this makes the client an observer for objects in that scene. This requires a player object to be spawned. Should you have made your own NetworkManager object or removed the `PlayerSpawner` script you will need to add the client to the scene you wish the client to be an observer of.

When encountering such an issue you may of course also remove the `ObserverManager` or scene condition from the `ObserverManager`, but this is not recommended as objects in other scenes will attempt to spawn for clients which do not occupy such scenes. Alternatively, you may add the client to the scene where the objects reside.

You can use a script such as the following on an object in the scene. Be careful not to place it on a potentially `DontDestroyOnLoad` object such as the NetworkManager.

```csharp
using FishNet;
using FishNet.Connection;
using UnityEngine;

public class InitialSceneObserver : MonoBehaviour
{
    private void Start()
    {
        NetworkManager networkManager = InstanceFinder.NetworkManager;
        if (networkManager != null)
            networkManager.SceneManager.OnClientLoadedStartScenes += OnClientLoadedStartScenes;
    }

    private void OnDestroy()
    {
        NetworkManager networkManager = InstanceFinder.NetworkManager;
        if (networkManager != null)
            networkManager.SceneManager.OnClientLoadedStartScenes -= OnClientLoadedStartScenes;
    }

    private void OnClientLoadedStartScenes(NetworkConnection conn, bool asServer)
    {
        if (!asServer)
            return;

        if (!conn.Scenes.Contains(gameObject.scene))
            InstanceFinder.NetworkManager.SceneManager.AddConnectionToScene(conn, gameObject.scene);
    }
}
```

Under the assumption you removed the `PlayerSpawner` and/or are not using `SceneManager.AddOwnerToDefaultScene` or the method above, you must load the client into the scene using the `SceneManager`. Clients are only considered networked into scenes when those scenes are loaded using the `SceneManager`. Clients may become part of a scene by loading a scene globally or by loading a scene for a specific client (connection). See the SceneManager section for more information on how to manage networked client scenes and understand the difference between global and connection scenes.
