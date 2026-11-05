---
title: "PhysicsConvergence"
---

> **Using Unity?** See [NetworkRigidbody](../../unity/physics/network-rigidbody.md).

`PhysicsConvergence` follows the latest server snapshot for one proxy body, projected to the present, and blends or teleports a diverged pose back onto it.

## Call Step before each physics step

```csharp
public void Step(IPhysicsBody physicsBody, in PhysicsSnapshot remotePhysicsSnapshot, float tickDelta, float ticksToProject)
```

Call `Step` once per physics step for each proxy body, before your engine simulates.

- `remotePhysicsSnapshot`: the last snapshot received from the server.
- `tickDelta`: the duration of one tick.
- `ticksToProject`: how many ticks that snapshot lags local time.

`Step` writes the body's `LinearVelocity` and `AngularVelocity`, and on a blend or teleport its `Position` and `Rotation`. If `physicsBody.IsKinematic`, it returns without touching the body.

## Tune it with PhysicsConvergenceSettings

`Settings` holds the tuning. `new PhysicsConvergenceSettings()` gives the recommended defaults below.

| Field | Default | Meaning |
|---|---|---|
| `PositionThreshold` | `0.1` | Positional divergence in metres past which the body blends back toward the target. |
| `RotationThreshold` | `5` | Rotational divergence in degrees past which the body blends back toward the target. |
| `BlendPerTick` | `0.1` | Fraction of the remaining gap closed per tick while over threshold, from 0 (never) to 1 (onto the target in one tick). |
| `ResidualCloseRate` | `0.5` | How quickly, per second, an offset under `PositionThreshold` closes on a slow body, through its motion. Zero leaves the offset in place. |
| `ResidualCloseMaximumSpeed` | `0.5` | Body speed in metres per second above which an offset under threshold is left alone, so a bumped or moving body is not pulled against its motion. |
| `TeleportDistance` | `4` | Positional divergence in metres past which the whole pose snaps onto the target. Zero disables the teleport. |
| `MaximumProjectionSeconds` | `0.2` | Cap, in seconds, on how far a stale snapshot is projected before the blend takes over. |
| `GravityProjection` | `GravityProjection.Auto` | Whether gravity participates in the projection. See [Trajectory projection](./trajectory-projection.md). |
| `BlendMode` | `ConvergenceBlendMode.Position` | How an over-threshold divergence is closed. |

Each step, `Step` measures the divergence and responds in one of three ways:

- **Over `TeleportDistance`:** position and rotation snap onto the target, and `HasTeleportedThisStep` is set. A locally predicted body never teleports.
- **Over a threshold:** position and rotation blend toward the target at `BlendPerTick`, per `BlendMode`.
- **Under threshold:** position is left alone, except that a body slower than `ResidualCloseMaximumSpeed` closes the offset through its motion at `ResidualCloseRate`.

## Choose how a divergence closes with ConvergenceBlendMode

- `Position` moves the body straight toward the target each step. It can briefly push the body into geometry before it is pushed back out.
- `Velocity` closes the same fraction of the gap through the body's motion. It never disrupts contacts, so it never yanks a body out of a stack or through what it rests on.

Both close the gap at the same rate in free space.

## Read the last step and reset

- `TargetError`: the positional error from the most recent step (target position minus body position).
- `HasTeleportedThisStep`: true when the most recent step snapped the pose. Use it to collapse a smoothed visual's interpolation so the jump renders instantly.
- `Reset()`: clears `TargetError`, `HasTeleportedThisStep` and `IsLocallyPredicted`, for pool reuse or respawn.

## Replace the projection with TargetProvider

By default `Step` projects the snapshot along a plain ballistic path. Set `TargetProvider` to an `IProjectionTargetProvider` to compute the target another way, for example by sweeping against geometry. See [Swept projection targets](./swept-projection-targets.md).

## Predicted bodies use their own settings

`IsLocallyPredicted`, `PredictionMaximumProjectionSeconds` and `PredictionCorrectionRate` apply only to a body this peer drives with its own client state. See [Locally predicted bodies](./locally-predicted-bodies.md).
