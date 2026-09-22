---
title: "Supplying positions to the interest system"
---

## Core ships no reader

The distance half of the interest system needs to know where a `NetworkSystem`'s object is, and core has no way to know that on its own. A bare `CoreManager`, with no engine integration attached, registers nothing. Every distance measurement answers unmeasurable, and because an unmeasurable position must never restrict anything, nothing is ever culled by distance. Scene-based interest still works with no reader at all; only the distance conditions and level-of-detail depend on one.

## The interface

```csharp
public interface IInterestPositionReader
{
    bool TryReadPosition(NetworkSystem networkSystem, out Vector3 position);
}
```

`Vector3` here is `System.Numerics.Vector3`, the type core replicates in. If your engine's own vector type differs, the reader is where you convert - core never sees the engine's type.

Return `false` rather than guessing for a system whose object has been destroyed or hasn't finished spawning. Don't reach for a stale or default position; an unmeasurable read must fail honestly so the caller can abstain instead of restricting on bad data.

This is the single thing an engine integration owes the distance half of interest. Everything else - memoizing, the finiteness check, the once-per-pass discipline - lives on `InterestManager`.

## Registering it

```csharp
public void SetPositionReader(IInterestPositionReader interestPositionReader);
```

Call `InterestManager.SetPositionReader` once, during setup, with your reader. Pass `null` to clear it as an integration tears down.

## Why the manager holds it, not a condition

A condition is a per-prefab object that its system hands back to a pool when it's done. If the manager adopted a reader from a condition, it would keep that instance alive past its life and could end up reading positions through an object that has since been re-rented as something else. The position reader is a property of the world, not of any one object, so it's registered on the manager and outlives everything in it.

## One read per pass

The manager caches each system's measured position for the length of one interest pass. A system read once by level-of-detail and again by a distance condition on the same tick only calls `TryReadPosition` once; every repeated ask within that pass is answered from the cache. A failed read is cached too, so a destroyed or not-yet-spawned object doesn't get probed again and again within the same pass.

Because of this, your reader owes no memoization of its own. Write the raw read and let the manager do the rest.

## A worked reader

The test harness backs its reader with a plain dictionary, which is a reasonable shape for anything that doesn't have a live scene graph to query:

```csharp
public sealed class DictionaryInterestPositionReader : IInterestPositionReader
{
    private readonly Dictionary<NetworkSystem, Vector3> _positions = new();

    public void SetPosition(NetworkSystem networkSystem, Vector3 position) => _positions[networkSystem] = position;

    public bool TryReadPosition(NetworkSystem networkSystem, out Vector3 position) => _positions.TryGetValue(networkSystem, out position);
}
```

A system nobody has recorded a position for reports unmeasurable, which is the correct default: it's a failed read, not a zero position.

## Unity

The Unity integration registers a reader for you; you don't need to write one. See [Limiting replication by distance](limit-replication-by-distance) for how it's wired up and how to configure the distance conditions that depend on it.
