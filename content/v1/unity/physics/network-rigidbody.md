---
title: "NetworkRigidbody"
---

> **Driving the core API directly?** See [PhysicsConvergence](../../core-api/physics/physics-convergence.md).

`NetworkRigidbody` is a `MonoBehaviour` that drives physics sync for one rigidbody. It requires a `Rigidbody` and a `NetworkSystemObject`, declares its need for the `NetworkSystem` carrying that body's replicated `NetworkPhysicsComponent`, and keeps that body in agreement across every peer, each tick.

## Runtime surface

| Member | Type | Notes |
|---|---|---|
| `Convergence` | `PhysicsConvergence` (readonly) | The convergence follower this component owns. Tune it through `Convergence.Settings`, which the inspector fields below write into. |
| `SmoothedVisual` | `Transform` | Optional render transform, normally a child of the body that holds its renderer, interpolated between physics steps for tick-rate rendering. |
| `RemoteExtrapolationEnabled` | `bool` (default `true`) | On, a remote-controlled proxy extrapolates forward from its last received state: more current, but overshoots on sudden client state changes. Off, it interpolates between received states in remote time: smooth, never overshoots, always a step behind. |
| `Body` | `UnityPhysicsBody` (read-only) | The adapter around the attached `Rigidbody`. |
| `PhysicsComponent` | `NetworkPhysicsComponent` (read-only) | The replicated physics component this body captures into or converges from. |
| `NetworkSystem` | `NetworkSystem` (read-only) | The system this body belongs to; its controller state decides which peer's simulation is treated as ground truth. |

## Divergence thresholds

These gate both the predicted and the proxy correction paths.

- **Position Threshold** (meters): the positional divergence past which the body blends back toward where it should be. Below it, the body keeps its small offset unless the residual fields below close it.
- **Rotation Threshold** (degrees) — the rotational divergence past which the body blends back toward the target.

## Closing fields

How a body over its threshold corrects splits by role:

- **Blend Per Tick** — the fraction of the remaining gap a *proxy* closes per tick while over threshold. A predicted body ignores this.
- **Prediction Correction Rate** (default `0.1`): how aggressively a *predicted* body (one whose `Convergence.IsLocallyPredicted` is set) corrects toward the server: the fraction of the gap taken off per tick, once past Position Threshold. Higher snaps back harder and sooner; lower lets the prediction ride looser. `NetworkRigidbody` runs its follower only on a peer that is not the body's controller, so this field only acts where such a peer steers the body with its own client state and sets `IsLocallyPredicted`.
- **Blend Mode** (`ConvergenceBlendMode.Position` or `.Velocity`): how a correction moves the body. In open space the two look the same. `Position` moves the body straight toward where it should be, so a correction into geometry can briefly push the body into it before it is pushed back out. `Velocity` corrects through the body's own motion, so contacts, stacks, and other bodies are never disrupted, and a correction against geometry presses on it instead of passing into it.

## Residual fields

Below Position Threshold, a small positional error can still be closed gradually instead of being left in place:

- **Residual Close Rate**: how quickly that small error is closed, per second. Higher closes a slow body's drift faster, lower is gentler at first contact, and zero leaves the small offset in place.
- **Residual Close Maximum Speed**: the body speed above which the small error is left alone. A body that was just bumped or is still moving is faster than this, so the gentle close never fights a fresh contact.

## Escape hatches

- **Teleport Distance** (meters, proxy-only) — the divergence past which a proxy snaps its whole pose onto the target instead of gliding; the smoothed visual jumps too. Zero disables it, so the body always blends however far off it is. A predicted body is exempt and never teleports.
- **Maximum Projection Time** (seconds, proxy-only) — the maximum time a proxy's projection may lead the last received state. A predicted body spans its whole round trip and ignores this field entirely.
- **Gravity Enabled** (default on) — whether gravity participates in the projection. On, a falling body is carried down under gravity while resting or supported bodies are left alone, so they are never projected into the ground. Off, the projection ignores gravity entirely.

## Visual smoothing changes the render, never the body

- **Visual Smoothing** (seconds, default `0`): smooths the visible motion of `SmoothedVisual` to hide the small jumps corrections cause. Requires a `SmoothedVisual`; without one it has nothing to act on. It changes only what is drawn: the physics body, its collisions and what it replicates are untouched, so nothing can desync. Larger values smooth more but let the drawn object trail the body further; zero, the default, turns it off.

## Replay hold keeps the body still while a correction replays

The **Replay Hold Enabled** field (on by default) adds a `ReplayHeldBody` to the object as it wakes, when it has none.

A client that receives a correction for an object it predicts replays every tick since, and each replayed tick steps the whole physics world. A `NetworkRigidbody` body is never rewound, because it is converged rather than predicted, so it must not be stepped again. While a replay runs, `ReplayHeldBody` makes the body kinematic, and afterwards it makes it dynamic again with its velocities, its sleep state and its collision detection mode as they were. A continuous collision mode, which a kinematic body cannot use, is speculative for the length of the replay.

A held body keeps its colliders, so it stays a solid obstacle during the replay. It stands where it is now, not where it was on the replayed tick, so a predicted body that pushed it in the past meets something that does not give. Switching the body to kinematic and back also resets its contacts, so a body resting on another may settle slightly differently after a replay.

Turn the field off only when you hold the body some other way. You can also add a `ReplayHeldBody` yourself to any other dynamic `Rigidbody` or `Rigidbody2D` a replay must not move; in play mode its inspector shows whether a replay is holding it. A body predicted through a `ValidatedRigidbody` needs none, because it holds itself for any replay that leaves it out; see [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md).

## How the fields reach the follower

At bring-up (`Awake`, and again on every inspector edit) most of these fields are written into a `PhysicsConvergenceSettings` and assigned to `Convergence.Settings`. Prediction Correction Rate is the exception: it is assigned straight to `Convergence.PredictionCorrectionRate` instead, since it lives on the follower itself rather than in `Settings`.

The maths behind each of these values, and the full settings surface, live on the [PhysicsConvergence](../../core-api/physics/physics-convergence.md) API page — including `PredictionMaximumProjectionSeconds`, the predicted-body counterpart to Maximum Projection Time, which has no inspector field here at all.

## Methods you can call

`NetworkRigidbody` exposes three public methods, all already called for you by the `PhysicsSimulationDriver` and the spawn handler:

- `PreSimulate(float stepDelta)`: the body's work for a tick before the physics world steps.
- `PostSimulate(uint tick)`: the body's work for a tick after the physics world steps.
- `NotifySceneChanged()`: tells the body its `GameObject` moved to another scene. Call it after such a move; without it, the body keeps simulating in the scene it left.

You will not normally call any of these directly.
