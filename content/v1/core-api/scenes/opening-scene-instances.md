---
title: "Opening and closing scene instances"
---

## Open an instance

`SceneManager.TryOpenScene(ushort sceneId, SceneScope sceneScope, out uint sceneHandle, SceneReplacePolicy sceneReplacePolicy = SceneReplacePolicy.Released)` opens a live instance of a scene on the server and returns its handle. `OpenSceneAsync(ushort sceneId, SceneScope sceneScope, SceneReplacePolicy sceneReplacePolicy = SceneReplacePolicy.Released)` does the same and completes once the scene has loaded.

```csharp
if (sceneManager.TryOpenScene(myDungeonSceneId, SceneScope.Connections, out uint sceneHandle))
{
    // sceneHandle identifies this instance.
}
```

```csharp
uint sceneHandle = await sceneManager.OpenSceneAsync(myLobbySceneId, SceneScope.Global);
```

Every open makes a new, independent instance, even for a scene id already open. Handles are never reused.

## Choose a scope

`SceneScope` cannot change after opening:

- `SceneScope.Connections`: opening places nobody. The game places clients later.
- `SceneScope.Global`: opening places every connected client, and a client that authenticates while the instance is open is placed as part of authentication.

`SceneManager.JoinPlacement` also places newly authenticated clients, and by default that includes `Connections` instances. See [Placing clients in scenes](./placing-clients-in-scenes.md).

## Choose a replace policy

`SceneReplacePolicy`, chosen at open time, decides whether a client keeps this instance when a different placement later replaces what it holds:

- `SceneReplacePolicy.Released` (default): the replacing placement releases this instance along with everything else.
- `SceneReplacePolicy.Retained`: the client stays in this instance, and only the rest is released.

An explicit close or unload always takes effect, whatever the policy.

## Read back what is open

- `OpenSceneHandles`: the handles of every open instance.
- `TryGetOpenScene(uint sceneHandle, out ushort sceneId)`: the scene id a handle belongs to.
- `TryGetSceneScope(uint sceneHandle, out SceneScope sceneScope)`: the scope it was opened with.
- `TryGetSceneReplacePolicy(uint sceneHandle, out SceneReplacePolicy sceneReplacePolicy)`: the replace policy it was opened with.

## Close an instance

`EnsureCloseScene(uint sceneHandle)`, or the awaitable `CloseSceneAsync(uint sceneHandle)`, asks the occupants to leave and then closes the instance.

If an instance was unloaded without going through the manager, call `TryNotifySceneUnloadedUnexpectedly(uint sceneHandle)`. It despawns the instance's systems and removes its occupants, since nothing else will.
