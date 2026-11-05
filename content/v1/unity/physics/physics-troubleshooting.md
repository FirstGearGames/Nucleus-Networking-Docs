---
title: "Physics troubleshooting"
---

## Nothing steps at all

A `UnityPhysicsManager` is always present, so a missing manager is never the cause.

- **Enabling a driver throws "No CoreManager is bound, so there is no physics to register with."** A `PhysicsSimulationDriver` needs a bound `CoreManager` when it is enabled. Add a `UnityCoreManager` to the scene.
- **A scene has its own local physics world and no driver.** Nothing steps that world at all. Add a `PhysicsSimulationDriver` to the scene.
- **The execution mode is `PhysicsExecutionMode.UnityRun`.** The default physics world is then stepped by Unity's own `FixedUpdate`, not the network tick. This is expected; see [Physics execution modes](./physics-execution-modes.md).

## A body jitters or trails

- **Visual Smoothing is set but no Smoothed Visual is assigned.** Visual Smoothing has nothing to act on. Assign a child of the body that holds its renderer, such as a child named `Visual`, and let no other script or animation write that child's transform.
- **Blend Mode is Position on a body in contact.** On a body resting in a stack or on the ground, `ConvergenceBlendMode.Position` fights the contacts and shows as jitter. Set **Blend Mode** to `ConvergenceBlendMode.Velocity`, which corrects through the body's own motion.
- **Residual Close Maximum Speed is too low.** A moving body stays above it, so its small error is never closed and shows as a small, persistent trail. Raise it above the body's ordinary travel speed.

The small-error close (**Residual Close Rate**) pauses above **Residual Close Maximum Speed** on purpose, so it never fights a body that was just bumped. It resumes once the body slows down.

## A body snaps

The body's whole pose snaps onto the target when its error passes **Teleport Distance**. That is expected on a respawn, on a proxy that lost and then recovered its received state, and on any other large miss. If bodies snap on ordinary corrections, raise **Teleport Distance**, or set it to `0` to turn teleporting off.

## A body steps the wrong world after a scene move

A scene move, such as `MoveGameObjectToScene`, does not tell `NetworkRigidbody` that the body moved, so it keeps simulating in the scene it left. Call `NetworkRigidbody.NotifySceneChanged()` right after the move.

A pooled or spawned instance often lands in the active scene rather than the scene it belongs to. It still finds the driver that steps its physics world, because a body looks up the driver for its own scene first and then for its physics world. If a body is stepped by the wrong driver, check which scene it was actually instantiated or moved into, and call `NotifySceneChanged()` if it moved after `OnEnable`.

## A second driver on a scene does nothing

A second driver on a scene that already has one logs *"Scene [...] is already stepped by the driver on [...]; the one on [...] does nothing. A scene is stepped by exactly one driver."* The first driver keeps stepping the scene. Remove the second one.

## NetworkTransform and NetworkRigidbody fight

Both move the same transform from replicated state. Use one or the other for an object's pose; see [NetworkTransform or NetworkRigidbody](./transform-or-rigidbody.md).

## Read bandwidth and round-trip time

To judge whether a correction is worth its cost, see [Reading network statistics in Unity](../diagnostics/network-statistics-in-unity.md) for bandwidth and [Round-trip time, jitter and packet loss](../../core-api/diagnostics/link-quality-measurement.md) for the link figures.
