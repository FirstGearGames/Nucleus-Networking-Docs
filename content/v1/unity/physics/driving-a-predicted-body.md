---
title: "Driving a predicted body"
---

> **Driving the core API directly?** See [Locally predicted bodies](../../core-api/physics/locally-predicted-bodies.md).

This page covers a body the server controls and simulates while one client steers it, such as a player's own physics character. The steering client applies its own client state at once, while the server still owns where the body really is. For a body the client controls outright, use a validated behaviour instead; [Predicting a body with a validated behaviour](./predicting-a-body-with-a-validated-behaviour.md) helps you choose.

## Turn prediction on

On the peer steering the body, set `Convergence.IsLocallyPredicted` to `true`, and set it back to `false` the moment this peer stops driving the body:

```csharp
networkRigidbody.Convergence.IsLocallyPredicted = true;
```

- The flag only has an effect on a peer that is not the body's controller. On the controller the body simulates freely and its result is sent.
- While it is set, the body only trims a position or rotation error once it passes its threshold, and never teleports.
- Every step still sets the body's velocity from its target. For your client state to show at once, assign `Convergence.TargetProvider` a provider whose target includes it, as the PhysicsBallMover demo does.
- A proxy left with the flag set has no client state of its own to trust.

## Apply force on the network tick

Physics steps on the network tick, not on Unity's `FixedUpdate`, so force applied in `FixedUpdate` does nothing or fires at the wrong rate. Use one of these instead:

- Subscribe to `PhysicsSimulationDriver.WorldStepStarted`, raised before each world step:

```csharp
driver.WorldStepStarted += (tick, stepDelta) =>
{
    rigidbody.AddForce(clientStateDirection * forceScale);
};
```

- Or override `OnEarlyFixedUpdate` on a `NucleusBehaviourBase`. It runs at the same point:

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    rigidbody.AddForce(clientStateDirection * forceScale);
}
```

`stepDelta.FixedDelta` is the step's fixed timing. `SimulationContext` names the pass the step belongs to; see [Replaying a correction in Unity](../control/reconcile-in-unity.md).

## Tune the correction

A predicted body ignores **Blend Per Tick** and uses **Prediction Correction Rate** (`Convergence.PredictionCorrectionRate`): the fraction of a position or rotation error closed per tick once past the threshold. Higher snaps back harder; lower corrects gently. `0` turns correction off entirely, and the body is then also exempt from teleporting, so a desync never closes. Leave some nonzero rate.

A healthy predicted body corrects rarely: only on a genuine divergence such as a hit, a collision the server resolved differently, or a dropped tick of client state. A good correction looks like a brief nudge that eases back in over a few ticks. If corrections look like a snap, the rate is too high, the threshold is too tight, or the divergence itself is worth chasing.

## Choose how a remote-controlled proxy moves

A body a client controls outright (its `ControllerConnectionId` is set) is not predicted on other peers. It is a proxy driven by that client's state, and `RemoteExtrapolationEnabled` decides how it moves:

- `true` (the default): the proxy extrapolates forward from the last received state. It stays nearer present time but overshoots on abrupt changes: a stopping body slides on a little, then corrects. Prefer it for a fast body where responsiveness matters more than a rare overshoot.
- `false`: the proxy follows the received states as a kinematic body, always a step behind but smooth. Prefer it where overshoot looks worse than lag: dense contacts, tight geometry, or a body other players stand near.

Sending the client state itself is covered in [Sending client state from Unity](../control/writing-a-client-state-component-unity.md).
