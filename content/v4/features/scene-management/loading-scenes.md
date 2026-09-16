Instructions for loading networked scenes with FishNet, both on the server and on clients.

## General

This guide will go over how to setup and load new scenes, how to load into existing scenes, how to replace scenes, and advanced info on what happens behind the scenes during a load.

> **Tip:** Having a simple online and offline scene is very easy to do through the built-in `DefaultScene` component.

> **Note:** Loading scenes globally or by connection will add the specified client's connection as an Observer to the scenes if utilizing the `ObserverManager`'s Scene Condition — so globally will add all clients as Observers, and by connection will only add the connections specified. See Scene Visibility for more info.

> **Note:** In the examples below, all `SceneManager` calls are done inside a `NetworkBehaviour` class, which is why you can get a reference to `SceneManager` by doing `base.SceneManager`. If you would like a reference outside of a `NetworkBehaviour`, consider using `InstanceFinder.SceneManager`.

## Setup

Before calling the `SceneManager`'s load scene functions you will need to set up the load data to tell the `SceneManager` how you want it to handle the scene load.

**SceneLookupData** — The class used to specify what scene you want the `SceneManager` to load. You do not need to create the lookup data manually but can instead use the `SceneLoadData` constructors which will create the `SceneLookupData` automatically.

**SceneLoadData** — When loading a scene in any way, you must pass in an instance of a `SceneLoadData` class into the load methods. This class provides the scene manager all of the info it needs to load the scene or scenes properly.

## Loading New Scenes

Scenes can be loaded globally or for any number of specified clients, including none (which will only load the scene on the server).

> **Note:** Loading new scenes can only be done by name; you cannot use handles or scene references.

### Global Scenes

Global scenes can be loaded by calling `LoadGlobalScenes()` in the `SceneManager`. When loaded globally, scenes will be loaded for all current and future clients.

```csharp
SceneLoadData sld = new SceneLoadData("Town");
base.SceneManager.LoadGlobalScenes(sld);
```

### Connection Scenes

Connection scenes follow the same principle but have a few method overloads. You can load scenes for a single connection, multiple connections at once, or load scenes only on the server in preparation for connections. When loading by connection, only the connections specified will load the scenes.

```csharp
SceneLoadData sld = new SceneLoadData("Main");

// Load scenes for a single connection.
NetworkConnection conn = base.Owner;
base.SceneManager.LoadConnectionScenes(conn, sld);

// Load scenes for several connections at once.
NetworkConnection[] conns = new NetworkConnection[] { connA, connB };
base.SceneManager.LoadConnectionScenes(conns, sld);

// Load scenes only on the server. This can be used to preload scenes
// that you don't want all players in yet.
base.SceneManager.LoadConnectionScenes(sld);
```

### Loading Multiple Scenes

Whether loading globally or by connection, you can load more than one scene in a single method call. When loading multiple scenes in one call, the `NetworkObject`s you put into `MovedNetworkObjects` will be moved to the first valid scene in the list of scenes you tried to load.

```csharp
// Loading multiple connections into multiple scenes.
string[] scenesToLoad = new string[] { "Main", "Additive" };
NetworkConnection[] conns = new NetworkConnection[] { connA, connB, connC };
SceneLoadData sld = new SceneLoadData(scenesToLoad);
base.SceneManager.LoadConnectionScenes(conns, sld);
```

## Loading Existing Scenes

If the scene is already loaded on the server and you want to load clients into that instance of the scene, most likely you will want to look up that scene by scene reference or handle to make sure you are getting the exact scene you need.

If you load the scene by name, it will load the connections into the first scene found with that name. If you are utilizing Scene Stacking, then there may be multiple scenes loaded with the same name.

### Getting References to a Loaded Scene

**By Event:**

```csharp
List<Scene> ScenesLoaded = new();

public void OnEnable()
{
    InstanceFinder.SceneManager.OnLoadEnd += RegisterScenes;
}

public void RegisterScenes(SceneLoadEndEventArgs args)
{
    // Only register on the server.
    if (!args.QueueData.AsServer) return;

    foreach (var scene in args.LoadedScenes)
        ScenesLoaded.Add(scene);
}

public void OnDisable()
{
    InstanceFinder.SceneManager.OnLoadEnd -= RegisterScenes;
}
```

**By Connection:**

```csharp
int clientToLookup;
InstanceFinder.ServerManager.Clients[clientToLookup].Scenes;
```

**By SceneManager.SceneConnections:**

```csharp
// SceneManager keeps a Dictionary of all connection scenes as the key
// and the client connections that are in that scene as the value.
NetworkConnection conn;
Scene sceneNeeded;

foreach (var pair in SceneManager.SceneConnections)
{
    if (pair.Value.Contains(conn))
        sceneNeeded = pair.Key;
}
```

### Using Reference to Load Into Existing Instance

```csharp
Scene sceneReference;
NetworkConnection[] conns = new[] { connA, connB };

// By reference.
SceneLoadData sld = new(sceneReference);
base.SceneManager.LoadConnectionScenes(conns, sld);

// By handle.
SceneLoadData sldByHandle = new(sceneReference.handle);
base.SceneManager.LoadConnectionScenes(conns, sldByHandle);
```

## Replacing Scenes

FishNet gives the ability to replace scenes that are already loaded on the clients with the new requested scenes to load. To replace scenes, set the `ReplaceScenes` option in the `SceneLoadData`. Replaced scenes will be unloaded before the new scenes are loaded.

**Replace None** — This is the default method when loading; it will ignore the replace options and load the scene normally.

**Replace All** — This will replace all scenes currently loaded in Unity, even ones not managed by FishNet's `SceneManager`.

```csharp
SceneLoadData sld = new SceneLoadData("DungeonScene");
sld.ReplaceScenes = ReplaceOption.All;
// This will replace all scenes loaded by FishNet or outside of FishNet,
// and load "DungeonScene".
SceneManager.LoadGlobalScenes(sld);
```

**Replace Online Only** — This will replace only scenes managed by the `SceneManager` in FishNet.

```csharp
SceneLoadData sld = new SceneLoadData("DungeonScene");
sld.ReplaceScenes = ReplaceOption.OnlineOnly;
// This will replace only scenes managed by the SceneManager in FishNet.
SceneManager.LoadGlobalScenes(sld);
```

## Advanced Info

The `SceneManager` class has very detailed XML comments on how the load process works in detail. If you need to troubleshoot the scene load process, these comments will help you understand the flow.

Make sure to check out the Scene Events that you can subscribe to in order to have better control over your game.

If you want more control over how FishNet loads and unloads scenes, you can create a custom scene processor to override FishNet's functionality.
