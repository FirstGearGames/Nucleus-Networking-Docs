---
title: "Local physics scenes"
---

## Give each scene its own physics world

With a local physics world per scene, a body only collides with bodies loaded into the same scene. Turn it on with either field:

- **Local Physics** on `UnitySceneLoader` (`UnitySceneLoader.LocalPhysicsEnabled`) loads each networked scene with `LocalPhysicsMode.Physics3D` instead of the shared world.
- **Auto Simulate Stacked Scenes** on `UnitySceneManager` sets the same field on the `UnitySceneLoader` the manager creates, so every stacked instance gets a local physics world.

Unity never steps a local physics scene on its own, so Nucleus adds a `PhysicsSimulationDriver` to each one as it loads and steps it on the tick. Bodies in a local physics scene still need manual interpolation.

## Call NotifySceneChanged after moving a body

A `NetworkRigidbody` collides only within its own scene's physics world, so moving it to another scene changes what it can hit. `MoveGameObjectToScene` does not tell the body it moved:

1. Move the GameObject with `MoveGameObjectToScene`.
2. Call `NetworkRigidbody.NotifySceneChanged()` right after.

The body then simulates in its new scene from the next tick. Without the call, it keeps simulating in the scene it left. A spawn move calls it for you on every `NetworkRigidbody` under the moved system.

## See also

- [UnitySceneLoader component](../scenes/unity-scene-loader.md) and [UnitySceneManager component](../scenes/unity-scene-manager.md)
- [Opening and closing scene instances](../../core-api/scenes/opening-scene-instances.md)
- [Moving and carrying objects between scenes](../../core-api/scenes/moving-objects-between-scenes.md)
