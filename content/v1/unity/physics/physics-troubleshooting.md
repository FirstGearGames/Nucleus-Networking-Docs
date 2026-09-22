---
title: "Physics troubleshooting"
---

## Nothing steps at all

A `UnityPhysicsManager` is always present, so a missing manager is never the cause. Check these instead.

**The driver logs "found no bound CoreManager to attach its network loop to".** `PhysicsSimulationDriver` registers with the shared `PhysicsSimulationCoordinator` on `OnEnable`, and the coordinator needs a bound `CoreManager` to attach its network-loop callbacks. If none is bound yet, the coordinator logs this error and the scene keeps Unity's own physics cadence (`FixedUpdate`) instead of stepping on the tick. The scene needs a `UnityCoreManager`, which binds a `CoreManager` from its own `Awake`, ahead of every ordinary component. Registration is retried the next time a driver registers, so once a `UnityCoreManager` exists, a later driver attaches and steps everything, including scenes whose own driver registered too early.

**A scene was loaded with a local physics scene and no driver.** A `ProjectedRigidbody` under `PhysicsSimulationDriver.ForScene` finds a driver by the scene it lives in first, then by the physics world that scene belongs to. A scene with its own local physics world and no `PhysicsSimulationDriver` component has nothing stepping that world at all, tick or otherwise; add a driver to the scene.

**`PhysicsExecutionMode.UnityRun` is deliberately skipping the default world.** `PhysicsSimulationCoordinator.ExecutionMode` set to `UnityRun` leaves the process default physics world on Unity's own `FixedUpdate` and steps only the local-physics worlds that stacked-scene drivers report. A body sitting in the default world under `UnityRun` looks exactly like the "nothing steps" fault but is fine: it is still Unity's own cadence stepping it, not the network tick.

## A body jitters or trails

**Visual Smoothing versus a Smoothed Visual that is not detached.** `ProjectedRigidbody`'s Visual Smoothing (`_visualSmoothing`) low-passes the render pose of `SmoothedVisual` toward the interpolated physics pose, hiding tick-to-tick correction jitter. It requires `SmoothedVisual` to be a transform detached from the rigidbody's own hierarchy driving; if `SmoothedVisual` is left parented so it inherits the body's pose directly, `LateUpdate` writes a world pose onto a transform that is also being moved by its parent, and the two fight. Assign a `SmoothedVisual` that is not a child whose position Unity's transform hierarchy would otherwise drive.

**Blend Mode Position on a body in contact.** `ConvergenceBlendMode.Position` (the `_blendMode` field) writes the pose directly toward the target every over-threshold step. On a body resting in a stack or against the ground, that direct pose write fights the solver's own contact resolution, producing visible jitter. Switch to `ConvergenceBlendMode.Velocity` (see below).

**Residual Close Maximum Speed set too low.** `_residualCloseMaximumSpeed` gates the sub-threshold residual close: above that speed the body falls back to the plain deadband and holds its offset instead of bleeding it off. Set too low, a body that is still genuinely moving reads above the gate on every step, the residual close never runs, and the un-closed offset shows up as a small, persistent trail behind the target. Raise it so a body's ordinary travel speed stays under it.

## A body fights the ground or a stack

Set `_blendMode` to `ConvergenceBlendMode.Velocity`. Instead of writing the pose directly, Velocity mode applies the same closing fraction as a solver-integrated velocity bias, so the correction is folded into physics rather than overriding it, and never disrupts a contact or a stack.

The sub-threshold residual close (`_residualCloseRate`) gates itself on speed for the same reason: it only runs below `_residualCloseMaximumSpeed`, so a body that was just bumped or is still settling holds its offset on the plain deadband instead of the residual close fighting the fresh contact. Above that speed the gentle bleed-off is simply not applied until the body slows back down.

## A body snaps

`_teleportDistance` is the positional divergence, in meters, past which the body's whole pose snaps onto the target instead of blending; the smoothed visual jumps too. Zero disables it, so the body always blends however far off it is.

A snap is not always a bug. It legitimately fires on:

- A respawn, where the body's old and new positions have nothing to do with each other.
- A proxy that lost and then recovered its received state, where the buffered pose is stale by more than the threshold.
- Any other large miss between the projected pose and the authoritative one.

If bodies are snapping on ordinary corrections rather than these cases, raise `_teleportDistance` (or set it to zero to disable teleporting outright) so more of the divergence range blends instead.

## A body still steps the world it left after a scene move

A scene move (for example a spawn handler calling `MoveGameObjectToScene`) fires no `OnDisable`/`OnEnable`, but `ProjectedRigidbody` caches its `PhysicsSimulationDriver` at enable. Without further action the body keeps registered with, and stepped by, the driver of the scene it left, not the scene it now lives in.

Call `ProjectedRigidbody.NotifySceneChanged()` right after the move. It deregisters from the old driver and asks the scene the object now lives in for that scene's driver; a local-physics destination already has its driver attached by the time anything can move into it, so the ask resolves immediately and the body steps the right world from the next tick.

## Two drivers on one scene

`PhysicsSimulationCoordinator.Register` refuses a second driver for a scene that already has one and logs: *"Scene [...] is already stepped by the driver on [...]; the one on [...] does nothing. A scene is stepped by exactly one driver."* The second `PhysicsSimulationDriver` component does nothing; remove it, there is exactly one driver per scene.

**A body finds the driver of the scene its prefab came from rather than the one it lives in.** `PhysicsSimulationDriver.ForScene` (and `ProjectedRigidbody`'s own resolution) looks up a driver by the object's own scene handle first, then falls back to whichever driver steps the same physics world. A pooled or wire-spawned instance often lands in the active scene rather than the scene it is conceptually part of; that fallback is what lets it still find the driver that owns its actual physics world instead of one for a scene it never really entered. If a body is being stepped by the wrong driver, check which scene it was actually instantiated or moved into, and call `NotifySceneChanged()` if it moved after `OnEnable`.

## A NetworkTransform and a ProjectedRigidbody on the same object

`ProjectedRigidbody` follows a non-authority body as a proxy: it either adopts the first received state, follows a remote-input proxy on the interpolation buffer as a kinematic body, or runs the convergence follower. When a remote-controlled proxy follows the interpolation buffer, `RefreshRemoteInputProxy` forces the rigidbody kinematic (`Rigidbody.isKinematic = true`) for as long as that role holds, restoring the original flag when it ends.

Putting a `NetworkTransform` on the same object as a `ProjectedRigidbody` means two components are both trying to move the same transform from replicated state: the `ProjectedRigidbody` drives the physics body (kinematically, while it is a remote-input proxy), and the `NetworkTransform` drives the same transform independently. Use one or the other for a given object's pose, not both.

## Reading bandwidth and round-trip time

When grading whether a correction is worth its cost, read the diagnostics pages rather than guessing: [Reading network statistics in Unity](/v1/unity/diagnostics/network-statistics-in-unity) covers bandwidth, and [Round-trip time, jitter and packet loss](/v1/core-api/diagnostics/link-quality-measurement) covers the link figures a locally predicted body's projection depth is measured against.
