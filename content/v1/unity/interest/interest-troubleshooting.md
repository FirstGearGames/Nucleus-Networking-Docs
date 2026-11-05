---
title: "An object is missing, or will not go away"
---

> **Driving the core API directly?** See [An object is missing, or will not go away](../../core-api/interest/interest-troubleshooting.md).

To see what interest resolved, add a `NetworkInterestOverlay` to the player object, switch it on, and select the object on the server or host while playing. A line goes to every other networked object, colored by whether the player is streamed it, stopped for it, or does not have it at all. See [Developer tools in the editor](../diagnostics/developer-tools-in-unity.md#seeing-what-an-objects-controller-is-sent).

Distance rules, the spatial grid, level of detail and object pacing are Pro. The Scene rule and the base interest system ship in free. If a setting below seems not to apply, check whether the build is free.

## A client receives objects from a scene it never loaded

No rule gates scenes, so the objects land in the wrong scene with no error anywhere. The Unity Interest Manager inspector warns "No rule gates scenes" in this case.

Fix: add the Scene rule to **World Rules** on the Unity Interest Manager, unless a rule of your own decides scene membership.

## Nothing is ever culled, however large the stop distance is

A distance rule that cannot measure a pair never restricts it. Unity's distance rules read the linked GameObject's transform through `TryReadSourcePosition`. A pair cannot be measured when the client controls nothing yet, or when `TryReadSourcePosition` returns `false` for the object or for every object the client controls.

Fix: make sure each player controls the object it plays through. In a condition of your own, make sure `TryReadSourcePosition` answers for both the evaluated object and the controlled ones.

## An object disappears at range when it should only freeze, or the reverse

Past the despawn distance the object is despawned. Past only the stop distance it stops, and despawn wins when both apply. Whether a stop removes the object is `NetworkSystem.DespawnWhenStoppedEnabled`: off, the object freezes with its last state; on, it is removed once stopped.

On an object with several systems sharing one `NetworkSystemGroup`, the object leaves only once every member has stopped with `DespawnWhenStoppedEnabled` set. One member with it off keeps the object in place. A system with no group despawns on its own stop.

Fix: check `DespawnWhenStoppedEnabled` on every system in the group, not just one.

## A distance rule only stops, and never despawns

The inspector's Distance rule (`AuthoredDistanceInterestCondition`) has only a **Stop Distance** and no despawn distance, so it never despawns by distance.

Fix: to despawn by distance, construct a `DistanceInterestCondition` in code, which takes a `stopDistance` and a `spawnDistance` separately, and register it globally or per system.

## Objects flicker in and out at a cull boundary

A distance cutoff has no hysteresis, so a player moving back and forth across it flips the verdict each evaluation. Only **Evaluation Cadence Ticks** limits this, because distance is measured once per that many ticks. The level of detail **Hysteresis** setting does not help, since a band never changes what is sent.

Fix: widen the gap between the cutoff and how far a player can move in one evaluation cadence, by raising the cutoff, lowering the cadence, or both. No setting smooths the boundary itself.

## A new client sees nothing for a second or two

A client is not sent any object until its link is measured (`Connection.CanReceiveState`), typically one round trip after it authenticates, or at once for a host's own client. This is expected and resolves itself. If it never resolves, check that the transport completes a round trip for that connection.

## A join or scene load arrives as one huge tick and drops

Object pacing limits how much of a join lands in one tick. Set it with the **Maximum Object Kilobytes Per Tick** slider under **Object Pacing** on the Unity Server Manager (`ServerManager.MaximumObjectKilobytesPerTick`). It is the most kilobytes (1 kB is 1,024 bytes) of new objects one client is sent per tick, 50 by default. What does not fit is sent on later ticks, and objects resent after packet loss share the same budget. Pacing cannot be switched off, so a join that still lands as one tick too large to arrive means the budget is wider than that client's link can take: lower it. One object wider than the whole budget is still sent, alone on its tick.

To check whether the budget is holding spawns back:

- `InterestManager.TotalSpawnsDeferred` counts spawns that have had to wait. A world that never fills the budget keeps it near zero.
- `Connection.SystemsAwaitingSpawnAdmissionCount` is how many spawns one connection is still owed.
- A warning is logged once a connection has been owed spawns for `InterestManager.SpawnAdmissionStallWarningTicks` (90) ticks without receiving one, naming the connection and the current budget.

If that warning fires, the world spawns faster than the budget lets that client receive: raise the budget, or spawn less at once. A `NetworkSystemGroup` wider than the budget is not a fault on its own; it arrives over more than one tick.

## Setting the technique or axes logs an error and does nothing

The technique and axes are refused, with a logged error, once any distance rule has registered in the world, globally or per system.

Fix: set **Interest Technique** and **Interest Axes** on the Unity Interest Manager before play. From code, call `InterestManager.SetInterestTechnique` during setup, before any system carrying a distance rule can spawn.
