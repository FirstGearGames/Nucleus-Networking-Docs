## General

When loading a scene you can specify in the `SceneLoadData` whether to `AutomaticallyUnload` the scene when all clients unload or leave the scene as an observer. When unloading the scene you can override the `AutomaticallyUnload` option by setting the `ServerUnloadMode`.

## Examples

```csharp
// When Loading Scenes.
SceneLoadData sld = new SceneLoadData("MainScene");
sld.Options.AutomaticallyUnload = false;

// When Manually Unloading Scenes.
// Whatever you set the ServerUnloadMode to here will override the AutomaticallyUnload
// setting you used when loading the scene earlier.
SceneUnloadData sud = new SceneUnloadData("MainScene");
sud.Options.Mode = ServerUnloadMode.KeepUnused;
```

## Host Behaviour

In situations where the host's server needs to keep a scene loaded, but the host's client was requested to unload that scene — instead of unloading, the host's client will be removed from the scene using the observer system, updating the client's scene visibility. As host, the server and client share the same instance of loaded scenes and GameObjects. If it were to actually unload a scene from the host client, it would also unload on the server.

> **Warning:** A Scene Condition must be set in the `ObserverManager` for you to utilize the ability to have the server keep a scene loaded while the host client does not see the objects in that scene.

> **Important:** This usually means that every GameObject with a mesh will have to have a `NetworkObject` attached if you want the host client not to visualize the scene.
