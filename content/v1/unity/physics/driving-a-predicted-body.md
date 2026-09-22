---
title: "Driving a body you control"
---

> **Driving the core API directly?** See [Locally predicted bodies](../../core-api/physics/locally-predicted-bodies).

A body a client drives directly - a player's own physics character, for example - should not wait a round trip to respond. `ProjectedRigidbody` supports this: the driving peer predicts the body locally, applying its own input the instant it arrives, while the authority still owns where the body really is and the driver reconciles toward it as confirmations return.

## Turning prediction on

`ProjectedRigidbody.Convergence` is a `PhysicsConvergence`. Set `Convergence.IsLocallyPredicted` to `true` on the peer driving the body, and back to `false` when control leaves:

```csharp
projectedRigidbody.Convergence.IsLocallyPredicted = true;
```

While it is set, the follower keeps the velocity your own simulation produced instead of overwriting it with the authority's projected velocity, so your input is never washed out. It only trims a position or rotation error once that error passes the follower's threshold. Clear the flag the moment this peer stops driving the body - a proxy left with `IsLocallyPredicted` set has no input of its own to trust.

## Applying force on the right cadence

Under a `PhysicsSimulationDriver`, the physics world steps on the network tick, not on Unity's `FixedUpdate`. Applying input force in `FixedUpdate` there either does nothing or fires at the wrong rate.

Two ways to run on the actual step cadence:

- Subscribe to `PhysicsSimulationDriver.WorldStepStarted`, raised before each world step so gameplay code can apply per-step input forces on the simulated cadence:

```csharp
driver.WorldStepStarted += (tick, stepDelta) =>
{
    rigidbody.AddForce(inputDirection * forceScale);
};
```

- Or, on a `NucleusBehaviourBase` (the base every Nucleus MonoBehaviour that participates in the network loop derives from), override `OnEarlyFixedUpdate`:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta)
{
    rigidbody.AddForce(inputDirection * forceScale);
}
```

`OnEarlyFixedUpdate` maps to `NetworkLoopSteps.EarlyFixedUpdate`, which runs before the world step - the same point `WorldStepStarted` fires. Note its parameter is a `StepDelta`, not a plain `float`; use its `FixedDelta` for the step's fixed timing.

## Tuning the feel

A predicted body does not use `Blend Per Tick` (`PhysicsConvergenceSettings.BlendPerTick`) - that setting governs ordinary proxies. Instead it uses `Prediction Correction Rate` (`Convergence.PredictionCorrectionRate`, exposed in the inspector as *Prediction Correction Rate*): the fraction of a genuine position or rotation divergence closed per tick, once past the threshold.

Higher values snap the body back to the authority harder and sooner. Lower values let the prediction ride looser and correct gently. Zero disables the correction entirely, so the body is pure, unreconciled prediction - it never blends toward the authority, and it is exempt from the teleport-on-large-divergence path too, so a body left to drift this way effectively never snaps back. That is rarely what you want; leave some nonzero rate so a genuine desync still closes.

## Remote-input proxies

On every other peer, this same body is a proxy, not a predicted body - it is driven by a remote controller's input rather than this peer's own. By default (`RemoteExtrapolationEnabled = true`) such a proxy extrapolates its motion forward from the last received state, riding nearer to present time at the cost of overshooting on abrupt input changes: a stopping body slides on a little, then corrects once the slower state arrives.

Set `RemoteExtrapolationEnabled` to `false` on a body driven by a remote controller and its proxy copy instead follows the received state on the interpolation buffer as a kinematic body - always a step behind, but smooth and free of overshoot. This only takes effect once the system also has a `ControllerConnectionId` set (unset, the body has no remote controller to speak of, and none of this applies).

Prefer extrapolation for a fast, input-driven body where responsiveness matters more than a rare overshoot. Prefer the kinematic, extrapolation-off path where overshoot would look worse than lag - dense contacts, tight geometry, or a body other players might stand near.

## The input channel itself

None of the above covers how the driving peer's input reaches the network or gets reconciled against the authority's confirmation - that is the input and reconcile pipeline, not the body. See the inputs and reconcile pages for that half.

## What a correction looks like

A healthy predicted body is quiet almost all the time: your own input drives it, and a correct prediction that matches what the authority later confirms reconciles to nothing visible. A correction only becomes visible on a genuine divergence - a hit, a collision the authority resolved differently, a dropped input.

There are two distinct phases to that correction. The impact is the moment the divergence is detected - the tick the position or rotation error crosses its threshold. The recovery is everything after: the velocity bias `PredictionCorrectionRate` applies each tick, closing the gap smoothly through the solver rather than snapping the pose. A body correcting well looks like a brief nudge off its expected path that eases back in over a few ticks, not a teleport. If corrections look like a snap, `PredictionCorrectionRate` is too high, the threshold is too tight, or the divergence causing them is worth chasing on its own.
