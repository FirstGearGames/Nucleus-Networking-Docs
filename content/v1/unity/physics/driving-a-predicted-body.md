---
title: "Driving a predicted body"
---

> **Driving the core API directly?** See [Locally predicted bodies](../../core-api/physics/locally-predicted-bodies.md).

A body a client drives directly - a player's own physics character, for example - should not wait a round trip to respond. `NetworkRigidbody` supports this: the driving peer predicts the body locally, applying its own client state the instant it arrives, while the server still owns where the body really is and the driver reconciles toward it as confirmations return.

This page covers a body the server simulates while one client steers it. The other way to predict a body is a validated behaviour: the client controls the body outright, the server checks its result, and a wrong result is replayed. See [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md) for that, and for help choosing between the two.

## Turning prediction on

`NetworkRigidbody.Convergence` is a `PhysicsConvergence`. Set `Convergence.IsLocallyPredicted` to `true` on the peer steering the body with its own client state, and back to `false` when it stops:

```csharp
networkRigidbody.Convergence.IsLocallyPredicted = true;
```

The flag only has an effect on a peer that is not the body's controller. `NetworkRigidbody` runs its follower only where `NetworkSystem.IsController(ControllerType.AnyController)` is false; on the controlling peer the body simulates freely and its result is sent, so there is nothing to predict. The pattern the flag is for is the one the PhysicsBallMover demo uses: the server controls and simulates the body, and one client steers it through its own client state channel while applying the same client state to its local copy.

While it is set, the follower only trims a position or rotation error once that error passes its threshold, and never teleports the body. It does not keep the velocity your own simulation produced: every step it sets the body's velocity from its projected target, as it does for any proxy. For your client state to show up at once, the target has to include it; the PhysicsBallMover demo assigns `Convergence.TargetProvider` a provider that does. Clear the flag the moment this peer stops driving the body - a proxy left with `IsLocallyPredicted` set has no client state of its own to trust.

## Applying force on the right cadence

Under a `PhysicsSimulationDriver`, the physics world steps on the network tick, not on Unity's `FixedUpdate`. Applying force from client state in `FixedUpdate` there either does nothing or fires at the wrong rate.

Two ways to run on the actual step cadence:

- Subscribe to `PhysicsSimulationDriver.WorldStepStarted`, raised before each world step so gameplay code can apply per-step forces from client state on the simulated cadence:

```csharp
driver.WorldStepStarted += (tick, stepDelta) =>
{
    rigidbody.AddForce(clientStateDirection * forceScale);
};
```

- Or, on a `NucleusBehaviourBase` (the base every Nucleus MonoBehaviour that participates in the network loop derives from), override `OnEarlyFixedUpdate`:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    rigidbody.AddForce(clientStateDirection * forceScale);
}
```

`OnEarlyFixedUpdate` maps to `NetworkLoopSteps.EarlyFixedUpdate`, which runs before the world step - the same point `WorldStepStarted` fires. Its parameters are a `StepDelta`, not a plain `float` (use its `FixedDelta` for the step's fixed timing), and a `SimulationContext` naming the pass the step belongs to (see [Replaying a correction in Unity](../control/reconcile-in-unity.md)).

## Tuning the feel

A predicted body does not use `Blend Per Tick` (`PhysicsConvergenceSettings.BlendPerTick`) - that setting governs ordinary proxies. Instead it uses `Prediction Correction Rate` (`Convergence.PredictionCorrectionRate`, exposed in the inspector as *Prediction Correction Rate*): the fraction of a genuine position or rotation divergence closed per tick, once past the threshold.

Higher values snap the body back to the server harder and sooner. Lower values let the prediction ride looser and correct gently. Zero disables the correction entirely, so the body is pure, unreconciled prediction - it never blends toward the server, and it is exempt from the teleport-on-large-divergence path too, so a body left to drift this way effectively never snaps back. That is rarely what you want; leave some nonzero rate so a genuine desync still closes.

## Remote client state proxies

A body a client controls outright (its `ControllerConnectionId` is set) is a different case: on every other peer it is a proxy driven by that remote controller's client state, not a predicted body. By default (`RemoteExtrapolationEnabled = true`) such a proxy extrapolates its motion forward from the last received state, riding nearer to present time at the cost of overshooting on abrupt client state changes: a stopping body slides on a little, then corrects once the slower state arrives.

Set `RemoteExtrapolationEnabled` to `false` on a body driven by a remote controller and its proxy copy instead follows the received state on the interpolation buffer as a kinematic body - always a step behind, but smooth and free of overshoot. This only takes effect once the system also has a `ControllerConnectionId` set (unset, the body has no remote controller to speak of, and none of this applies).

Prefer extrapolation for a fast, client-state-driven body where responsiveness matters more than a rare overshoot. Prefer the kinematic, extrapolation-off path where overshoot would look worse than lag - dense contacts, tight geometry, or a body other players might stand near.

## The client state channel itself

None of the above covers how the driving peer's client state reaches the network or gets reconciled against the server's confirmation - that is the client state and reconcile pipeline, not the body. See the client state and reconcile pages for that half.

## What a correction looks like

A healthy predicted body is quiet almost all the time: your own client state drives it, and a correct prediction that matches what the server later confirms reconciles to nothing visible. A correction only becomes visible on a genuine divergence - a hit, a collision the server resolved differently, a dropped tick of client state.

There are two distinct phases to that correction. The impact is the moment the divergence is detected - the tick the position or rotation error crosses its threshold. The recovery is everything after: the velocity bias `PredictionCorrectionRate` applies each tick, closing the gap smoothly through the solver rather than snapping the pose. A body correcting well looks like a brief nudge off its expected path that eases back in over a few ticks, not a teleport. If corrections look like a snap, `PredictionCorrectionRate` is too high, the threshold is too tight, or the divergence causing them is worth chasing on its own.
