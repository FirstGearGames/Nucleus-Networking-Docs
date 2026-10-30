---
title: "Locally predicted bodies"
---

> **Using Unity?** See [Driving a predicted body](../../unity/physics/driving-a-predicted-body.md).

A body this peer is driving does not have to trail the server like a proxy does. Setting `IsLocallyPredicted` on that body's `PhysicsConvergence` switches it from following to reconciling: it keeps responding to local client state instantly, and only trims the small gap that opens up against the server's snapshot.

## What IsLocallyPredicted changes

It is easy to assume a predicted body keeps the velocity the local simulation produced. It does not. `PhysicsConvergence.Step` sets `physicsBody.LinearVelocity` from the projected snapshot every step, the same as for a proxy, so a velocity your own code set before `Step` does not survive it.

Three things are different for a predicted body:

- **Projection cap.** A proxy's snapshot is projected forward by at most `Settings.MaximumProjectionSeconds`. A predicted body uses `PredictionMaximumProjectionSeconds` instead, which is larger by default and must cover a full round trip.
- **No distance teleport.** A proxy that diverges past `Settings.TeleportDistance` snaps its whole pose onto the target at once. A predicted body is exempt, and any gap closes smoothly through the correction below instead.
- **Correction.** Past `Settings.PositionThreshold`, a proxy blends toward the target at `BlendPerTick`, moving the body or correcting through its motion depending on `ConvergenceBlendMode`. A predicted body instead closes the gap through its motion at `PredictionCorrectionRate`, and only once it is past `Settings.PositionThreshold` or `Settings.RotationThreshold`, never before.

## PredictionCorrectionRate

`PredictionCorrectionRate` (default `0.1f`) is the fraction of the position or rotation gap the correction takes off per tick, once past threshold. It scales the same way as a proxy's `BlendPerTick`, but applies only past `PositionThreshold` and `RotationThreshold` rather than continuously, so a well-predicted body that stays inside those thresholds is never nudged at all.

Setting it to `0` disables the correction entirely. The body becomes pure prediction: it no longer reconciles a genuine divergence, and since a predicted body is also exempt from the distance teleport, nothing ever pulls it back onto the server. This is rarely what you want — use it only to isolate prediction drift while debugging, not as a running configuration.

Higher values snap the body back to the server harder and sooner; lower values let the prediction ride looser and correct gently.

## PredictionMaximumProjectionSeconds

`PredictionMaximumProjectionSeconds` (default `1f`) is the predicted counterpart to `Settings.MaximumProjectionSeconds`. Set it to at least the longest round trip you expect. If it is shorter, the target lands short of where the body has been predicted to, and the correction drags the body backward.

## Choosing ticksToProject

`Step` takes `ticksToProject` as a parameter, not a constant. For a predicted body, base it on the measured round trip rather than a fixed tick count: `Connection.RoundTripTimeMilliseconds` gives that peer's current estimate. Project less than a full round trip and the body responds less instantly to its own client state.

```csharp
public uint RoundTripTimeMilliseconds { get; private set; }
```

## Clearing IsLocallyPredicted

Flip `IsLocallyPredicted` back to `false` the moment control leaves the body. Left set, the body keeps skipping the teleport and the proxy blend it needs once it goes back to following the server.

`Reset()` clears `TargetError`, `HasTeleportedThisStep`, and `IsLocallyPredicted` together, for pool reuse or respawn.

## Out of scope

Client state, the reconcile against confirmed server state, and the replay window that produces `ticksToProject`'s upper bound are a separate subject, covered on the control and prediction pages.
