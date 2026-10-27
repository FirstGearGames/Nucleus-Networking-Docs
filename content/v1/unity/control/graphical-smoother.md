---
title: "Smoothing a predicted object with GraphicalSmoother"
---

A predicted object moves once per tick, and a correction can move it again. The screen draws many frames per tick, so an object placed only on ticks looks like it stutters, and a correction looks like a snap. `GraphicalSmoother` (namespace `Nucleus.Integrations.Unity.Components`) fixes the drawing without touching the simulation.

## The smoother glides a child graphic while the object stays exact.

Put the collider, the body and your scripts on the object, and put the renderer on a child. Add a `GraphicalSmoother` to the object and assign the child as its **Child Graphic**.

Each tick, the smoother remembers where the child was drawn before anything moves the object, lets the whole tick run, and then slides the child from that place to where the tick left the object. The object itself, its colliders and its hitboxes stay at the true pose for the whole tick, so physics, raycasts and lag compensation see exactly what the simulation did. A correction lands in the same slide, so a taken-back jump drops smoothly instead of snapping.

It works for an object you place yourself on each tick, a `ValidatedRigidbody` or `ValidatedCharacterController`, and any other object that moves once per tick. The `ValidatedJump` and `BallRacer` demos both draw through one.

## Smoothing Duration Mode sets how long each slide lasts.

- **Fixed**, the default, slides for **Duration** seconds, rounded up to whole ticks. Zero, the default, is one tick.
- **Adaptive** slides for between **Minimum** (0 by default) and **Maximum** (0.1 seconds by default), longer as the round trip to the server grows toward **Maximum Latency (ms)** (200 by default, at most 500).

No slide lasts longer than half a second. A longer slide eases corrections out over more ticks, but the drawn object trails steady movement by those extra ticks too. These settings apply only with a child graphic.

## Smoothed Properties chooses what is smoothed.

**Smoothed Properties** picks position, rotation and scale. Position and rotation are smoothed by default.

## The smoother can smooth the object itself instead.

Turn off **Child Graphic Enabled** and the object's own transform is smoothed. That is safe for a `CharacterController` or a `Rigidbody`, because physics only steps inside a tick. Anything that reads the transform between ticks, a camera included, then reads the drawn pose, up to a tick behind the true one.

## A camera should follow the graphic in LateUpdate.

Smoothing adds up to one tick of delay to what is drawn. The slide is drawn in the loop's `LateUpdate`, ahead of your own `LateUpdate` scripts, so a camera following the graphic should follow it there. In `Update`, on a frame that runs a tick, it would read the true pose, up to a tick ahead of what is drawn.

## You can drive the smoother yourself.

Turn off **Network Loop Callbacks Enabled** only when you want to call `CapturePose`, `RestorePose` and `Smooth` yourself. Leave it on otherwise.

## Member smoothing is the other way to hide a correction.

When you draw an object from a member's value in `Update` instead of placing it on ticks, construct the member with `correctionSmoothingTicks` and draw its `InterpolatedValue`. `Value` is corrected at once, while `InterpolatedValue` eases from what was on screen. See [Replaying a correction in Unity](./reconcile-in-unity.md).
