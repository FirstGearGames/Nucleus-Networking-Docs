---
title: "Starting and stopping systems"
---

> **Using Unity?** See [Spawning and despawning objects](../../unity/systems/spawning-objects.md).

## Starting a system

`SystemManager.EnsureStartSystem` has two overloads. The plain one is for a system with no engine object behind it — pure code:

```csharp
bool started = coreManager.SystemManager.EnsureStartSystem(networkSystem);
```

The system must already be initialized. It carries `NetworkSystem.UnsetPlatformId`, so a receiver builds it with no engine object behind it. Find it on the receiving side through `SystemManager.SystemStarted` or a `NetworkSystemWatch` — there's no engine object for a script to have a reference to.

The fuller overload is for a system an integration is binding to an object it already owns:

```csharp
bool started = coreManager.SystemManager.EnsureStartSystem(
    networkSystem,
    platformId,
    isSceneObject: false,
    prefabBundleId: 0,
    sceneHandle: NetworkSystem.UnsetSceneHandle);
```

- `platformId` correlates the system with an engine object for replication; a scene object's identifier within its scene, or a dynamic prefab's local identifier within its shard.
- `isSceneObject` is true when `platformId` identifies a scene object rather than a dynamically spawned prefab.
- `prefabBundleId` is the content shard's bundle identifier for a dynamically spawned prefab; zero is the base build's default shard, and scene objects carry none.
- `sceneHandle` is the live scene instance the system belongs to, so a receiver binds a scene object to the right instance and instantiates a dynamic prefab into the right scene; it defaults to unset, which is every world that opens no scenes.

## Stopping a system

```csharp
bool stopped = coreManager.SystemManager.EnsureStopSystem(networkSystem, isPoolReturnRequestedOnDespawn: true);
```

An accepted stop moves the system to `Stopping` immediately and despawns it on observers, then completes: the system moves to `Stopped`, its Id is released, and the registered spawn handler is notified. Keep no reference to a system that arrived from the server after that. A locally rented system stays owned by the code that rented it unless `isPoolReturnRequestedOnDespawn` asks for it to be returned to the pool too.

Only the server stops a replicated system. A pure client's stop request is refused. A peer with no started transport (offline usage) can stop its own systems freely.

## Shorthands

`NetworkSystemExtensions` gives both calls as instance methods that resolve the `CoreManager` from the system itself:

```csharp
networkSystem.EnsureStart();
networkSystem.EnsureStop(isPoolReturnRequestedOnDespawn: true);
```

Both return false and log instead of throwing if the system is null or its `CoreManager` reference isn't set.

## Deferred start and stop

A start or stop that lands mid-tick doesn't always take effect on that tick.

A start called too late for the tick's state flush is deferred: the system stays fully usable to the caller (rented, initialized, components in place), but its Id stays unset and it goes live only after the next tick increments.

A stop called after the tick's state flush is held the same way and takes effect on the *next* tick, where receivers remove the system before applying anything new.

If a system is started again while a stop is still pending on it, the restart cancels the pending stop: the system stays `Started` with its identity intact, and the queued despawn is withdrawn. If the despawn had already been sent this tick, the receivers that just removed the system are given it again on the next tick. This is what lets a spawn-then-despawn-then-spawn sequence in the same tick resolve to the latest intent.

## Reliable despawn

A despawn is reliable: a peer that loses the packet carrying it still removes the system, so a lost packet never leaves a peer holding a ghost.

## Observing the roster from your own code

```csharp
coreManager.SystemManager.SystemStarted += networkSystem =>
{
    // Raised once a system has completed its start on this peer, whether this
    // peer created it or a wire spawn built it.
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
    // Unset sentinel — in which case networkSystem comes back null.
}

coreManager.SystemManager.UnknownSystemDeltaReceived += (connection, systemId) =>
{
    // Received state named a system this peer doesn't have. That means a
    // missed spawn or a more serious desync.
};
```

`SystemStarted` and `SystemStopped` are the broad half of the discovery surface — a subscriber that wants every system and will sort them out itself. A subscriber that knows the exact composition it wants should register a system watch instead and be handed only those.

## Moving a started system between scene instances

```csharp
coreManager.SystemManager.EnsureMoveSystemToScene(networkSystem, destinationSceneHandle);
```

This is the one path that moves a spawned object between scenes — nothing in interest, physics, or scene loading calls it on its own. It's server-only, and only for a started, dynamically spawned system (not a scene object) that carries a platform identity. The move restamps the system's scene handle in place, preserving its Id, controller, access and group, then re-evaluates interest so a peer no longer in the destination scene is despawned and a peer newly in it receives the system as a spawn. See the scenes category for how scene instances and handles work.

## A spawn can carry one-time data

A spawn payload is a block of data attached to one object's spawn: a random seed, a loot table or a launch speed that the object needs when it arrives but that no member should keep replicating. Derive from `NetworkSpawnPayload`, write and read your own values, and declare an instance on the system before it spawns:

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

- The payload arrives with the object's spawn, including the spawn a late joiner or a peer that regains interest receives, and it is never sent in the updates in between. Declare it in the same call stack as the rent, exactly as you write a component's opening values.
- A receiver reads it into an instance of its own, available as `networkSystem.SpawnPayload`. It is read after the object's member values, so `ReadSpawnPayload` can already see them and use them to decide what else to read. `ReadSpawnPayload` must read exactly what `WriteSpawnPayload` wrote, and it can run more than once for one object, so whatever it applies has to be harmless to repeat.
- Declare it on the peer that creates the object. That is the server, or, for a predicted spawn, the client predicting it: that client can create the object, set its payload and spawn it, and the server passes the payload on to everyone else. A client cannot change a payload once the object exists.
- Every concrete payload type is registered for you. A concrete payload type without a public parameterless constructor is a build error, because a receiver has to construct it.
- A system can carry a payload and nothing else. Rent one with no components through `NetworkSystemPool.TryRent<NetworkSystem>(coreManager, out NetworkSystem networkSystem)` and declare the payload on it.

## A system can reach a peer a tick or two after it starts

A system may not start replicating to a given peer the instant it starts. Spawn admission is paced, so a peer can see the system a tick or two later than the tick it actually started on (see Interest Management).
