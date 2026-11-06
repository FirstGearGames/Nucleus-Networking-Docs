---
title: "Starting and stopping systems"
---

> **Using Unity?** See [Spawning and despawning objects](../../unity/systems/spawning-objects.md).

## Start a system

`SystemManager.EnsureStartSystem` has two overloads. Use the plain one for a system with no engine object:

```csharp
bool started = coreManager.SystemManager.EnsureStartSystem(networkSystem);
```

The system must already be initialized. Receivers build it with no engine object, so find it there through `SystemManager.SystemStarted` or a [system watch](./renting-and-watching-systems.md).

Use the fuller overload when an integration binds the system to an object it already owns:

```csharp
bool started = coreManager.SystemManager.EnsureStartSystem(
    networkSystem,
    platformId,
    isSceneObject: false,
    prefabBundleId: 0,
    sceneHandle: NetworkSystem.UnsetSceneHandle);
```

- `platformId` links the system to an engine object: a scene object's identifier within its scene, or a dynamic prefab's local identifier within its shard.
- `isSceneObject` is true when `platformId` names a scene object rather than a dynamically spawned prefab.
- `prefabBundleId` is the content bundle of a dynamically spawned prefab. Zero is the base build; scene objects carry none.
- `sceneHandle` is the live scene instance the system belongs to, so a receiver binds or instantiates it in the right scene. Leave it unset in a world that opens no scenes.

A start called late in a tick stays `Starting`, with its Id unset, until the next tick. The system is still usable by the caller in the meantime. A peer can also see the system a tick or two after it started; see [Object pacing](../core/object-pacing.md).

## Stop a system

```csharp
bool stopped = coreManager.SystemManager.EnsureStopSystem(networkSystem, isPoolReturnRequestedOnDespawn: true);
```

An accepted stop moves the system to `Stopping` at once and despawns it on observers, including any that lose packets. At the end of the tick it moves to `Stopped`, its Id is released, and the spawn handler is notified. Keep no reference to a system that arrived from the server after that. A system you rented stays yours unless `isPoolReturnRequestedOnDespawn` returns it to the pool.

- Only the server stops a replicated system. A client's stop is refused. A peer with no started transport (offline) can stop its own systems.
- A stop called late in a tick takes effect on the next tick.
- Starting a system again while its stop is pending cancels the stop: the system stays `Started` with its identity intact. A spawn, despawn and spawn in the same tick resolves to the latest one.

## Use the shorthands on the system

`NetworkSystemExtensions` offers both calls as instance methods that find the `CoreManager` from the system. Both return false and log, rather than throw, when the system is null or has no `CoreManager`.

```csharp
networkSystem.EnsureStart();
networkSystem.EnsureStop(isPoolReturnRequestedOnDespawn: true);
```

## Observe the roster from your own code

```csharp
coreManager.SystemManager.SystemStarted += networkSystem =>
{
    // Raised once a system has completed its start on this peer, whether this
    // peer created it or it arrived from the network.
};

coreManager.SystemManager.SystemStopped += networkSystem =>
{
    // Raised as a started system stops. Read what you need during the call,
    // and keep no reference to a system that arrived from the server.
};

int startedCount = coreManager.SystemManager.StartedSystemCount;

if (coreManager.SystemManager.TryGetSystemReference(id, out NetworkSystem networkSystem))
{
    // True either because the Id was found, or because id was the intentional
    // Unset value, in which case networkSystem comes back null.
}

coreManager.SystemManager.UnknownSystemDeltaReceived += (connection, systemId) =>
{
    // Received state named a system this peer doesn't have. That means a
    // missed spawn or a more serious desync.
};
```

To be handed only systems of one composition, register a [system watch](./renting-and-watching-systems.md) instead.

## Move a started system between scene instances

```csharp
coreManager.SystemManager.EnsureMoveSystemToScene(networkSystem, destinationSceneHandle);
```

This is the only call that moves a spawned object between scenes; nothing calls it for you. It is server-only, and only for a started, dynamically spawned system (not a scene object) with a platform identity. The system keeps its Id, controller, access and group. Peers no longer in the destination scene despawn it, and peers newly in it receive it as a spawn. See the scenes category for scene instances and handles.

## Send one-time data with a spawn

A spawn payload is data attached to one object's spawn, such as a random seed, a loot table or a launch speed, that the object needs when it arrives but no member should keep replicating. Derive from `NetworkSpawnPayload` and declare an instance on the system in the same call stack as the rent:

```csharp
public class CrateSpawnPayload : NetworkSpawnPayload
{
    public int LootTableIndex;

    public override void WriteSpawnPayload(Writer writer, NetworkSystem networkSystem) => writer.WriteInt32(LootTableIndex);

    public override void ReadSpawnPayload(Reader reader, NetworkSystem networkSystem) => LootTableIndex = reader.ReadInt32();
}

if (NetworkSystemPool.TryRent<NetworkSystem, CrateComponent>(coreManager, out NetworkSystem networkSystem))
    networkSystem.SetSpawnPayload(new CrateSpawnPayload { LootTableIndex = 3 });
```

- The payload arrives with every spawn of the object, including for a late joiner or a peer that regains interest, and never in the updates between.
- A receiver reads it into its own instance, available as `networkSystem.SpawnPayload`. Member values are already applied, so `ReadSpawnPayload` can use them to decide what to read.
- `ReadSpawnPayload` must read exactly what `WriteSpawnPayload` wrote. It can run more than once for one object, so whatever it applies must be safe to repeat.
- Declare it on the peer that creates the object: the server, or the client predicting a predicted spawn, whose payload the server passes on. A client cannot change a payload once the object exists.
- Every concrete payload type is registered for you. One without a public parameterless constructor is a build error.
- A system can carry a payload and nothing else: rent it with `NetworkSystemPool.TryRent<NetworkSystem>(coreManager, out NetworkSystem networkSystem)`.
