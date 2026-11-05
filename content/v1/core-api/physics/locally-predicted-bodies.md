---
title: "Locally predicted bodies"
---

> **Using Unity?** See [Driving a predicted body](../../unity/physics/driving-a-predicted-body.md).

Set `IsLocallyPredicted` on the `PhysicsConvergence` of a body this peer drives. The body then responds to local client state instantly and only trims the gap that opens against the server's snapshot, instead of trailing the server like a proxy.

## What IsLocallyPredicted changes

`PhysicsConvergence.Step` still sets `physicsBody.LinearVelocity` from the projected snapshot every step, as for a proxy, so a velocity your code set before `Step` does not survive it. Three things differ:

| | Proxy | Predicted body |
|---|---|---|
| Projection cap | `Settings.MaximumProjectionSeconds` | `PredictionMaximumProjectionSeconds`, larger by default; must cover a full round trip. |
| Teleport past `Settings.TeleportDistance` | Yes | Never. Any gap closes smoothly. |
| Correction | Past `Settings.PositionThreshold`, blends at `BlendPerTick` per `ConvergenceBlendMode`. | Only past `Settings.PositionThreshold` or `Settings.RotationThreshold`, closed through the body's motion at `PredictionCorrectionRate`. |

## Tune the correction with PredictionCorrectionRate

`PredictionCorrectionRate` (default `0.1f`) is the fraction of the position or rotation gap removed per tick once past threshold. A body that stays inside the thresholds is never nudged. Higher values pull the body back to the server harder and sooner; lower values correct more gently.

`0` disables correction. Since a predicted body never teleports either, nothing then pulls it back onto the server. Use `0` only to isolate prediction drift while debugging.

## Cover the round trip with PredictionMaximumProjectionSeconds

`PredictionMaximumProjectionSeconds` (default `1f`) must be at least the longest round trip you expect. If it is shorter, the target lands short of where the body was predicted to be, and the correction drags the body backward.

## Base ticksToProject on the round trip

For a predicted body, compute the `ticksToProject` argument of `Step` from `Connection.RoundTripTimeMilliseconds`, that peer's current round-trip estimate, rather than a fixed tick count. Projecting less than a full round trip makes the body respond less instantly to its own client state.

```csharp
public uint RoundTripTimeMilliseconds { get; private set; }
```

## Clear IsLocallyPredicted when control leaves

Set `IsLocallyPredicted` back to `false` as soon as control leaves the body. Otherwise it keeps skipping the teleport and proxy blend it needs once it follows the server again. `PhysicsConvergence.Reset()` also clears it.

Client state, reconciling against confirmed server state and the replay window are covered on the control and prediction pages.
