---
title: "Binding spawns to your own engine"
---

## The seam

`SystemManager.SetSpawnHandler(INetworkSystemSpawnHandler)` registers the one object that correlates a spawned `NetworkSystem` with an object in your engine. Only systems that carry a `PlatformId` reach it: a full-serialize spawn whose `PlatformId` is set is routed to the handler, while a code-only system (`PlatformId` of `NetworkSystem.UnsetPlatformId`) never does and keeps the framework's default construction path. If you need to react to a code-only system starting, watch for it instead of expecting the spawn handler to fire.

Register the handler once, at bootstrap:

```csharp
systemManager.SetSpawnHandler(mySpawnHandler);
```

## Two object categories, two directions of control

`INetworkSystemSpawnHandler` has two members that mirror the two kinds of networked object, and they invert who builds the `NetworkSystem`:

- **Scene objects** already exist locally before any spawn arrives. The receiver builds the system itself, and the wire only has to bind onto it. `TryBindSceneObject` hands back that already-built system:

```csharp
bool TryBindSceneObject(in SceneObjectKey sceneObjectKey, out NetworkSystem networkSystem);
```

  A `false` result is an error at the call site: the scene was not loaded, or the scenes diverge. The returned system has been rented and initialized but not started; the framework assigns its network identifiers and applies the incoming state.

- **Dynamic prefabs** are the opposite: the framework builds and starts the system from its wire type identity first, and only then tells the handler, so the handler can instantiate the matching prefab and link it:

```csharp
void OnDynamicSystemSpawned(NetworkSystem networkSystem, ushort prefabBundleId,
    uint prefabLocalId, uint groupId, uint sceneHandle);
```

  `prefabBundleId` is the content shard the prefab ships in (zero is the base build's default shard); `prefabLocalId` is the prefab's local identifier within that shard, and is also the spawn's `PlatformId`. By the time this is called the system is fully started with its state already applied, so the handler is free to instantiate and link immediately.

## SceneObjectKey

A scene object's identifier is only unique inside the scene file it was stamped in. Two live instances of the same scene, or two different scenes, can each hold an object stamped with the same id. `SceneObjectKey` pairs the two halves so a receiver holding several scenes at once binds a spawn to the right instance rather than just the right id:

```csharp
public readonly struct SceneObjectKey : IEquatable<SceneObjectKey>
{
    public readonly uint SceneHandle;
    public readonly uint SceneObjectId;
}
```

`SceneHandle` is the live scene instance the object belongs to (or `NetworkSystem.UnsetSceneHandle` when the peer is in whatever scene it booted into rather than one the server opened). `SceneObjectId` is the id stamped on the object, unique only inside its one scene. Both halves are required to look a scene object up correctly.

## Group handling

`OnDynamicSystemSpawned` takes a `groupId`. Systems that share a non-`NetworkSystem.UnsetGroupId` group id are meant to link onto **one** engine instance rather than each getting their own: the first member to spawn instantiates the object, and every later member with the same `groupId` attaches to that same instance instead of instantiating a second one. Track the live instance per group id so a later member can find it.

## The rest of the contract

- `OnSystemSceneChanged(NetworkSystem networkSystem, uint newSceneHandle)` — the system moved to a different server-opened scene; relocate its linked object into that scene rather than rebuilding it. Must be idempotent, since a redundant re-delivery can invoke it for a move already applied.
- `OnSystemParentChanged(NetworkSystem childNetworkSystem, NetworkSystem parentNetworkSystem)` — the system's parent changed; re-seat the linked object under the new parent's linked object, or back to the scene root when `parentNetworkSystem` is null. What the re-seat must preserve depends on the space the object's transform replicates in, which the handler reads from the object itself. Also idempotent.
- `OnSystemDespawned(NetworkSystem networkSystem, bool isObjectKept)` — the system stopped, on the server once its despawn has serialized to observers, or on a receiver when the server's despawn applies. `isObjectKept` is true when an interest condition stopped the system for this peer alone and the server wants the engine object retained rather than reclaimed: release the link, but keep the object and register it against `networkSystem`'s `Id` so a later re-entry spawn links onto it instead of building a second one. `false` is every ordinary despawn, where the handler releases every link it holds and destroys the object (unless the object's own destruction is what initiated the stop).
- `OnRetainedObjectReleased(uint systemId)` — the counterpart to a kept object: the server has now culled the system outright, or despawned it for everyone, so the object parked under `systemId` should be reclaimed exactly as an ordinary despawn would. Called for every despawn naming an id this peer no longer routes, so it must be a no-op when nothing is retained under that id.

## Failure modes the handler owns

Two things the handler is responsible for getting right that the framework cannot catch for you:

- **A spawn for an unregistered bundle.** `OnDynamicSystemSpawned` can be called with a `prefabBundleId`/`prefabLocalId` pair your content registry has not loaded yet. Content must be loaded before spawns for it can arrive; treat an unresolved pair as an error rather than silently dropping the system.
- **Placing the instance in the named scene.** The handler must put the freshly built or moved object in the scene `sceneHandle` names, not in whatever scene the engine would place a new object into by default. A world holding several open scenes otherwise collapses every dynamic spawn into one scene.

## Reference implementation

`Nucleus.Integrations.Unity.Managers.Systems.UnitySystemSpawnHandler` is the shipped Unity implementation of this interface and is the best worked example to read end to end. It keeps a dictionary of pending scene-object systems keyed by `SceneObjectKey`, a dictionary of live instances keyed by group id, and a dictionary of retained instances keyed by system id; its `PlaceInScene` method is the concrete answer to the scene-placement failure mode above, and its unregistered-bundle check in `OnDynamicSystemSpawned` is the concrete answer to the other one. A non-Unity engine integration implements the same five methods against its own object model the same way.
