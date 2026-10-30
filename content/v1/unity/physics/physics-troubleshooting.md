---
title: "Physics troubleshooting"
---

## Nothing steps at all

A `UnityPhysicsManager` is always present, so a missing manager is never the cause. Check these instead.

**The driver logs "found no bound CoreManager to attach its network loop to".** A `PhysicsSimulationDriver` needs a bound `CoreManager` when it is enabled. If none is bound yet, it logs this error and the scene keeps Unity's own physics cadence (`FixedUpdate`) instead of stepping on the tick. The scene needs a `UnityCoreManager`, which binds a `CoreManager` from its own `Awake`, ahead of every ordinary component. Registration is retried the next time a driver registers, so once a `UnityCoreManager` exists, a later driver attaches and steps everything, including scenes whose own driver registered too early.

**A scene was loaded with a local physics scene and no driver.** A `NetworkRigidbody` under `PhysicsSimulationDriver.ForScene` finds a driver by the scene it lives in first, then by the physics world that scene belongs to. A scene with its own local physics world and no `PhysicsSimulationDriver` component has nothing stepping that world at all, tick or otherwise; add a driver to the scene.

**`PhysicsExecutionMode.UnityRun` is deliberately skipping the default world.** An execution mode of `UnityRun` leaves the process default physics world on Unity's own `FixedUpdate` and steps only the local-physics worlds that stacked-scene drivers report. A body sitting in the default world under `UnityRun` looks exactly like the "nothing steps" fault but is fine: it is still Unity's own cadence stepping it, not the network tick.

## A body jitters or trails

**Visual Smoothing with no Smoothed Visual.** `NetworkRigidbody`'s Visual Smoothing smooths the visible motion of `SmoothedVisual` to hide the small jumps corrections cause. Without a `SmoothedVisual` assigned it has nothing to act on. Assign a child of the body that holds its renderer, as the demo prefabs do with a child named `Visual`: `NetworkRigidbody` writes a world pose onto it every frame, so the parent's own motion does not fight it. Leave that child's transform to `NetworkRigidbody`; another script or animation writing the same transform would.

**Blend Mode Position on a body in contact.** `ConvergenceBlendMode.Position` (the **Blend Mode** field) moves the body straight toward where it should be when it corrects. On a body resting in a stack or against the ground, that fights the body's contacts and shows as visible jitter. Switch to `ConvergenceBlendMode.Velocity` (see below).

**Residual Close Maximum Speed set too low.** **Residual Close Maximum Speed** is the body speed above which a small positional error is left alone instead of being closed. Set too low, a body that is still moving is always above it, its small error is never closed, and it shows as a small, persistent trail behind where the body should be. Raise it so a body's ordinary travel speed stays under it.

## A body fights the ground or a stack

Set **Blend Mode** to `ConvergenceBlendMode.Velocity`. Velocity mode corrects through the body's own motion instead of moving it directly, so a correction never disrupts a contact or a stack.

The gradual close of small errors (**Residual Close Rate**) only runs below **Residual Close Maximum Speed** for the same reason: a body that was just bumped or is still settling keeps its small error instead of the close fighting the fresh contact. The close resumes once the body slows back down.

## A body snaps

**Teleport Distance** is the positional divergence, in meters, past which the body's whole pose snaps onto the target instead of blending; the smoothed visual jumps too. Zero disables it, so the body always blends however far off it is.

A snap is not always a bug. It legitimately fires on:

- A respawn, where the body's old and new positions have nothing to do with each other.
- A proxy that lost and then recovered its received state, where the buffered pose is stale by more than the threshold.
- Any other large miss between the projected pose and the server's actual pose.

If bodies are snapping on ordinary corrections rather than these cases, raise **Teleport Distance** (or set it to zero to disable teleporting outright) so more of the divergence range blends instead.

## A body still steps the world it left after a scene move

A scene move (for example a spawn handler calling `MoveGameObjectToScene`) does not tell `NetworkRigidbody` that the body moved, so the body keeps simulating in the scene it left, not the scene it now lives in.

Call `NetworkRigidbody.NotifySceneChanged()` right after the move. The body then simulates in its new scene from the next tick.

## Two drivers on one scene

A second driver for a scene that already has one is refused, and it logs: *"Scene [...] is already stepped by the driver on [...]; the one on [...] does nothing. A scene is stepped by exactly one driver."* The second `PhysicsSimulationDriver` component does nothing; remove it, there is exactly one driver per scene.

**A body finds the driver of the scene its prefab came from rather than the one it lives in.** `PhysicsSimulationDriver.ForScene` (and `NetworkRigidbody`'s own resolution) looks up a driver by the object's own scene handle first, then falls back to whichever driver steps the same physics world. A pooled or wire-spawned instance often lands in the active scene rather than the scene it is conceptually part of; that fallback is what lets it still find the driver that owns its actual physics world instead of one for a scene it never really entered. If a body is being stepped by the wrong driver, check which scene it was actually instantiated or moved into, and call `NotifySceneChanged()` if it moved after `OnEnable`.

## A NetworkTransform and a NetworkRigidbody on the same object

`NetworkRigidbody` already moves the body from replicated state on every peer other than the server. Putting a `NetworkTransform` on the same object means two components both move the same transform from replicated state, independently of each other, and they fight. Use one or the other for a given object's pose, not both.

## Reading bandwidth and round-trip time

When grading whether a correction is worth its cost, read the diagnostics pages rather than guessing: [Reading network statistics in Unity](../diagnostics/network-statistics-in-unity.md) covers bandwidth, and [Round-trip time, jitter and packet loss](../../core-api/diagnostics/link-quality-measurement.md) covers the link figures a locally predicted body's projection depth is measured against.
