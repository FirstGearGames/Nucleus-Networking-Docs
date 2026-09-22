---
title: "PhysicsConvergence"
---

> **Using Unity?** See [ProjectedRigidbody](../../unity/physics/projected-rigidbody).

`PhysicsConvergence` is the per-body follower behind Projected physics sync. It takes the latest server snapshot, projects it to now, rides its velocity, and blends or teleports a diverged pose back onto it. Call `Step` once per physics step for each proxy body, before the engine simulates.

## Step

```csharp
public void Step(IPhysicsBody physicsBody, in PhysicsSnapshot remotePhysicsSnapshot, float tickDelta, float ticksToProject)
```

Reads the body's current position, rotation and velocity, plus `remotePhysicsSnapshot` (the last snapshot received from the server), `tickDelta` (the duration of one tick), and `ticksToProject` (how many ticks that snapshot lags local time). Writes the body's `LinearVelocity`, `AngularVelocity`, and, on a blend or teleport, its `Position` and `Rotation`.

Call `Step` before your own world step for that tick, so the follower's velocity and any position/rotation write are in place before the engine integrates. If `physicsBody.IsKinematic`, `Step` returns immediately without touching the body.

## PhysicsConvergenceSettings

`Settings` on `PhysicsConvergence` holds the tuning. `new PhysicsConvergenceSettings()` gives the recommended defaults, shown below.

| Field | Default | Meaning |
|---|---|---|
| `PositionThreshold` | `0.1` | Positional divergence in meters past which the body blends back toward the target. Below it, the counter-velocity alone holds the offset steady. |
| `RotationThreshold` | `5` | Rotational divergence in degrees past which the body blends back toward the target. |
| `BlendPerTick` | `0.1` | Fraction of the remaining gap closed per tick while over threshold, from 0 (never) to 1 (onto the target in one tick). |
| `ResidualCloseRate` | `0.5` | Per-second rate at which a sub-threshold positional residual is bled off, as a velocity bias toward the target. Zero holds the offset steady instead. |
| `ResidualCloseMaximumSpeed` | `0.5` | Body speed (m/s) above which the residual close is skipped in favor of the plain deadband, so a freshly bumped or still-moving body isn't fought. |
| `TeleportDistance` | `4` | Positional divergence in meters past which the body snaps its whole pose onto the target instead of blending. Zero disables the teleport. |
| `MaximumProjectionSeconds` | `0.2` | Cap, in seconds, on how far a stale snapshot is extrapolated before the blend takes over. |
| `GravityProjection` | `GravityProjection.Auto` | Whether gravity participates in the projection. |
| `BlendMode` | `ConvergenceBlendMode.Position` | How an over-threshold divergence is closed; see below. |

## ConvergenceBlendMode

`Position` writes the pose directly toward the target each step (a per-step lerp/slerp). `Velocity` applies the same closing fraction as a velocity bias the engine's solver integrates instead.

The two converge identically in free space — same fraction of the gap closed per tick. They differ once the body touches something: `Position` bypasses the solver, so a blend into geometry penetrates and then depenetrates. `Velocity` is mediated by the solver, so the same blend against geometry resolves as a bounded contact press, and never yanks a body out of a stack or through what it's resting on.

## The three bands

Each step, `Step` measures the divergence and picks one of three responses:

- **Over `TeleportDistance`** — the whole pose (position and rotation) snaps onto the target instantly. `HasTeleportedThisStep` is set. This only applies to an ordinary proxy; a locally predicted body is exempt (see below).
- **Over threshold, under teleport distance** — position and rotation each blend toward the target at `BlendPerTick`, per `BlendMode`.
- **Under threshold** — the position is left untouched, but if the body's own speed is below `ResidualCloseMaximumSpeed`, a velocity bias of `ResidualCloseRate` is added toward the target so a slow, never-sleeping body's residual still closes through the solver. A body moving faster than `ResidualCloseMaximumSpeed` — freshly bumped or still settling — skips the residual close and falls back to the plain deadband: the counter-velocity holds it steady until the next real divergence, so the gentle close never fights a new contact.

## Reads and reset

- `TargetError` — the positional error from the most recent step (target position minus body position), read-only.
- `HasTeleportedThisStep` — true when the most recent step snapped the pose instead of blending it, so a driver can collapse a smoothed visual's interpolation window and render the jump instantly.
- `Reset()` — clears `TargetError`, `HasTeleportedThisStep`, and `IsLocallyPredicted`, for pool reuse or respawn.
- The kinematic short-circuit: if `physicsBody.IsKinematic`, `Step` returns before reading or writing anything else on the body.

## TargetProvider

By default `Step` projects the snapshot with a closed-form trajectory. Setting `TargetProvider` (an `IProjectionTargetProvider`) replaces that projection with whatever the provider computes instead — for example a target that sweeps against geometry rather than following a pure ballistic path. See [swept projection targets](../physics/swept-projection-targets) for that provider.

## Locally predicted bodies

`IsLocallyPredicted`, `PredictionMaximumProjectionSeconds`, and `PredictionCorrectionRate` only apply to a body this peer is driving with its own input rather than following from the server. See [locally predicted bodies](../physics/locally-predicted-bodies).
