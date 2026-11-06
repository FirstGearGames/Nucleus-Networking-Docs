---
title: "Moving and carrying objects between scenes"
---

## Move a system to another scene

`SystemManager.EnsureMoveSystemToScene(NetworkSystem networkSystem, uint destinationSceneHandle)` moves a spawned object to another scene instance. It is server-only, and returns `false` without moving anything when:

- the system is not started and registered;
- it is a scene object or has no platform identity (only a dynamically spawned object can move);
- `destinationSceneHandle` is `NetworkSystem.UnsetSceneHandle`.

```csharp
coreManager.SystemManager.EnsureMoveSystemToScene(asteroid, destinationSceneHandle);
```

A system in a group moves with its whole group. The move also asks the object's controlling client into the destination scene, so the client follows the object instead of losing it.

## Read a system's scene

`NetworkSystem.SceneHandle` is the instance the system belongs to. `NetworkSystem.UnsetSceneHandle` (zero) means the boot scene every peer already holds.

`NetworkSystem.SceneChanged` fires when the handle changes: on the server as it moves the system, and on a client as it applies the move.

```csharp
networkSystem.SceneChanged += (previousSceneHandle, currentSceneHandle) =>
{
    // previousSceneHandle: the scene the system was in before the move.
    // currentSceneHandle: the scene it is in now.
};
```

## A refusal is not a carry failure

When the controlling client cannot follow the object, one of two things happened:

- **Carry failure**: the client's load of the destination scene failed. The object has lost the controller meant to follow it, and `SceneCarryFailureAction` decides what happens next.
- **Refusal**: the client's loader will not hold another scene at once. Place the client with `SceneReplaceMode.AllScenes` instead of loading the scene additively. The object is unaffected: it is not despawned or released from control.

## Decide what happens on a carry failure

`SceneCarryFailureAction` values:

- `SurrenderControl` (default): return the object to server control and leave it where it is, live for whoever is in the scene.
- `Despawn`: despawn the object, and its whole group. Usually right for a player's avatar.
- `Retain`: change nothing, controller included. Your game resolves it, typically by moving the object back and asking the client into that scene.

The action is resolved once per carried object. Each layer below outranks the one before it:

1. `SceneManager.SceneCarryFailure`: the world-wide default, `SceneCarryFailureAction.SurrenderControl`.
2. `NetworkSystem.SceneCarryFailureOverride`: a per-object override. Null uses the manager's default.
3. A registered `ISceneCarryFailureResolver`: decides case by case.

```csharp
public SceneCarryFailureAction? SceneCarryFailureOverride { get; set; }
```

### Resolve case by case

```csharp
public interface ISceneCarryFailureResolver
{
    SceneCarryFailureAction ResolveSceneCarryFailure(
        Connection connection,
        NetworkSystem networkSystem,
        uint sceneHandle,
        SceneCarryFailureAction defaultSceneCarryFailureAction);
}
```

`defaultSceneCarryFailureAction` is the answer without this resolver: the object's override, or the manager's default. Return it unchanged to leave a case alone. Several resolvers can be registered, and each receives the answer so far.

```csharp
coreManager.SceneManager.RegisterSceneCarryFailureResolver(resolver);
coreManager.SceneManager.TryUnregisterSceneCarryFailureResolver(resolver);
```

## In Unity, only root GameObjects follow a move

A root GameObject bound to its scene follows the move. A parented GameObject is refused and stays in its parent's scene. An object whose scene binding is not yet resolved waits until it resolves.
