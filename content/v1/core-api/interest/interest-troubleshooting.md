---
title: "An object is missing, or will not go away"
---

## A client receives objects from a scene it never loaded

No rule gates scenes by default in a way you can see failing: an ungated spawn is not an error anywhere on the server, it simply lands in the wrong scene on the client. The Unity inspector for `UnityInterestManager` warns about exactly this when its rule list has no scene rule registered: "No rule gates scenes. A client will receive objects from scenes it never loaded, which puts them in the wrong scene rather than raising an error, and several open instances of one scene cannot be told apart by distance."

Fix: add the scene rule to the world's interest conditions unless you are arbitrating scene membership with a rule of your own.

## Nothing is ever culled, however large the stop distance is

A distance condition reads positions through its own `TryReadSourcePosition` (the Unity integration's conditions read the linked GameObject's transform), not through the world reader registered with `InterestManager.SetPositionReader`. When it cannot measure a pair it answers unmeasurable, and an unmeasured pair is never allowed to restrict anything, so no cutoff culls or stops it. That happens when the connection controls nothing yet, so there is no point to measure from, or when `TryReadSourcePosition` returns `false` for the object or for every object the connection controls.

Fix: make sure each player controls the object it plays through, and that the condition's `TryReadSourcePosition` answers for both the evaluated object and the controlled ones. The world reader is used only by level of detail: without one, level of detail logs an error once and every pair reads as Near, but culling is unaffected.

## An object disappears at range when it should only freeze, or the reverse

`DistanceInterestLadder.Resolve` returns an unmet spawn past the despawn cutoff and only an unmet stop past the stop cutoff — despawn always outranks stop from the same measured distance. Whether an unmet stop actually removes the object is `NetworkSystem.DespawnWhenStoppedEnabled`: off, the object freezes in place and keeps its last state; on, it is treated as culled once stopped.

On a grouped object (several systems sharing one `NetworkSystemGroup`), a stop is a vote, not a unilateral despawn: a member votes only when its stop is unmet *and* its `DespawnWhenStoppedEnabled` is set, and the object leaves only once every member votes to. A member that freezes instead of voting holds the object in place by abstaining, so one system in the group with `DespawnWhenStoppedEnabled` off is enough to keep a "should have despawned" object sitting there. An ungrouped system has no sibling to defer to, so its own unmet stop with the flag on despawns it directly.

Fix: check `DespawnWhenStoppedEnabled` on every system in the group, not just the one you're staring at.

## Objects flicker in and out at a cull boundary

There is no hysteresis on a distance cull. `Resolve` is two bare distance-versus-cutoff comparisons with nothing damping the boundary, so a player oscillating around a cutoff between evaluations flips the verdict every pass. The only thing standing between a player's movement and a flicker is `EvaluationCadenceTicks`: distance is only re-measured once per that many ticks, so as long as a player cannot close the gap between "just inside" and "just past" the cutoff within one cadence, the flicker never has a chance to fire.

Hysteresis does exist in this codebase, but only on the level-of-detail ladder (a fraction-of-a-rung band a distance has to re-cross before it switches back). It cannot fix this: a level-of-detail band is only a reading for the game. It never changes what is sent or how often, nor whether an object spawns, stops, or despawns, so it has no bearing on a cull boundary.

Fix: widen the gap between the stop/despawn cutoff and how far a player can move in one `EvaluationCadenceTicks`, either by raising the cutoff, lowering the cadence, or both. There is no setting to smooth the boundary itself.

## A new client sees nothing for a second or two

Registration as an observer waits for more than authentication. A connection authenticates before its round trip time is known, and it is held back from every started system until `Connection.CanReceiveState` is true — which happens once its link is measured, typically one round trip later, or immediately for a host's own client. A client stuck in this window is authenticated but registered against nothing, so it appears to see no objects at all for a moment.

This is expected and self-resolving; there is nothing to configure. If the gap never closes, check that the transport is actually completing a round trip for that connection.

## A join or scene load arrives as one huge tick and drops

Spawn pacing exists to prevent exactly this: `InterestManager.MaximumSpawnsPerTick` caps how many objects may start replicating to one client on a single tick, deferring the rest to later ticks. Left at zero it admits everything at once — a full join or scene load lands as a single, maximally expensive tick, the worst one to lose a packet on.

To check whether the ceiling is actually the bottleneck, read:
- `InterestManager.TotalSpawnsDeferred` — total deferrals so far; a world that never reaches the ceiling stays near zero.
- `Connection.SystemsAwaitingSpawnAdmissionCount` — how many spawns a specific connection is still owed.
- A `LogWarning` fires once a connection has been owed spawns for `InterestManager.SpawnAdmissionStallWarningTicks` (90) ticks without one being admitted, naming the connection and the current `MaximumSpawnsPerTick`.

Fix: raise `MaximumSpawnsPerTick`, or spawn less at once. A `NetworkSystemGroup` is always admitted whole rather than starved, so also check for a single group larger than the ceiling — that alone will trigger the stall warning.

## Setting the technique or axes logs an error and does nothing

`InterestManager.SetInterestTechnique` is refused, with a logged error, once any distance condition has already registered in that world — tracked internally the moment a position condition is added, globally or per-system. One technique and one plane govern a world for its whole lifetime because the shared spatial index applies its axis mask when a point is filed and again when it is queried; changing either mid-session would have one pass measuring in two of them.

Fix: call `SetInterestTechnique` during setup, before any system carrying a distance rule can spawn — never after.

## A distance rule with no spawn range, only a stop range

This is specific to the authored Unity rule (`AuthoredDistanceInterestCondition`), not the underlying condition type. The inspector-authored rule only exposes a stop distance; it always builds its condition with the despawn cutoff unset (`DistanceInterestLadder.UnsetDistance`), so an object authored this way never culls by distance at all, only stops.

The underlying type has no such limitation. `DistanceInterestCondition` (Unity's own binding of the engine-neutral `DistanceInterestConditionBase`, not the inspector-authored rule) takes a `stopDistance` and a `spawnDistance` independently in its constructor, and so does the `DistanceInterestLadder` beneath it. Construct one yourself in code (or register a global condition) to get culling by distance instead of authoring through the inspector.

## Edition check

Distance interest conditions, the spatial grid, level of detail, and spawn pacing are all Pro-only — their implementations live in files suffixed `.Pro.cs`: `InterestManager.Conditions.Pro.cs`, `DistanceInterestLadder.Pro.cs`, `DistanceInterestConditionBase.Pro.cs`, `SpatialInterestGrid.Pro.cs`, `InterestManager.LevelOfDetail.Pro.cs`, `InterestManager.SpawnPacing.Pro.cs`, and the Unity-side `AuthoredDistanceInterestCondition.Pro.cs` / `DistanceInterestCondition.Pro.cs`. On a free build these files are absent, so none of the above levers exist: no distance rule, no spatial grid, no level of detail, no spawn ceiling. The scene rule and the base interest system are not gated this way and ship in free.

If a build behaves as though one of these settings simply doesn't apply, confirm it's a free build before debugging further.
