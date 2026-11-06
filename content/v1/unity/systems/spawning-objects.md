---
title: "Spawning and despawning objects"
---

> **Driving the core API directly?** See [Starting and stopping systems](../../core-api/systems/spawning-systems.md).

## Declare what an object needs with RequireSystem

From a component on a networked object, call `NetworkSystemObjectPool.RequireSystem<TSystem, TComponent0...>` once. It hands you the system as soon as one exists: at once if the object already holds a matching system, rented on the spot if this peer creates it, or when it arrives from the server. It also waits while the transport is still starting.

```csharp
NetworkSystemObjectPool.RequireSystem<NetworkSystem, ColorPulseComponent>(
    this,
    OnSystemAcquired,
    OnSystemReleased,
    canStartSystem: true);

private void OnSystemAcquired(NetworkSystem networkSystem)
{
    // Read/write the linked system's components here.
}

private void OnSystemReleased(NetworkSystem networkSystem)
{
    // Reset per-life state; the system has unlinked.
}
```

The handlers are `NetworkSystemAcquiredHandler` and `NetworkSystemReleasedHandler`. Pass `null` for `OnSystemReleased` when there is nothing to reset. A `NucleusBehaviour` makes this call for you; see [NucleusBehaviour: the script base class](./nucleus-behaviour.md).

## Rent directly with TryRent

`NetworkSystemObjectPool.TryRent<TSystem, TComponent0...>(contextComponent, out networkSystem, canStartSystem = true)` returns the system at once. Use it only when a script needs the system at a moment of its own choosing, such as a driver creating an object's system. Called too early, it fails while the transport is still starting and misses a system that already linked.

```csharp
if (!NetworkSystemObjectPool.TryRent<NetworkSystem, UnityLocalTransformComponent>(this, out NetworkSystem system))
    return;
```

It returns `true` once a system is linked to the object, and `false` on an error, which it logs. One call is correct on every peer:

- **On the server**, it returns a started system, which replicates to observers.
- **While a received spawn is being instantiated**, it returns the system built from that spawn.
- **On a client, for a scene object**, it returns a local, unstarted system that the server's spawn binds when it arrives.

## Know the rent rules

- The rent finds the `NetworkSystemObject` on the context component or one of its parents.
- A second rent against the same marker gives a second system. The two share one `GroupId`, so a receiver hosts both on one GameObject; see [Several systems on one object](./grouped-systems.md).
- On a receiving client, a rent in a freshly instantiated prefab's `Awake` must ask for the same `TSystem` and component types the server spawned, or it logs an error and returns `false`.
- `TryRent` and `RequireSystem` take up to 31 component types (`TComponent0` through `TComponent30`), or none for a system that carries only a spawn payload.
- When the number of components comes from data, both take a count: `TryRent<TSystem, TComponent0>(this, componentCount, out networkSystem)` and `RequireSystem<TSystem, TComponent0>(this, componentCount, onAcquired)` give one system carrying `TComponent0` that many times. A system matches only when it holds exactly that many, all of that type. Reach each with `NetworkSystem.TryGetComponent(componentId, out component)`. This is how `NetworkTransform` puts every part it lists on one system.

## A scene object needs no separate spawn call

An object already in a loaded scene is resolved by the same `TryRent` or `RequireSystem` call that spawns a dynamic prefab. It is built locally and bound once the server's spawn arrives.

## Despawn on the server

```csharp
_networkSystemObject.Despawn();
```

`NetworkSystemObject.Despawn()` stops every system linked to the object, replicates the despawn to observers, and returns the systems to their pool once the stop completes. A call with no linked system does nothing. Only the server may despawn a replicated system; a client's call is refused.

On receivers, a dynamic prefab's GameObject returns to the prefab pool, and a scene object's GameObject is destroyed.

## A received spawn arrives already in place

A received spawn is instantiated already in place, never at the origin first:

- If its system carries a `UnityTransformComponentBase`, its `ReplicatedPosition`, `ReplicatedRotation` and `LocalScale` give the pose.
- If it carries no transform component, the prefab's own transform is used, unless the marker's **Auto Transform Payload** is on, in which case it arrives at the server's parent and pose.

A body whose position its controller drives, such as a `NetworkRigidbody` another peer simulates, is the exception. The controlling peer builds its copy from the prefab and asserts the prefab's pose back within a tick, overwriting a spawn point the server chose. Derive or publish the spawn point so the controlling peer can place itself.

## Send one-time data with the spawn

Data an object needs only when it arrives, such as a random seed or a loot table, goes in a spawn payload rather than a member. Pick a payload type from **Payload** in the marker's **Spawn Payload** section, or declare one from code with `NetworkSystem.SetSpawnPayload`. [Starting and stopping systems](../../core-api/systems/spawning-systems.md) explains how payloads work and who may declare them.

An object that needs only a payload can require a system with no components: `NetworkSystemObjectPool.RequireSystem<NetworkSystem>(this, OnSystemAcquired)`.

On a client, a scene object is bound after it has already linked. Read its payload in the payload's own `ReadSpawnPayload`, or from `SystemManager.SystemStarted` or a system watch, not in `OnSystemLinked`.
