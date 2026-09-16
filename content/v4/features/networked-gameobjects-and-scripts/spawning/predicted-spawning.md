> **Important:** Currently predicted spawns cannot be nested during the spawning process. This limitation is planned to be removed in a future version.

The term predicted spawning also means predicted despawning, where the client may despawn the object locally while awaiting a server response.

## Global Settings

By default predicted spawning is disabled. To enable predicted spawning you must adjust settings on your `ServerManager`. If you do not already have a `ServerManager` then you must add one to your `NetworkManager` object to change settings.

The enabled state of this feature can be set by checking **Allow Predicted Spawning** on the `ServerManager`. You may also adjust the **Reserved Object Ids** value. To learn more about these visit the ServerManager component section.

## Settings Per Object

Even with predicted spawning enabled globally, `NetworkObject`s must be set to also allow predicted spawning or despawning. This ensures that only the objects you specify may use this feature, allows you to limit predicted spawning capabilities for the object, and lets you use custom code to further validate or control predicted spawning.

For prefabs or scene objects you wish to allow predicted spawning on, add the `PredictedSpawn` component to them.

> **Tip:** You can inherit the `PredictedSpawn` component for overrides to customize predicted spawning.

## Using Predicted Spawning

Once enabled globally and per your desired objects, predicted spawning and despawning may be used on clients as though they were the server. All of the same spawn and despawn methods work, including even specifying who may own the object when spawned.
