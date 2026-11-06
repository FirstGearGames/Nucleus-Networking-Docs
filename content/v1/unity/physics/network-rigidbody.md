---
title: "NetworkRigidbody"
---

> **Driving the core API directly?** See [PhysicsConvergence](../../core-api/physics/physics-convergence.md).

`NetworkRigidbody` keeps one `Rigidbody` in agreement across every peer. To set one up, see [Replicate a rigidbody](./replicate-a-rigidbody.md).

## Read it from a script

| Member | Type | Notes |
|---|---|---|
| `Convergence` | `PhysicsConvergence` (read-only) | The follower that steers the body. The inspector fields below write into `Convergence.Settings`. |
| `SmoothedVisual` | `Transform` | Optional child that holds the body's renderer, drawn smoothly between physics steps. `NetworkRigidbody` writes its world pose every frame, so no other script or animation may write that transform. |
| `RemoteExtrapolationEnabled` | `bool` (default `true`) | On, a remote-controlled proxy extrapolates forward from its last received state: more current, but it overshoots on sudden client state changes. Off, it interpolates between received states: smooth, never overshoots, always a step behind. |
| `Body` | `UnityPhysicsBody` (read-only) | The adapter around the attached `Rigidbody`. |
| `PhysicsComponent` | `NetworkPhysicsComponent` (read-only) | The replicated component this body sends from or follows. |
| `NetworkSystem` | `NetworkSystem` (read-only) | The system this body belongs to. Its controller is the peer whose simulation counts. |

## Set when a body corrects

A proxy is a body this peer only follows. A predicted body is one whose `Convergence.IsLocallyPredicted` is set; see [Driving a predicted body](./driving-a-predicted-body.md).

| Field | What it does |
|---|---|
| **Position Threshold** (metres) | The position error past which the body blends back toward where it should be. Below it, the body keeps its small offset unless the residual fields close it. Applies to proxies and predicted bodies. |
| **Rotation Threshold** (degrees) | The rotation error past which the body blends back. Applies to proxies and predicted bodies. |
| **Blend Per Tick** | The fraction of the remaining gap a proxy closes per tick while over a threshold. A predicted body ignores it. |
| **Prediction Correction Rate** (default `0.1`) | The fraction of the gap a predicted body closes per tick once past Position Threshold. Higher snaps back harder and sooner; lower lets the prediction ride looser. |
| **Blend Mode** | `ConvergenceBlendMode.Position` moves the body straight toward where it should be, so a correction into geometry can briefly push it in before it is pushed back out. `ConvergenceBlendMode.Velocity` corrects through the body's own motion, so contacts, stacks and other bodies are never disrupted. The two look the same in open space. |
| **Residual Close Rate** (per second) | How quickly an error below Position Threshold is closed. Higher closes a slow body's drift faster, lower is gentler at first contact, and `0` leaves the offset in place. |
| **Residual Close Maximum Speed** | The body speed above which a small error is left alone, so the close never fights a fresh contact. |
| **Teleport Distance** (metres) | Proxies only. The error past which the whole pose snaps onto the target instead of gliding; the smoothed visual jumps too. `0` disables it. A predicted body never teleports. |
| **Maximum Projection Time** (seconds) | Proxies only. How far a proxy may lead its last received state. |
| **Gravity Enabled** (default on) | On, a falling body is carried down under gravity while resting or supported bodies are left alone. Off, gravity is ignored. |
| **Visual Smoothing** (seconds, default `0`) | Smooths how `SmoothedVisual` moves, hiding the small jumps corrections cause. It needs a **Smoothed Visual** and changes only what is drawn, never the body or what it sends. Larger values smooth more but trail further; `0` turns it off. |

A predicted body's counterpart to Maximum Projection Time is `Convergence.PredictionMaximumProjectionSeconds`, which has no inspector field. The [PhysicsConvergence](../../core-api/physics/physics-convergence.md) page covers every setting in full.

## Keep the body still during a replay

**Replay Hold Enabled** (on by default) adds a `ReplayHeldBody` to the object when it has none. A `NetworkRigidbody` body is never rewound, so while a correction replays, `ReplayHeldBody` makes it kinematic. Afterwards the body is dynamic again with its velocities, sleep state and collision detection mode as they were. A continuous collision mode is speculative for the length of the replay, since a kinematic body cannot use it.

- A held body keeps its colliders and stands where it is now, not where it was on the replayed tick. A predicted body that pushed it in the past meets something that does not give.
- Switching to kinematic and back resets the body's contacts, so a body resting on another may settle slightly differently after a replay.

Turn the field off only when you hold the body some other way. Add a `ReplayHeldBody` yourself to any other dynamic `Rigidbody` or `Rigidbody2D` a replay must not move; in play mode its inspector shows whether a replay is holding it. A body predicted through a `ValidatedRigidbody` needs none; see [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md).

## Call NotifySceneChanged after a scene move

Call `NotifySceneChanged()` after you move the body's GameObject to another scene, or the body keeps simulating in the scene it left. Spawn moves call it for you.

`PreSimulate(float stepDelta)` and `PostSimulate(uint tick)` run the body's work before and after each world step. The `PhysicsSimulationDriver` calls them; you will not normally call them yourself.
