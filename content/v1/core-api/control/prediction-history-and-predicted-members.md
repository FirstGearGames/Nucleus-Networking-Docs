---
title: "Predicted members and prediction history"
---

> **Using Unity?** See [Prediction settings on the Unity manager](../../unity/control/prediction-settings-in-unity.md).

## The isPredicted constructor argument

`NetworkMember<T0>` takes an `isPredicted` constructor argument, false by default:

```csharp
public readonly NetworkMember<int> Counter = new(isPredicted: true);
public readonly NetworkMember<System.Numerics.Vector3> Position = new(isPredicted: true);
```

A predicted member rides its inputs instead of accepting upstream state directly. On a pure client controller it is excluded from the state the controller serializes upstream: `TryFlagAsChanged` refuses to flag it as changed while the local peer is a client controller and not server-started, because the value is produced locally from inputs rather than sent. On inbound server outcomes it is compare-gated against the controller's own ring rather than applied outright, and on divergence it is rewound to the disagreeing tick and replayed forward from there.

Prediction is per member, not per method. Nothing about `isPredicted` generates code or requires a matched pair of predict/reconcile methods; a member either opts in at construction or it does not, and the compare gate and replay machinery apply uniformly to whichever members did.

## The compare gate

When a server outcome for a predicted member arrives on the controller, the member locates the local prediction for the tick the outcome echoes and compares it against the received value using the member's `Accuracy` tolerance, through a tolerance comparer:

```csharp
if (!isGenuineFull && TryGetValueByTick(compareTick, out T0 predictedValue)
    && NetworkTypeToleranceComparer<T0>.Compare(predictedValue, received, Accuracy))
{
    resolvedValue = _ringValues[_headIndex];

    return MemberApplyVerdict.PredictionResolved;
}

RewindToTick(compareTick, received);
```

A match is discarded: the predicted value already at the ring head stands, and the received value is not applied. A mismatch rewinds the ring to the compared tick, writes the corrected value there, drops every slot recorded after it (those predictions were built on now-diverged state), and lets the subsequent replay repopulate them.

The tick compared against is the controller's own processed-input tick, resolved by `TryGetPredictionCompareTick`, scoped to the system the controller actually drives so a client observing other systems never compares a remote system's ring against its own input ticks.

## Prediction history depth

`SystemManager.PredictionHistoryTicks` sets the ring depth, in ticks, that predicted members and input members allocate so the compare gate and replay can still address the tick a server outcome echoes. It must cover the round trip plus `SystemManager.StateInterpolation`. `SystemManager.UnsetPredictionHistoryTicks` (0) is the default and leaves each member's own depth untouched.

A member adopts `PredictionHistoryTicks` only when it is deeper than the member's own computed ring depth, and the setting is captured once when the member initializes, so it must be set before systems spawn. The default member ring is two slots, and because the live slot and `PreviousValue` share that ring, a depth of two only spans a single tick of history — not enough to address a compare tick more than one tick back. A member served on an interval widens its ring further on its own, independent of `PredictionHistoryTicks`, so a replay can still address the ticks between its serves.

## Reading ring history

Two reads back the compare gate and a replay:

```csharp
public bool TryGetValueByTick(uint tick, out T0 value)
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap)
```

`TryGetValueByTick` scans the ring for a slot stamped with the given tick and returns its value; this is what the compare gate uses to find the prediction at the echoed tick. `TryGetPreviousValueAndTickGap` returns the value held in the slot immediately before the live one together with the tick span between the two, for code that derives a rate of change (a velocity from position deltas, for example) rather than replicating it directly; it returns false when the live slot is not strictly newer than the previous one.

## PredictedStateChangeViolation

A controller must not write a predicted member's state upstream — its inputs carry it, and the server simulates the outcome. If a client sends state for a member it predicts, `NetworkSystem` raises a `PredictedStateChangeViolation`:

```csharp
public struct PredictedStateChangeViolation : IViolation
{
    public uint SystemId;
}
```

It carries the `SystemId` of the `NetworkSystem` whose predicted member the sender attempted to change, and is raised with `ViolationAction.Ignore`. The incoming bits are consumed either way, by the caller's decode, so the wire stream stays aligned regardless of the verdict; only the ring is left untouched. Subscribe via `ViolationManager.PredictedStateChangeViolationDetected` to observe these without changing the outcome.

## Opting in

No shipped component in the engine or the Unity integration sets `isPredicted: true`; only test components (`PredictedStateComponent`, `InterpolationStateComponent`) do. Prediction is an explicit, per-member opt-in you add to your own `NetworkMember<T0>` field declarations, not a default behavior or something a base class turns on for you.

See [Reconciliation](./reconciliation.md) for what happens after a rewind, including how a replay re-runs the ticks between the corrected tick and the present.
