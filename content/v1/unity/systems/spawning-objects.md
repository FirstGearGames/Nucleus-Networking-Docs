---
title: "Spawning and despawning objects"
---

> **Driving the core API directly?** See [Starting and stopping systems](../../core-api/systems/spawning-systems.md).

## Declaring what an object needs

`NetworkSystemObjectPool.RequireSystem<TSystem, TComponent0...>` is the form to reach for from a component sitting on a marker. It declares what the object needs once, and hands the system over the moment one exists: replayed immediately if the object already holds a matching system, rented on the spot if this peer creates it, or delivered through the marker's link event when the wire brings it instead.

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

`OnSystemReleased` is optional — pass `null` when there is nothing to reset. Both handlers are typed as `NetworkSystemAcquiredHandler` and `NetworkSystemReleasedHandler`.

A direct call to `Rent` asks too early on a transport that has not finished starting, and misses a system that already linked before the call ran. `RequireSystem` owns both: it retries while the transport comes up, and adopts a system that linked before the subscription existed. Reach for `Rent` instead only when a script wants the system back synchronously, such as a driver creating an object's system at a moment of its own choosing.

## Renting directly

`NetworkSystemObjectPool.Rent<TSystem, TComponent0...>(contextComponent, canStartSystem = true)` is the one-shot form. One call is correct on every peer:

```csharp
NetworkSystem system = NetworkSystemObjectPool.Rent<NetworkSystem, UnityLocalTransformComponent>(this);
```

The call resolves its `CoreManager` from `NucleusUnity`, so nothing is passed in. Internally it branches on the calling peer's situation:

- **A wire spawn is staging.** The integration is mid-`Instantiate` for an incoming spawn, and the rent returns the system the wire already built rather than constructing a new one.
- **A client scene object.** The system is built locally, unstarted, and parked by scene identifier until the server's spawn binds it.
- **The server.** The system is rented and started with the marker's platform identity, which is what replicates it to observers.

## The marker, and renting more than once

The context component supplies the marker: the rent locates a `NetworkSystemObject` on the component itself, or walks up through its parents. A second rent against the same marker is supported — the systems auto-group, sharing one `GroupId` so a receiver hosts every member on a single GameObject instead of instantiating a second prefab:

```csharp
// Both calls target `this`, so both systems land on the one marker and share a GroupId.
NetworkSystemObjectPool.Rent<NetworkSystem, UnityLocalTransformComponent>(this);
NetworkSystemObjectPool.Rent<NetworkSystem, ColorPulseComponent>(this);
```

What is refused is a rent whose composition does not match a staged wire spawn: on a receiving client, a rent inside a freshly instantiated prefab's `Awake` must ask for the same `TSystem` and the same NetworkComponent types the wire actually sent for that member, or the call logs an error and returns null. Up to 64 NetworkComponent type arguments are generated for both `Rent` and `RequireSystem` (`TComponent0` through `TComponent63`).

## Despawning

`NetworkSystemObject.Despawn()` despawns the object on the server. It stops every system linked to the marker, which replicates the despawn to observers, and requests the systems return to their pool once the stop completes:

```csharp
_networkSystemObject.Despawn();
```

A call with no linked system is a no-op. Only the server may despawn a replicated system — a client call is refused. On the receiving side, a dynamic prefab's GameObject returns to the prefab pool for reuse; a scene object's GameObject is destroyed, since it is a fixed instance rather than a poolable one.

## Where the object lands

A spawn arrives as a full serialization that is deserialized before the prefab instantiates, so the framework reads the spawned system's pose before creating the GameObject rather than moving it into place afterward. If the system carries a `UnityTransformComponentBase`, its `ReplicatedPosition`, `ReplicatedRotation`, and `LocalScale` supply the instantiate pose. If the system carries no transform component, the prefab's own authored transform is used instead. Either way, the instance is produced already positioned — there is no frame where it sits at the origin waiting to be moved.

A system whose position is driven by a controller — a `ProjectedRigidbody` another peer simulates — is not placed by `Instantiate` at all. The controlling peer builds its own copy from the prefab and asserts the prefab's pose back within a tick, so a server-chosen spawn point set through `Instantiate` is overwritten almost immediately. Derive or publish the spawn point so the controlling peer can place itself.

## Two things you won't find

There is no separate `Spawn` call for an object already sitting in a loaded scene — the same `Rent` or `RequireSystem` call that spawns a dynamic prefab also resolves a scene object, built locally and bound once the server's spawn arrives.

There is no per-spawn payload parameter on `Rent` or `RequireSystem`. A NetworkComponent's fields carry current state, not one-time spawn arguments, so a late-joining observer's first read is simply the last value written, not a message it missed.
