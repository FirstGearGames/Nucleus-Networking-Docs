---
title: "Binding spawns to your own engine"
---

## Register a spawn handler

`SystemManager.SetSpawnHandler(INetworkSystemSpawnHandler)` registers the one object that links a spawned `NetworkSystem` to an object in your engine. Register it once, at bootstrap:

```csharp
systemManager.SetSpawnHandler(mySpawnHandler);
```

Only spawns with a `PlatformId` reach the handler. A code-only system (`NetworkSystem.UnsetPlatformId`) never does; [watch for it](./renting-and-watching-systems.md) instead.

## Bind scene objects and link spawned prefabs

`INetworkSystemSpawnHandler` has one member for each kind of networked object, and they differ in who builds the `NetworkSystem`.

**Scene objects** already exist locally. Return the system you built for the object from `TryBindSceneObject`:

```csharp
bool TryBindSceneObject(in SceneObjectKey sceneObjectKey, out NetworkSystem networkSystem);
```

Return a system that is rented and initialized but not started; the framework assigns its identifiers and applies the incoming state. Returning `false` is an error: the scene was not loaded, or the scenes differ.

**Dynamic prefabs** are built and started by the framework, with state applied, before the handler is called. Instantiate the matching prefab and link it:

```csharp
void OnDynamicSystemSpawned(NetworkSystem networkSystem, ushort prefabBundleId,
    uint prefabLocalId, uint groupId, uint sceneHandle);
```

`prefabBundleId` is the content bundle the prefab ships in (zero is the base build). `prefabLocalId` is the prefab's identifier within that bundle, and is also the spawn's `PlatformId`.

## Look up scene objects by scene and id

A scene object's id is unique only inside its scene, and several live scenes can each hold the same id. `SceneObjectKey` carries both halves; use both to find the object:

```csharp
public readonly struct SceneObjectKey : IEquatable<SceneObjectKey>
{
    public readonly uint SceneHandle;
    public readonly uint SceneObjectId;
}
```

`SceneHandle` is the live scene instance, or `NetworkSystem.UnsetSceneHandle` for the scene the peer booted into rather than one the server opened. `SceneObjectId` is the id stamped on the object.

## Link a group's members to one instance

Systems that share a `groupId` other than `NetworkSystem.UnsetGroupId` link onto one engine instance. The first member to spawn instantiates the object; later members with the same `groupId` attach to it. Track the live instance per group id so later members can find it.

## Handle moves, reparenting and despawns

- `OnSystemSceneChanged(NetworkSystem networkSystem, uint newSceneHandle)`: the system moved to another server-opened scene. Move its object into that scene rather than rebuilding it. Must be idempotent.
- `OnSystemParentChanged(NetworkSystem childNetworkSystem, NetworkSystem parentNetworkSystem)`: re-seat the object under the new parent's object, or at the scene root when `parentNetworkSystem` is null. What the re-seat must preserve depends on the space the object's transform replicates in, which the handler reads from the object. Must be idempotent.
- `OnSystemDespawned(NetworkSystem networkSystem, bool isObjectKept)`: the system stopped, on the server once its despawn was sent, or on a receiver when the despawn applies.
  - `isObjectKept` true: an interest condition stopped the system for this peer alone and the server wants the object kept. Release the link, keep the object, and register it against `networkSystem`'s `Id` so a later re-entry spawn links onto it instead of building a second one.
  - `isObjectKept` false: release every link and destroy the object, unless the object's own destruction started the stop.
- `OnRetainedObjectReleased(uint systemId)`: the server has now culled or despawned a system whose object you kept. Reclaim the object kept under `systemId` as an ordinary despawn would. It is called for any despawn of an id this peer no longer routes, so it must do nothing when no object is kept under that id.

## Handle the failures the framework cannot catch

- **A spawn for content not yet loaded.** `OnDynamicSystemSpawned` can name a `prefabBundleId`/`prefabLocalId` pair your registry has not loaded. Load content before spawns for it can arrive, and treat an unresolved pair as an error rather than dropping the system.
- **The wrong scene.** Put each built or moved object in the scene `sceneHandle` names, not the engine's default scene. Otherwise a world with several open scenes collapses every dynamic spawn into one.
