---
title: "Starting and stopping systems"
---

> **Using Unity?** See [Spawning and despawning objects](../../unity/systems/spawning-objects).

## Starting a system

`SystemManager.EnsureStartSystem` has two overloads. The plain one is for a system with no engine object behind it — pure code:

```csharp
bool started = coreManager.SystemManager.EnsureStartSystem(networkSystem);
```

The system must already be initialized. It carries `NetworkSystem.UnsetPlatformId`, so its header pays nothing for prefab, scene or parent fields it has no use for, and a receiver rebuilds it from its wire type identity alone. Find it on the receiving side through `SystemManager.SystemStarted` or a `NetworkSystemWatch` — there's no engine object for a script to have a reference to.

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

An accepted stop transitions the system to `Stopping` immediately, serializes a despawn to observers, then completes: the system transitions to `Stopped`, leaves routing, releases its Id, and the registered spawn handler is notified. A wire-constructed system always returns to its pool once that happens; a locally rented system stays owned by the code that rented it unless `isPoolReturnRequestedOnDespawn` asks the framework to recycle it too.

Only the authority stops a replicated system. A pure client's stop request is refused. A peer with no started transport (offline usage) can stop its own systems freely.

## Shorthands

`NetworkSystemExtensions` gives both calls as instance methods that resolve the `CoreManager` from the system itself:

```csharp
networkSystem.EnsureStart();
networkSystem.EnsureStop(isPoolReturnRequestedOnDespawn: true);
```

Both return false and log instead of throwing if the system is null or its `CoreManager` reference isn't set.

## Deferred start and stop

A start or stop that lands mid-tick doesn't always ride that tick's stream.

A start called too late for the tick's state flush is deferred: the system stays fully usable to the caller (rented, initialized, components in place), but its Id stays unset and it goes live only after the next tick increments, when its spawn can ride that tick's serialization.

A stop called after the tick's state flush is held the same way: it can't ride the current tick's stream, so it's held to lead the *next* tick's packets, ahead of anything else in that tick, so receivers remove the system before applying anything new.

If a system is started again while a stop is still pending on it, the restart cancels the pending stop instead of both traveling — the system stays `Started` with its identity intact, and the queued despawn is withdrawn. If the despawn hadn't serialized yet, the cancel is wire-invisible; if it had already gone out this tick, every observing client is demoted to a full serialize, so the next tick's full re-spawns the system on the receivers that just removed it. This is what lets a spawn-then-despawn-then-spawn sequence in the same tick resolve to the latest intent rather than sending both a despawn and a respawn.

## Reliable despawn

A despawn rides the unreliable state stream along with everything else. A peer that loses that one packet acknowledges straight past it and is left holding a ghost.

The server keeps a ledger of completed despawns (tick and system Id). When a peer's acknowledged tick reaches or passes a ledgered despawn it was never sent, the server re-delivers that despawn as a reliable `DespawnCleanup` message carrying the system's Id. The peer applies it immediately — cleanup isn't state-aligned, the despawn's tick has long passed, so the stop completes on receipt rather than waiting for interpolation. An Id the peer doesn't currently route is skipped silently, since the state-path despawn may have arrived after all.

The send is deliberately gated on the peer's acknowledgment reaching the despawn, never ahead of it: a cleanup sent before the acknowledgment catches up can overtake state for that system still in flight, and a peer that still held entries for a system a cleanup had already removed would read a divergence it didn't have. A joining peer is the one exception — it's swept through the whole ledger, since everything in it was despawned before that peer's stream began.

A stop that's deliberately silent (every peer performs it for itself, such as a scene release) is ledgered the same way but owes no `DespawnCleanup` — nothing is said on the wire for it.

## Observing the roster from your own code

```csharp
coreManager.SystemManager.SystemStarted += networkSystem =>
{
    // Raised once a system has completed its start on this peer, whether this
    // peer created it or a wire spawn built it.
};

coreManager.SystemManager.SystemStopped += networkSystem =>
{
    // Raised as a started system stops, immediately before a wire-constructed
    // system returns to its pool. Read what you need during the call.
};

int startedCount = coreManager.SystemManager.StartedSystemCount;

if (coreManager.SystemManager.TryGetSystemReference(id, out NetworkSystem networkSystem))
{
    // True either because the Id was found, or because id was the intentional
    // Unset sentinel — in which case networkSystem comes back null.
}

coreManager.SystemManager.UnknownSystemDeltaReceived += (connection, systemId) =>
{
    // A received delta referenced a system this peer doesn't have, so the rest
    // of that delta subpacket was abandoned. Means a missed spawn (the
    // unreliable channel can drop it) or a more serious desync.
};
```

`SystemStarted` and `SystemStopped` are the broad half of the discovery surface — a subscriber that wants every system and will sort them out itself. A subscriber that knows the exact composition it wants should register a system watch instead and be handed only those.

## Moving a started system between scene instances

```csharp
coreManager.SystemManager.EnsureMoveSystemToScene(networkSystem, destinationSceneHandle);
```

This is the one path that moves a spawned object between scenes — nothing in interest, physics, or scene loading calls it on its own. It's authority-only, and only for a started, dynamically spawned system (not a scene object) that carries a platform identity. The move restamps the system's scene handle in place, preserving its Id, controller, access and group, then re-evaluates interest so a peer no longer in the destination scene is despawned and a peer newly in it is served a full. See the scenes category for how scene instances and handles work.

## Two things worth knowing

There's no spawn payload. A member replicates only its current value, not a value captured at spawn time. A peer that starts observing a system after several changes have already happened reads whatever the member's current value is — the last write, not the history in between.

A system may not start replicating to a given peer the instant it starts. Spawn admission is paced, so a peer can see the system a tick or two later than the tick it actually started on (see Interest Management).
