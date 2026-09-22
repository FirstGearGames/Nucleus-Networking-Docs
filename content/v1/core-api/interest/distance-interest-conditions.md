---
title: "Distance interest conditions"
---

> **Using Unity?** See [Limit what a client receives by distance](../../unity/interest/limit-replication-by-distance).

## What you subclass

`DistanceInterestConditionBase` culls or stops a `NetworkSystem` by how far it is from a connection's controlled objects. It derives from `InterestPositionConditionBase`, which owns the shared measuring logic: how a source position is looked up and cached per tick, and how the nearest controlled object is found. The base declares `Capabilities => InterestEffect.Spawn | InterestEffect.Stop` because both resolutions come from the one distance measurement, not two separate passes.

To write your own condition, subclass `DistanceInterestConditionBase` and implement `TryReadSourcePosition(NetworkSystem networkSystem, out Vector3 position)`. That is the only method an integration owes: a raw position read for the system in front of you, world space. Everything else — memoizing the read per pass, walking a connection's controlled objects, picking the nearest, and branching the ladder — is handled for you.

```csharp
protected abstract bool TryReadSourcePosition(NetworkSystem networkSystem, out Vector3 position);
```

## The ladder

Construct the condition with two cutoffs:

```csharp
public DistanceInterestLadder(float stopDistance, float spawnDistance)
```

`stopDistance` is the distance past which the system stops for the connection but keeps its spawned object. `spawnDistance` is the distance past which the system is despawned. `Resolve(float distance)` checks despawn before stop, so a distance past both cutoffs despawns rather than merely stopping — a nearer effect never masks a further, more restrictive one.

`DistanceInterestLadder.UnsetDistance` is `0f`. A cutoff set to it is disabled, not "zero range": leaving `stopDistance` or `spawnDistance` at `0` means that rung never restricts anything, regardless of measured distance.

## What the distance is from

The measurement is always from a connection's controlled objects to the system being evaluated, never from a fixed camera or observer point. `InterestPositionConditionBase.TryGetNearestControlledDistance` walks the connection's controlled `NetworkSystem`s, reads each one's position through the same `TryReadSourcePosition` hook, and keeps the nearest. Nearest wins across multiple controlled objects, so a system is interesting if it's near any of them — a player driving both a character and a vehicle stays covered.

How many controlled objects are measured is capped by `InterestManager.MaximumControlledInterestObjects`, defaulting to `DefaultMaximumControlledInterestObjects` (`1`). Set it to `InterestManager.UnlimitedControlledInterestObjects` (`0`) to measure every controlled object instead.

```csharp
public uint MaximumControlledInterestObjects = DefaultMaximumControlledInterestObjects;
```

**A ceiling below the controlled count keeps an arbitrary object, not the nearest one.** Controlled objects are held in a set, so a ceiling of one against a player driving three things measures whichever the set hands back first. Picking the nearest instead would mean measuring all of them — the exact cost the ceiling exists to avoid. Set the ceiling to the number of objects a player actually drives, or to `UnlimitedControlledInterestObjects`, and the question doesn't come up.

## Unmeasurable pairs restrict nothing

When a distance can't be measured — the connection controls nothing yet, or a controlled object's position can't be read — the condition answers unmeasurable and restricts nothing, rather than culling. This is what a host with no position reader registered for a system looks like: `TryReadSourcePosition` returns `false`, the pair is skipped, and interest for it is left alone. Culling on an unknown distance would empty the world for a player whose character hasn't finished spawning.

## Pro feature

Every file behind this page — `DistanceInterestConditionBase.Pro.cs`, `InterestPositionConditionBase.Pro.cs`, and `DistanceInterestLadder.Pro.cs` — is a `.Pro.cs` file. A free build has the interest system but not distance conditions.
