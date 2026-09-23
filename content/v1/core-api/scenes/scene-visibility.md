---
title: "Scene visibility: what a client in a scene can see"
---

## The gate

`SceneManager` owns a `SceneInterestCondition` called `SpawnGate`. It has `Capabilities => InterestEffect.Spawn`, and `SceneManager` registers it on startup as one of the engine's default conditions (listed in `InterestManager.DefaultConditions`), so it applies to every `NetworkSystem` without any per-game setup. A game that wants to arbitrate scene membership itself can pull it back out with `InterestManager.RemoveDefaultConditions`.

The rule it enforces: a `NetworkSystem` whose `SceneHandle` names a live scene instance is withheld from a `Connection` that does not hold that scene. `NetworkSystem.UnsetSceneHandle` (a system that belongs to no server-opened scene) is exempt and is always held by everyone, so a world that never opens a scene pays almost nothing for this gate being on.

## Spawning and ongoing replication

`SpawnGate` only carries `InterestEffect.Spawn`, but it is not just a spawn-time check. The gate stops serving a scene to a client the moment `SceneManager.RequestSceneUnload` asks it to leave, not when the unload finishes, even though `Connection.IsSceneLoaded` keeps answering true until the client confirms. `RequestSceneUnload` drops the connection as an observer of that scene's systems immediately, before any unload confirmation comes back. `SceneInterestCondition.Evaluate` mirrors this: while that unload request is outstanding, the condition returns `InterestResult.Spawn(isMet: false)` instead of abstaining, withholding the object rather than re-serving it into a scene the client is on its way out of.

So "the gate only restricts spawning" is only true for a client that fully holds the scene start to finish. A client mid-leave is cut off before the unload is confirmed.

## Local and emulated peers

The condition abstains for a local peer, returning `InterestResult.None` immediately. A local peer is not a host's own player connection. It is an emulated `Connection`, or any peer sharing an in-memory Transport (test setups, most commonly), and it is deliberately distinct from `Connection.IsHostLoopback`, which is what actually names a host's own client half. A host's own client is evaluated by this gate like any other connection; it is placed by the same scene protocol and holds a real membership record.

What differs for a host's client is how that record is used: the result is surfaced through `NetworkSystem.HostInterestMembership` rather than acted on, which is what lets a host hide an object its client half would not have been sent without actually withholding anything from itself as the server.

## Carried systems

A client that is being moved into a scene does not have to wait for the scene load to land before its own controlled object shows up. When the system is a spawned object rather than a scene object, the connection controls it, and the connection has been asked into the system's scene with that load still outstanding, the condition abstains (`InterestResult.None`) rather than withholding. This is checked after the held-scene branch and after the leaving-scene branch, so a client that already holds the scene never needs it, and a client that has been asked to leave never gets it either. Only a client on its way in, for a system it drives, gets served across the gap.

## Automatic scene requests

By default a blocked spawn does nothing beyond withholding the object. Setting `SceneManager.AutomaticRequestOnBlockedSpawnEnabled` to `true` turns that block into an action: when `Evaluate` is about to withhold a spawn, it also calls `SceneManager.RequestSceneLoad` for that connection and scene, naming the system so the load's confirmation can arrive as a spawn on the same tick rather than waiting for the next stagger slot. The request dedupes per connection and scene, and stops firing once that client has reported it cannot load the scene.

## Why stacked scenes cannot see each other

Two open instances of the same scene occupy the same world coordinates — nothing about position tells them apart. Only membership does. `SceneHandle` on a `NetworkSystem`, checked against what `Connection.IsSceneLoaded` reports for that client, is the only thing separating a player in instance A from an identical-looking object sitting in the same spot in instance B. Without this gate a distance-based condition would happily match a player in one instance against every object in every other instance at the same coordinates.

## Troubleshooting

**A client should be seeing an object and isn't.**

- Check `NetworkSystem.SceneHandle` on the object. If it is not `NetworkSystem.UnsetSceneHandle`, the client must hold that exact scene instance.
- Check `Connection.IsSceneLoaded(sceneHandle)` for that client. If it is false, the object is being withheld correctly — the fix is getting the client into the scene (`SceneManager.RequestSceneLoad`), not the interest system.
- If the client was recently told to leave the scene (`RequestSceneUnload`), everything in it is withheld immediately, before the unload confirms. This is expected, not a bug.
- If the object is the client's own controlled object arriving right as it enters the scene, confirm the carry conditions hold: the system must be a spawned object rather than a scene object, the scene load must be outstanding for that connection, and the connection must control the system's group.
- On a genuinely local setup, an emulated connection or a peer sharing an in-memory Transport, `SpawnGate` abstains; this does not apply to a real host's own client, which is gated normally and reported through `NetworkSystem.HostInterestMembership` instead.
- If none of the above applies and the object still never arrives, check whether `InterestManager.RemoveDefaultConditions` was called somewhere, removing `SpawnGate` entirely.
