---
title: "ProjectedRigidbody"
---

> **Driving the core API directly?** See [PhysicsConvergence](../../core-api/physics/physics-convergence.md).

`ProjectedRigidbody` is a `MonoBehaviour` that drives physics sync for one rigidbody. It requires a `Rigidbody` and a `NetworkSystemObject`, declares its need for the `NetworkSystem` carrying that body's replicated `NetworkPhysicsComponent`, and steps the body each tick: proxies adopt, follow the interpolation buffer, or run its `PhysicsConvergence` follower before the world simulates, and the server captures the stepped result afterward.

## Runtime surface

| Member | Type | Notes |
|---|---|---|
| `Convergence` | `PhysicsConvergence` (readonly) | The convergence follower this component owns. Tune it through `Convergence.Settings`, which the inspector fields below write into. |
| `SmoothedVisual` | `Transform` | Optional render transform, detached from the physics body, interpolated between physics steps for tick-rate rendering. |
| `RemoteExtrapolationEnabled` | `bool` (default `true`) | On, a remote-controlled proxy extrapolates forward from its last received state — more current, but overshoots on sudden input changes. Off, it interpolates between received states in remote time — smooth, never overshoots, always a step behind. |
| `Body` | `UnityPhysicsBody` (read-only) | The adapter around the attached `Rigidbody`. |
| `PhysicsComponent` | `NetworkPhysicsComponent` (read-only) | The replicated physics component this body captures into or converges from. |
| `NetworkSystem` | `NetworkSystem` (read-only) | The system this body belongs to; its controller state decides which peer's simulation is treated as ground truth. |

## Divergence thresholds

These gate both the predicted and the proxy correction paths.

- **Position Threshold** (`_positionThreshold`, meters) — the positional divergence past which the body blends back toward the projected target. Below it, counter-velocity alone holds the offset steady.
- **Rotation Threshold** (`_rotationThreshold`, degrees) — the rotational divergence past which the body blends back toward the target.

## Closing fields

How a body over its threshold corrects splits by role:

- **Blend Per Tick** (`_blendPerTick`) — the fraction of the remaining gap a *proxy* closes per tick while over threshold. A predicted body ignores this.
- **Prediction Correction Rate** (`_predictionCorrectionRate`, default `0.1`) — how aggressively a *predicted* body (one whose `Convergence.IsLocallyPredicted` is set) corrects toward the server: the fraction of the gap taken off per tick, once past Position Threshold. Higher snaps back harder and sooner; lower lets the prediction ride looser. Only the locally-controlled driver's own body sets `IsLocallyPredicted`, so this field only ever acts on that body.
- **Blend Mode** (`_blendMode`, `ConvergenceBlendMode.Position` or `.Velocity`) — how the closing fraction is applied. `Position` writes the pose directly toward the target each step, identical to `Velocity` in free space, but bypasses the solver, so a blend into geometry penetrates and depenetrates rather than resolving as a contact. `Velocity` applies the same closing fraction as a solver-integrated velocity bias, so contacts, stacks, and other bodies are never disrupted — a blend against geometry becomes a bounded press instead of a penetration.

## Residual fields

Below threshold, a sub-threshold residual can still be bled off rather than held frozen:

- **Residual Close Rate** (`_residualCloseRate`) — the per-second rate a sub-threshold positional residual is bled off by a velocity bias toward the target. Higher closes a slow body's drift faster, lower is gentler at first contact, zero holds the offset frozen.
- **Residual Close Maximum Speed** (`_residualCloseMaximumSpeed`) — the maximum body speed at which the residual close runs. A freshly bumped or still-moving body reads above it and falls back to the plain deadband, so the gentle close never fights a fresh contact.

## Escape hatches

- **Teleport Distance** (`_teleportDistance`, meters, proxy-only) — the divergence past which a proxy snaps its whole pose onto the target instead of gliding; the smoothed visual jumps too. Zero disables it, so the body always blends however far off it is. A predicted body is exempt and never teleports.
- **Maximum Projection Time** (`_maximumProjectionSeconds`, seconds, proxy-only) — the maximum time a proxy's projection may lead the last received state. A predicted body spans its whole round trip and ignores this field entirely.
- **Gravity Enabled** (`_gravityEnabled`, default on) — whether gravity participates in the projection. On, a falling body is carried down under gravity while resting or supported bodies are left alone, so they are never projected into the ground. Off, the projection ignores gravity entirely.

## Render-only

- **Visual Smoothing** (`_visualSmoothing`, seconds, default `0`) — low-passes `SmoothedVisual` toward the interpolated physics pose to hide tick-to-tick correction jitter. Requires a `SmoothedVisual`; without one it has nothing to act on. The physics body itself stays exact — captured state and collisions are untouched, so nothing can desync — only the render eases toward it. Larger smooths harder but lets the render trail the body more; zero, the default, is off.

## How the fields reach the follower

At bring-up (`Awake`, and again on every inspector edit) most of these fields are written into a `PhysicsConvergenceSettings` and assigned to `Convergence.Settings`. Prediction Correction Rate is the exception: it is assigned straight to `Convergence.PredictionCorrectionRate` instead, since it lives on the follower itself rather than in `Settings`.

The maths behind each of these values, and the full settings surface, live on the [PhysicsConvergence](../../core-api/physics/physics-convergence.md) API page — including `PredictionMaximumProjectionSeconds`, the predicted-body counterpart to Maximum Projection Time, which has no inspector field here at all.

## Methods

`ProjectedRigidbody` exposes three public methods, all already called for you by the `PhysicsSimulationDriver` and the spawn handler:

- `PreSimulate(float stepDelta)` — the pre-step half of a tick-aligned world step. Proxies adopt, follow, or run the follower here; authorities do their work post-step.
- `PostSimulate(uint tick)` — the post-step half. A server captures the freshly stepped state into its replicated component, and the step-pose window advances for the smoothed visual's render interpolation.
- `NotifySceneChanged()` — re-resolves the physics driver after this body's `GameObject` moves to another scene. A scene move fires no disable or enable, and the driver is cached at enable, so without this the body keeps stepping the world it left.

You will not normally call any of these directly.
