## General

The options available to keep `NetworkObject`s persisting across scenes depends on the type of `NetworkObject`.

## Spawned NetworkObjects

Spawned `NetworkObject`s that do not fall into the other categories below can persist between scenes by moving them while loading into the next scene. The `SceneLoadData` that is passed into the load method of the `SceneManager` has an array you can populate with all of the spawned `NetworkObject`s you want to send to the newly loaded scene.

The `SceneManager` will handle the objects correctly for you and also log a warning if you try to send a GameObject that is not allowed.

> **Important:** If you load multiple scenes in one method call and you are moving network objects using `SceneLoadData`, the moved `NetworkObject`s will move into the first valid scene requested.

### Example

```csharp
// Create an array of NetworkObjects
// that are not Scene, Global, or Nested NetworkObjects.
NetworkObject[] objectsToMove = new NetworkObject[] { object1, object2, object3 };

// Assign this array to the SceneLoadData before you load a scene.
SceneLoadData sld = new SceneLoadData("NewScene");
sld.MovedNetworkObjects = objectsToMove;

// FishNet will handle the rest after loading!
SceneManager.LoadGlobalScenes(sld);
```

## Scene NetworkObjects

Scene `NetworkObject`s currently cannot persist across scenes; it is a limitation with the way Unity and FishNet were designed. You cannot mark them as `IsGlobal`, or put them into the "DontDestroyOnLoad" scene. If you would like a scene `NetworkObject` to persist across scenes it is recommended to remove them and use the other options available on this page.

## Global NetworkObjects

Global `NetworkObject`s work similarly to how a normal GameObject would when put into the `DontDestroyOnLoad` (DDOL) scene. When loading and unloading scenes, global `NetworkObject`s will stay in the DDOL scene on both the server and client, persisting their state. No extra steps needed.

To make a `NetworkObject` global, just mark the `IsGlobal` boolean `true` on the `NetworkObject` component.

> **Tip:** Clients are typically always an observer of the DDOL scene, so global objects may make more sense for manager-type GameObjects rather than GameObjects that have meshes — but you are not limited to this.

## Nested NetworkObjects

Unity will not allow nested GameObjects to be moved into other scenes. However, FishNet will automatically detect if you are trying to send a `NestedNetworkObject` and send the root of the object instead!
