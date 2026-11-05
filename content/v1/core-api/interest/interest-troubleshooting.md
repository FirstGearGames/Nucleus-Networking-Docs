---
title: "An object is missing, or will not go away"
---

## A client receives objects from a scene it never loaded

An ungated spawn raises no error. It lands in the wrong scene on the client. The Unity inspector for `UnityInterestManager` warns about this when its rule list has no scene rule: "No rule gates scenes. A client will receive objects from scenes it never loaded, which puts them in the wrong scene rather than raising an error, and several open instances of one scene cannot be told apart by distance."

**Fix:** add the scene rule to the world's interest conditions, unless your own rule arbitrates scene membership.

## Nothing is ever culled, however large the stop distance is

A distance condition reads positions through its own `TryReadSourcePosition` (the Unity conditions read the linked GameObject's transform), not through the reader set with `InterestManager.SetPositionReader`. A pair it cannot measure is never restricted. That happens when the connection controls nothing yet, or when `TryReadSourcePosition` returns `false` for the object or for every object the connection controls.

**Fix:** make sure each player controls the object it plays through, and that `TryReadSourcePosition` answers for both the evaluated object and the controlled ones. The world reader is used only by level of detail. Without one, level of detail logs an error once and every pair reads as Near, but culling is unaffected.

## An object disappears at range when it should only freeze, or the reverse

Past the despawn cutoff, `DistanceInterestLadder.Resolve` returns an unmet spawn. Past only the stop cutoff, it returns an unmet stop. Despawn always outranks stop. Whether an unmet stop removes the object depends on `NetworkSystem.DespawnWhenStoppedEnabled`: off, the object freezes and keeps its last state; on, it is treated as culled once stopped.

On a grouped object (several systems sharing one `NetworkSystemGroup`), the object leaves only once every member's stop is unmet and has `DespawnWhenStoppedEnabled` set. One member with the flag off keeps the whole object in place. An ungrouped system with the flag on despawns as soon as its stop is unmet.

**Fix:** check `DespawnWhenStoppedEnabled` on every system in the group, not just one.

## Objects flicker in and out at a cull boundary

A distance cull has no hysteresis, so a player moving back and forth across a cutoff flips the verdict each evaluation. Distance is re-measured only every `EvaluationCadenceTicks`, so flicker only happens when a player can cross from just inside to just past the cutoff within one cadence. The level-of-detail hysteresis does not help, because level of detail never changes what is sent or whether an object spawns, stops or despawns.

**Fix:** widen the gap between the cutoff and how far a player can move in one `EvaluationCadenceTicks`, by raising the cutoff, lowering the cadence, or both. There is no setting to smooth the boundary itself.

## A new client sees nothing for a second or two

A connection is not registered against any system until `Connection.CanReceiveState` is true, which happens once its link is measured: typically one round trip after it authenticates, and immediately for a host's own client. Until then it sees no objects.

This is expected and resolves itself. If it never resolves, check that the transport completes a round trip for that connection.

## A join or scene load arrives as one huge tick and drops

`ServerManager.MaximumObjectKilobytesPerTick` (50 by default, where 1 kB is 1,024 bytes) caps how many kilobytes of new objects one client is sent per tick. Whatever does not fit is sent on the following ticks. Objects re-sent after packet loss share the same budget. Pacing cannot be switched off, so a join that still arrives as one tick too large for the link means the budget is too wide: lower it. One object wider than the whole budget is still sent, alone on its tick.

To check whether the budget is holding spawns back:

- `InterestManager.TotalSpawnsDeferred` counts spawns that have had to wait. It stays near zero in a world that never fills the budget.
- `Connection.SystemsAwaitingSpawnAdmissionCount` is how many spawns one connection is still owed.
- A warning is logged once a connection has been owed spawns for `InterestManager.SpawnAdmissionStallWarningTicks` (90) ticks without receiving one. It names the connection and the current `MaximumObjectKilobytesPerTick`.

If that warning fires, the world spawns faster than the budget lets that peer receive: raise `MaximumObjectKilobytesPerTick`, or spawn less at once. A `NetworkSystemGroup` wider than the budget is not a fault; its objects arrive over more than one tick.

## Setting the technique or axes logs an error and does nothing

`InterestManager.SetInterestTechnique` is refused, with a logged error, once any distance condition has registered in that world, globally or per system.

**Fix:** call `SetInterestTechnique` during setup, before any system with a distance rule can spawn.

## An authored distance rule stops objects but never despawns them

The inspector-authored Unity rule (`AuthoredDistanceInterestCondition`) only exposes a stop distance. It always leaves the despawn cutoff unset (`DistanceInterestLadder.UnsetDistance`), so an object authored this way only stops by distance, never culls.

**Fix:** to cull by distance, construct a `DistanceInterestCondition` in code. It takes `stopDistance` and `spawnDistance` separately.

## Every distance lever on this page is Pro-only

Distance conditions, the spatial grid, level of detail and object pacing are Pro-only, as are `AuthoredDistanceInterestCondition` and `DistanceInterestCondition` in Unity. The scene rule and the base interest system ship in Free. If one of these settings seems not to apply, check whether the build is Free.
