---
title: "Smoothing a predicted object with GraphicalSmoother"
---

A predicted object moves once per tick, and a correction can move it again, so drawn as is it stutters and snaps. `GraphicalSmoother` (namespace `Nucleus.Integrations.Unity.Components`) smooths what is drawn without touching the simulation. It works for an object you place yourself each tick, a `ValidatedRigidbody` or `ValidatedCharacterController`, and anything else that moves once per tick. The `ValidatedJump` and `BallRacer` demos both use one.

## Smooth a child graphic

1. Put the collider, the body and your scripts on the object, and the renderer on a child.
2. Add a `GraphicalSmoother` to the object and assign the child as its **Child Graphic**.

Each tick the child slides from where it was drawn to where the tick left the object, including across a correction. The object, its colliders and its hitboxes stay at the true pose, so physics, raycasts and lag compensation see exactly what the simulation did.

## Adjust the slide in the inspector

| Field | Default | Effect |
|---|---|---|
| **Smoothing Duration Mode** | **Fixed** | **Fixed** slides for **Duration** seconds, rounded up to whole ticks; the default of 0 is one tick. **Adaptive** slides for between **Minimum** (default 0) and **Maximum** (default 0.1 seconds), longer as the round trip grows toward **Maximum Latency (ms)** (default 200, at most 500). |
| **Smoothed Properties** | Position, Rotation | Which of position, rotation and scale are smoothed. |
| **Child Graphic Enabled** | On | Off smooths the object's own transform instead of a child. |
| **Network Loop Callbacks Enabled** | On | Turn off only to call `CapturePose`, `RestorePose` and `Smooth` yourself. |

No slide lasts longer than half a second. A longer slide eases corrections out over more ticks, but the drawn object also trails steady movement by those extra ticks. The duration settings apply only with a child graphic.

Smoothing the object's own transform is safe for a `CharacterController` or a `Rigidbody`, because physics only steps inside a tick. Anything that reads the transform between ticks, a camera included, then reads the drawn pose, up to a tick behind the true one.

## Follow the graphic with the camera in LateUpdate

Smoothing adds up to one tick of delay to what is drawn, and the slide is applied before your own `LateUpdate` scripts run. Follow the graphic from `LateUpdate`. From `Update`, on a frame that runs a tick, the camera reads the true pose, up to a tick ahead of what is drawn.

## Smooth a member instead when you draw from Update

When you draw an object from a member's value in `Update` instead of placing it each tick, construct the member with `correctionSmoothingTicks` and draw its `InterpolatedValue`. `Value` is corrected at once, while `InterpolatedValue` eases from what was on screen. See [Replaying a correction in Unity](./reconcile-in-unity.md).
