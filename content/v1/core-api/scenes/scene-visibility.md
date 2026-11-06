---
title: "Scene visibility: what a client in a scene can see"
---

## Clients see only the scenes they hold

`SceneManager.SpawnGate`, a `SceneInterestCondition`, is one of the engine's default interest conditions (listed in `InterestManager.DefaultConditions`), so it applies to every `NetworkSystem` with no setup. It withholds a system whose `SceneHandle` names a live scene instance from any client that does not hold that instance. A system with `NetworkSystem.UnsetSceneHandle` is seen by everyone, so a world that never opens a scene pays almost nothing for the gate.

To handle scene membership yourself, remove it with `InterestManager.RemoveDefaultConditions`.

The gate is also what keeps stacked scenes apart. Copies of one scene share the same coordinates, so without it a distance-based condition would match a player in one copy against objects in every other copy.

## A leaving client is cut off at once

As soon as `SceneManager.RequestSceneUnload` asks a client to leave, that scene's objects stop being sent to it, even though `Connection.IsSceneLoaded` stays true until the client confirms.

## A client's own object arrives as it enters

While a client's load of a scene is outstanding, the gate still lets through a spawned (not scene) object in that scene that the client controls, so the client does not wait for the load to see its own object. A client already holding the scene does not need this, and a client asked to leave never gets it.

## A host's client is gated, a local peer is not

A host's own client is gated like any other connection. The result is reported through `NetworkSystem.HostInterestMembership` instead of acted on, so the host can hide an object its client would not have been sent without withholding anything from itself as the server.

The gate does not apply to a local peer: an emulated `Connection`, or a peer sharing an in-memory Transport (usually a test setup). A host's own client is not a local peer; it is the connection with `Connection.IsHostLoopback`.

## Ask clients into scenes automatically

With `SceneManager.AutomaticRequestOnBlockedSpawnEnabled` set to `true` (default `false`), a withheld spawn also calls `SceneManager.TryRequestSceneLoad` for that client and scene, so the object spawns on the same tick the load is confirmed. Requests are deduplicated per client and scene, and stop once the client reports it cannot load the scene.

## Find out why a client is missing an object

1. Check `NetworkSystem.SceneHandle` on the object. If it is not `NetworkSystem.UnsetSceneHandle`, the client must hold that exact instance.
2. Check `Connection.IsSceneLoaded(sceneHandle)` for the client. If it is false, the object is correctly withheld: place the client with `SceneManager.TryRequestSceneLoad`.
3. If the client was recently asked to leave the scene with `RequestSceneUnload`, everything in it is withheld at once. This is expected.
4. If it is the client's own controlled object arriving as the client enters the scene, confirm that the object is a spawned object rather than a scene object, that the scene load is outstanding for that client, and that the client controls the object's group.
5. If none of the above applies, check whether `InterestManager.RemoveDefaultConditions` removed `SpawnGate`.
