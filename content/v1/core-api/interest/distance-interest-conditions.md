---
title: "Distance interest conditions"
---

> **Using Unity?** See [Limit what a client receives by distance](../../unity/interest/limit-replication-by-distance.md).

Distance conditions are part of Nucleus Pro. A Free build has the interest system but not distance conditions.

## Subclass DistanceInterestConditionBase

`DistanceInterestConditionBase` culls or stops a `NetworkSystem` by its distance from a connection's controlled objects. It derives from `InterestPositionConditionBase`, whose `TryGetNearestControlledDistance` finds the nearest controlled object. It declares `Capabilities => InterestEffect.Spawn | InterestEffect.Stop`, since both come from one measurement.

To write your own, subclass it and implement `TryReadSourcePosition`, returning the system's world-space position. Caching, finding the connection's controlled objects and picking the nearest are handled for you.

```csharp
protected abstract bool TryReadSourcePosition(NetworkSystem networkSystem, out Vector3 position);
```

## A ladder is built from a spawn cutoff and a stop cutoff

```csharp
public DistanceInterestLadder(float stopDistance, float spawnDistance)
```

- `stopDistance`: past this, the system stops for the connection but keeps its object.
- `spawnDistance`: past this, the system is despawned.

`Resolve(float distance)` checks despawn before stop, so a distance past both cutoffs despawns.

`DistanceInterestLadder.UnsetDistance` is `0f`. A cutoff left at `0` is disabled, not "zero range": it never restricts anything.

## Distance is measured from the connection's controlled objects

Distance is measured from each of the connection's controlled objects to the system being evaluated, and the nearest wins. A player driving both a character and a vehicle stays covered near either.

`InterestManager.MaximumControlledInterestObjects` caps how many controlled systems are measured. It defaults to `DefaultMaximumControlledInterestObjects` (`1`). Set it to `InterestManager.UnlimitedControlledInterestObjects` (`0`) to measure every controlled object.

```csharp
public uint MaximumControlledInterestObjects = DefaultMaximumControlledInterestObjects;
```

**A cap below the controlled count measures arbitrary objects, not the nearest.** The cap counts `NetworkSystem`s, not objects, so a controlled prefab made of two systems takes two slots. Set the cap to the total number of systems a player controls, or to `UnlimitedControlledInterestObjects`.

## Unmeasurable pairs restrict nothing

When a distance cannot be measured, because the connection controls nothing yet or `TryReadSourcePosition` returns `false`, the condition restricts nothing. Return `false` for an object that has been destroyed or has not finished spawning. Culling on an unknown distance would empty the world for a player whose character has not finished spawning.
