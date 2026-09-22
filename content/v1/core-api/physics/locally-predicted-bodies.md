---
title: "Locally predicted bodies"
---

> **Using Unity?** See [Driving a body you control](../../unity/physics/driving-a-predicted-body).

A body this peer is driving does not have to ride the server's velocity like a proxy does. Setting `IsLocallyPredicted` on that body's `PhysicsConvergence` switches it from following to reconciling: it keeps responding to local input instantly, and only trims the small gap that opens up against the server's snapshot.

## What IsLocallyPredicted changes

It is easy to assume a predicted body keeps the velocity the local simulation produced. It does not. `PhysicsConvergence.Step` assigns `physicsBody.LinearVelocity` from the projected snapshot unconditionally, the same as for a proxy. The source rejects the alternative deliberately: if the body kept its own velocity and only added a position bias on top, the two would drift apart with nothing to bleed the difference off, and a reversal in the server's motion would detonate that standing offset into a lurch.

So the counter-velocity assignment is shared between proxy and predicted paths. Three things are actually different for a predicted body:

- **Projection cap.** A proxy's snapshot is projected forward by at most `Settings.MaximumProjectionSeconds`. A predicted body uses `PredictionMaximumProjectionSeconds` instead, deliberately larger, because it is re-integrating its own inputs across a full round trip rather than extrapolating a stranger's motion a short distance ahead.
- **No distance teleport.** A proxy that diverges past `Settings.TeleportDistance` snaps its whole pose onto the target at once. A predicted body is exempt. A driver's own input is never expected to jump; any gap closes smoothly through the reconcile below instead.
- **Reconcile mechanism.** Past `Settings.PositionThreshold`, a proxy blends its pose toward the target (or applies a `BlendPerTick` velocity bias, depending on `ConvergenceBlendMode`). A predicted body instead applies a `PredictionCorrectionRate` velocity bias once it is past `Settings.PositionThreshold` or `Settings.RotationThreshold` — never before.

## PredictionCorrectionRate

`PredictionCorrectionRate` (default `0.1f`) is the fraction of the position or rotation gap the correction takes off per tick, once past threshold. It scales the same way as a proxy's `BlendPerTick`, but applies only past `PositionThreshold` and `RotationThreshold` rather than continuously, so a well-predicted body that stays inside those thresholds is never nudged at all.

Setting it to `0` disables the correction entirely. The body becomes pure prediction: it no longer reconciles a genuine divergence, and since a predicted body is also exempt from the distance teleport, nothing ever pulls it back onto the server. This is rarely what you want — use it only to isolate prediction drift while debugging, not as a running configuration.

Higher values snap the body back to the server harder and sooner; lower values let the prediction ride looser and correct gently.

## PredictionMaximumProjectionSeconds

`PredictionMaximumProjectionSeconds` (default `1f`) is the predicted counterpart to `Settings.MaximumProjectionSeconds`. A proxy's short cap keeps an extrapolation from running too far ahead of the last received fact. A predicted body instead re-integrates its own inputs across the whole round trip it has driven ahead of the server, so its window has to be allowed to span that round trip — capping it at the proxy's short bound would truncate the replay, land the target short of the actual prediction, and drag the body backward through the very reconcile it exists to avoid.

## Choosing ticksToProject

`Step` takes `ticksToProject` as a parameter, not a constant. For a predicted body, base it on the measured round trip rather than a fixed tick count: `Connection.RoundTripTimeMilliseconds` gives that peer's current estimate. The instant-response feel a predicted body has comes from projecting the snapshot a full round trip forward on every step, not from retaining the body's own local velocity — the velocity assignment happens either way.

```csharp
public uint RoundTripTimeMilliseconds { get; private set; }
```

## Clearing IsLocallyPredicted

Flip `IsLocallyPredicted` back to `false` the moment control leaves the body — a body no longer driven locally has no inputs to re-integrate, and left predicted it would keep skipping the teleport and the proxy reconcile it needs once it goes back to following the server.

`Reset()` clears `TargetError`, `HasTeleportedThisStep`, and `IsLocallyPredicted` together, for pool reuse or respawn.

## Out of scope

Inputs, the reconcile against confirmed server state, and the replay window that produces `ticksToProject`'s upper bound are a separate subject, covered on the control and prediction pages.
