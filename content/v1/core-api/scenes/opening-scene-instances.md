---
title: "Opening and closing scene instances"
---

## Opening an instance

`SceneManager.TryOpenScene(ushort sceneId, SceneScope sceneScope, out uint sceneHandle, SceneReplacePolicy sceneReplacePolicy = SceneReplacePolicy.Released)` opens a live instance of a scene on the authority and returns a handle for it. There is an awaitable form, `OpenSceneAsync(ushort sceneId, SceneScope sceneScope, SceneReplacePolicy sceneReplacePolicy = SceneReplacePolicy.Released)`, which does the same thing and completes once the scene has loaded.

```csharp
if (sceneManager.TryOpenScene(myDungeonSceneId, SceneScope.Connections, out uint sceneHandle))
{
    // sceneHandle identifies this instance.
}
```

```csharp
uint sceneHandle = await sceneManager.OpenSceneAsync(myLobbySceneId, SceneScope.Global);
```

Opening a scene id twice gives two handles and two independent worlds; nothing about opening the same id again reuses or merges state with the first instance. Handles are never recycled, so a handle you have seen always refers to the same instance, and a new instance never reuses an old, closed handle's number.

## Scope: who gets placed

`SceneScope` decides who the instance is for, and it cannot be changed after opening:

- `SceneScope.Connections` - private to whichever clients the game explicitly places into it later. Opening places nobody by itself.
- `SceneScope.Global` - every client belongs in it. Opening places every already-connected client into it immediately, and a client that authenticates after the instance is already open is placed into it as part of authentication.

A `SceneScope.Connections` instance places nobody until the game asks for it. A `SceneScope.Global` instance is the one case where opening itself places clients, on top of the join-time placement every scope shares.

## Replace policy: what survives a replacement

`SceneReplacePolicy`, chosen at open time, decides what happens to this instance when a client already in it is later replaced out by a different placement:

- `SceneReplacePolicy.Released` (the default) - a replacing placement releases this instance along with everything else the client holds.
- `SceneReplacePolicy.Retained` - a replacing placement leaves the client in this instance and only releases the rest.

An explicit close or unload request always takes effect regardless of replace policy; the policy only exempts an instance from being swept aside by a *different* placement.

## Reading back what is open

- `OpenSceneHandles` - the handles of every currently open instance.
- `TryGetOpenScene(uint sceneHandle, out ushort sceneId)` - which scene id a handle belongs to.
- `TryGetSceneScope(uint sceneHandle, out SceneScope sceneScope)` - the scope it was opened with.
- `TryGetSceneReplacePolicy(uint sceneHandle, out SceneReplacePolicy sceneReplacePolicy)` - the replace policy it was opened with.

## Closing an instance

`EnsureCloseScene(uint sceneHandle)` and the awaitable `CloseSceneAsync(uint sceneHandle)` are the ordinary way to end an instance: occupants are asked to leave before the instance itself comes down.

If an instance goes away without being closed through the manager - unloaded out from under it - call `NotifySceneUnloadedUnexpectedly(uint sceneHandle)` to tell the manager. It despawns the instance's systems and removes its occupants, since nothing else will.
