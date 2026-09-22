---
title: "Moving and carrying objects between scenes"
---

## Moving a system to another scene

`SystemManager.EnsureMoveSystemToScene(NetworkSystem networkSystem, uint destinationSceneHandle)` is the one call that moves a spawned object between scene instances. It is authority-only, and it returns `false` without moving anything if the system is not started and registered, if it is a scene object or has no platform identity (only a dynamically spawned object carries a scene handle to move), or if `destinationSceneHandle` is `NetworkSystem.UnsetSceneHandle`.

```csharp
coreManager.SystemManager.EnsureMoveSystemToScene(asteroid, destinationSceneHandle);
```

If `networkSystem` belongs to a group, every member is restamped with the new scene together; a group shares one engine object and moves as a unit. The object's controller is carried along: the move requests the scene load for the controlling client before this tick's interest pass runs, so the client is walked into the destination scene rather than losing the object out from under it.

## Reading a system's scene

`NetworkSystem.SceneHandle` names the scene instance the system currently belongs to. `NetworkSystem.UnsetSceneHandle` (zero) means the scene every peer already booted into - the boot scene needs no handle, since nothing has to carry a client into a scene it already holds.

`NetworkSystem.SceneChanged` fires whenever the handle changes: on the authority as it performs the move, and on a client as it applies the change.

```csharp
networkSystem.SceneChanged += (previousSceneHandle, currentSceneHandle) =>
{
    // previousSceneHandle: the scene the system was in before the move.
    // currentSceneHandle: the scene it is in now.
};
```

## When the destination can't take it

Carrying an object into another scene means walking that object's controlling client into the destination scene along with it. Two different things can go wrong on that client's end, and they are not the same failure:

- **A carry failure.** The client's scene load for the destination scene fails outright. The object has lost the controller that was meant to follow it.
- **A refusal.** The client's scene loader will not hold another scene at once, so the load is refused rather than failing - the fix is placing the client with `SceneReplaceMode.AllScenes` instead of loading additively. Nothing about the object or its content was wrong, and the object is still perfectly reachable once the client is placed correctly. A refusal deliberately does not trigger carry-failure resolution; despawning or surrendering control here would punish the object for a load the engine itself asked for additively.

## Deciding what happens on a carry failure

`SceneCarryFailureAction` is the outcome for an object whose controlling client failed to load the destination scene:

- `SurrenderControl` - return the object to the server's control and leave it where it is. The default. Destroys nothing and strands nothing: the client stops driving something it can't reach, and the object stays live for whoever is actually in the scene.
- `Despawn` - despawn the object (the whole group, since a group is one object). What a player's avatar usually wants, since the client that was going to drive it never arrived.
- `Retain` - leave the object exactly as it is, controller included. The engine does nothing further, so the game is expected to resolve the failure itself, typically by moving the object back and asking the client into that scene instead.

The action is resolved once, per carried object, on the failing edge, from three layers:

1. **`SceneManager.SceneCarryFailure`** - the world-wide default. Defaults to `SceneCarryFailureAction.SurrenderControl`.
2. **`NetworkSystem.SceneCarryFailureOverride`** - a nullable per-object override, for the cases where the blanket default reads wrong (a player's avatar in a world where everything else should surrender control, say). Null takes the manager's default.
3. **A registered `ISceneCarryFailureResolver`** - decides case by case, and outranks both of the above.

```csharp
public SceneCarryFailureAction? SceneCarryFailureOverride { get; set; }
```

### Resolving case by case

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

`defaultSceneCarryFailureAction` is what would happen without this resolver - the object's override, or the manager's default if it has none. Returning it unchanged is how a resolver declines a case, so a resolver only has to speak about the objects it cares about; several resolvers can be registered at once and each hands the next the answer so far.

Register and unregister a resolver on the `SceneManager`:

```csharp
coreManager.SceneManager.RegisterSceneCarryFailureResolver(resolver);
coreManager.SceneManager.UnregisterSceneCarryFailureResolver(resolver);
```

## In Unity

A root GameObject bound to its scene follows the move automatically. A parented GameObject is refused and stays in its parent's scene. An object whose scene binding is not yet resolved is parked until it resolves. See the Unity scene events page for the detail.
