---
title: "Predicted members and prediction history"
---

> **Using Unity?** See [Prediction settings on the Unity manager](../../unity/control/prediction-settings-in-unity.md).

## A member's role says what it is for

`NetworkMember<T0>` takes a `role` constructor argument, `MemberRole.Replicate` by default, readable afterwards as `NetworkMember<T0>.Role`:

```csharp
public readonly NetworkMember<System.Numerics.Vector2> MoveDirection = new(role: MemberRole.Predict);
public readonly NetworkMember<System.Numerics.Vector3> Position = new(role: MemberRole.Validate, accuracy: 0.01f);
public readonly NetworkMember<ushort> Health = new();
```

| Role | What it is | Who writes it | What the controller sends upstream |
| --- | --- | --- | --- |
| `Replicate` | An ordinary member. Inbound values apply as they arrive. | The server, or a client its write access allows. | The value, when it changes and write access allows it |
| `Predict` | Client state: a per-tick value the simulation reads. | Whoever controls the system, on its live tick. | The value, every tick (see [Client state](./client-state-components.md)) |
| `Validate` | A predicted result, computed from the client state. | Every peer that simulates the system. | Nothing the server applies. The server checks the controller's result for each tick against its own and orders a correction when they differ |

Roles are per member, and one component can mix all three. The usual predicted object has `Predict` members for what the player asked, `Validate` members for what the step computes from them, and `Replicate` members for what only the server decides. Nothing turns prediction on for you.

What a predicted role does depends on the peer:

- **The pure-client controller** writes its `Predict` members on its live tick and runs the step at once to compute its `Validate` members.
- **The server** takes the controller's `Predict` members, simulates the same tick and checks the controller's `Validate` result against its own, without ever applying it.
- **Any other client** applies the server's values as they arrive. During a reconcile, a member with a role other than `Replicate` is held at the server's start-tick values while the controlled systems replay. A client that sets `NetworkSystem.IsObserverPredictionEnabled` predicts the system as its controller does (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).
- **A host** applies values as they arrive. It is the server, so nothing it predicts is ever corrected.

## The server checks the controller's result

1. The controller runs its live fixed updates and computes that tick's `Validate` results.
2. The server simulates the same tick of client state and compares its `Validate` results with the controller's. On a difference it counts `Connection.ResultMismatchCount`, orders a reconcile (counted in `ReconcileSentCount`) and raises `NetworkSystem.ResultMismatched`; see [Validate results the server found different](./reconciliation.md#validate-results-the-server-found-different).
3. Results the controller computed before the correction arrived are passed over rather than ordering a reconcile each. If the controller has not applied the correction within a round trip plus `StateInterpolation`, the server sends the reconcile again (`ReconcileResentCount`), so a lost reconcile costs one round trip. A resend that reaches a controller which already applied the first does not order a second replay.

The controller never judges its own prediction: server values that arrive for a predicted member leave the prediction standing, and only a reconcile the server orders corrects it. So the check catches results that depend on values the client cannot see in time, such as a jump the server refuses because of health only the server drains.

Rules for `Validate` members:

- A value is only as precise as the member's `Accuracy`, the same on both peers. Choose an accuracy the simulation can tolerate.
- Any `SendInterval` works.
- For a value a replay cannot reproduce exactly, such as one a physics engine moves, construct the member with `resultTolerance`. A predicted value within that distance of the server's orders no reconcile. It applies only while the controller's `SystemManager.IsResultValueSendEnabled` is on, the default; with it off, the result is compared exactly. The Unity validated behaviours set it on their position, rotation and velocities.
- The system needs `Predict` members. Without client state the server has nothing to check, and its values simply overwrite the prediction.
- The result check runs after the client state is validated, so a tick your `IMemberWriteValidator<T0>` corrected produces a different result, and the controller is reconciled onto the server's outcome.

## An observer that predicts compares for itself

The server checks only the controller. An observer predicting a system another client controls (`IsObserverPredictionEnabled`) compares the server's values for that system's `Validate` members itself, at the tick its own echo names, within each member's `Accuracy`:

- **A match** is discarded. The prediction stands and the server's value is not applied.
- **A mismatch** is recorded with the tick and a `MismatchCause`, and the system keeps predicting until the `Reconcile` step, where the engine restores and replays (see [Reconciliation and replay](./reconciliation.md)).
- **A history too shallow** to reach the echoed tick is recorded as `MismatchCause.HistoryMissing`, and the system logs a warning once naming `SystemManager.PredictionHistoryTicks`.
- **A value the server sent without ordering a reconcile** (the first values received, or a resend after loss) is compared like any other, and is recorded as `MismatchCause.Resync` only when it differs.

A `Validate` member on `SendInterval.Normal` without projection is checked on every new tick the server confirms, against the server value the observer already holds when no new value arrived. A paced or projected member is checked only when a value arrives.

## Set the prediction history depth before systems spawn

`SystemManager.PredictionHistoryTicks` sets how many ticks of history `Predict` and `Validate` members keep, so a reconcile can restore any member to a past tick and a replay can read each past tick's client state. Cover the round trip plus `SystemManager.StateInterpolation`, with headroom: at 60 ticks per second a 250 ms round trip is 15 ticks, so with an interpolation of 2 use 24 or more.

- The default, `SystemManager.UnsetPredictionHistoryTicks` (0), gives the predicted members of every system a client holds, controlled or not, `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second).
- The server never rolls back and keeps the members' own two ticks.
- When a reconcile starts at a tick older than the history holds, the server's value still lands there and the system replays from it, and a warning naming the shortfall is logged once per system.
- A member takes the history when it initializes, and a system grows its members to it when this client gains control, so set the value before systems spawn.
- A member served on an interval widens its own history further, independent of `PredictionHistoryTicks`, so a replay can still address the ticks between its serves.

## Read past values

```csharp
public bool TryGetValueByTick(uint tick, out T0 value)
public bool TryGetValueAtOrBeforeTick(uint tick, out T0 value)
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap)
public bool TryGetMismatchValues(out T0 predictedValue, out T0 serverValue)
public bool TryGetPreRewindValue(out T0 value)
```

- `TryGetValueByTick` returns the value written on exactly that tick, and false when the member was not written on it or its history no longer holds it. Use it to read a `Predict` member's value for a past tick.
- `TryGetValueAtOrBeforeTick` returns the last write at or before that tick, and is false only when every tick it holds is newer. The restore uses this lookup, so a predicted member need not be written every tick.
- `TryGetPreviousValueAndTickGap` returns the value before the live one with the tick span between them, for deriving a rate of change such as a velocity from position deltas. It returns false when the live value is not strictly newer than the previous one.
- `TryGetMismatchValues` returns this client's value and the server's at `ReplayReport.StartTick` when the latest reconcile found this member wrong, from the restore until the next tick advance.
- `TryGetPreRewindValue` returns the value the member held before the latest reconcile restored it, the value that was on screen, until the next tick advance.

## Sending a Validate value upstream raises PredictedMemberChangeViolation

A controller must not send a `Validate` member's value upstream: its client state carries what the server needs, and the server simulates the outcome. If a client sends a value for a member it predicts, `NetworkSystem` raises a `PredictedMemberChangeViolation` with `ViolationAction.Ignore` and leaves the member untouched:

```csharp
public struct PredictedMemberChangeViolation : IViolation
{
    public uint SystemId;
}
```

`SystemId` names the system whose predicted member the sender tried to change. Subscribe to `ViolationManager.PredictedMemberChangeViolationDetected` to observe these without changing the outcome.
