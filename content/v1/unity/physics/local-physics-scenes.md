---
title: "Local physics scenes"
---

## What it does

Give each loaded scene its own local physics world so a body only collides with other bodies loaded into that same scene. Two switches control it, both on the Unity scene-loading components.

`UnitySceneLoader.LocalPhysicsEnabled` (backing field `_localPhysicsEnabled`) loads each networked scene with `LocalPhysicsMode.Physics3D` instead of the default shared world, and attaches a `PhysicsSimulationDriver` to it.

`UnitySceneManager`'s "Auto Simulate Stacked Scenes" inspector field (`_automaticStackedSceneSimulationEnabled`) pushes that same setting onto the `UnitySceneLoader` the manager creates, so every stacked instance gets a local physics world without touching the loader directly.

## Why the driver is needed

Unity never auto-simulates a local physics scene. A scene loaded with `LocalPhysicsMode.Physics3D` sits inert until something steps it. `NetworkSceneBinder.AttachPhysicsSimulationDriver` adds a `PhysicsSimulationDriver` to the scene the moment it loads, and that driver is what the network loop steps on tick. Without local physics enabled, bodies step on Unity's own `FixedUpdate` against the one shared world instead.

## What changes for a body

A body only collides within its own scene's physics world. Moving a `ProjectedRigidbody` to another scene changes what it can hit: it stops seeing the bodies it left behind and starts seeing whatever local world it landed in.

## Moving a body across scenes

`ProjectedRigidbody.NotifySceneChanged` re-resolves which driver a body steps under. A scene move made with `MoveGameObjectToScene` fires no `OnEnable` or `OnDisable` on the component, and the driver is cached at `OnEnable`, so without this call the body keeps stepping the world it left. `NotifySceneChanged` leaves the old driver and asks the new scene for its driver; a local-physics destination already has its driver attached from load, so the ask resolves immediately and the body steps the right world from the next tick.

You don't need to call this yourself for a spawn move: the spawn handler calls it on every `ProjectedRigidbody` under a moved system right after the move.

## Honest limits

This is step routing onto Unity's own per-scene physics world, not a fully separated per-scene physics feature. The engine's feature list tracks "Per-scene local physics" (#302) as step routing shipped, world separation not shipped.

Bodies in a local physics scene still need manual interpolation; local physics does not give you that for free.

## See also

- [UnitySceneLoader component](/unity/scenes/unity-scene-loader) and [UnitySceneManager component](/unity/scenes/unity-scene-manager) for the loader and manager settings themselves
- [Opening and closing scene instances](/core-api/scenes/opening-scene-instances) for opening the stacked instances this applies to
- [Moving and carrying objects between scenes](/how-to/moving-and-carrying-objects-between-scenes) for moving systems between scenes
