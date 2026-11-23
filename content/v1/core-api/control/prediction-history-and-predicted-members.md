---
title: "Predicted members and prediction history"
---

> **Using Unity?** See [Prediction settings on the Unity manager](../../unity/control/prediction-settings-in-unity.md).

## A member's role says what it is for

A predicted `NetworkMember<T0>` takes a `role` constructor argument, readable afterwards as `NetworkMember<T0>.Role`. A member built without one is replicated, and its `Role` reads `null`:

```csharp
public readonly NetworkMember<System.Numerics.Vector2> MoveDirection = new(role: PredictionRole.Predict);
public readonly NetworkMember<System.Numerics.Vector3> Position = new(role: PredictionRole.Validate, accuracy: 0.01f);
public readonly NetworkMember<ushort> Health = new();
```

| Role | What it is | Who writes it | What the controller sends upstream |
| --- | --- | --- | --- |
| None (replicated) | An ordinary member. Inbound values apply as they arrive. | The server, or a client its write access allows. | The value, when it changes and write access allows it |
| `Predict` | Client state: a per-tick value the simulation reads. | Whoever controls the system, on its live tick. | The value (see [Client state](./client-state-components.md)) |
| `Validate` | A predicted result, computed from the client state. | Every peer that simulates the system. | Nothing. The server keeps its own value, and each client that predicts the system compares the server's values with its prediction |

Roles are per member, and one component can mix all three. The usual predicted object has `Predict` members for what the player asked, `Validate` members for what the step computes from them, and replicated members for what only the server decides. Nothing turns prediction on for you.

What a predicted role does depends on the peer:

- **The pure-client controller** writes its `Predict` members on its live tick and runs the step at once to compute its `Validate` members. It compares each `Validate` value the server sends with its own prediction for that tick.
- **The server** takes the controller's `Predict` members, simulates the same tick and keeps its own `Validate` values. It never takes or checks the controller's.
- **Any other client** applies the server's values as they arrive. During a reconcile, a predicted member is held at the server's start-tick values while the controlled systems replay. A client that sets `NetworkSystem.ObserverPredictionEnabled` predicts the system as its controller does (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).
- **A host** applies values as they arrive. It is the server, so nothing it predicts is ever corrected.

## A client that predicts compares the server's values itself

Every client that predicts a system, its controller and an observer with `ObserverPredictionEnabled` set, compares each value the server sends for a `Validate` member with its own prediction for that tick:

- **A match** is discarded. The prediction stands and the server's value is not applied.
- **A value outside the member's tolerance** is recorded with the tick and a `MismatchCause`, and the system keeps predicting until the `Reconcile` step, where the engine restores and replays from that tick (see [Reconciliation and replay](./reconciliation.md)).
- **A history too shallow** to reach the tick is recorded as `MismatchCause.HistoryMissing`, and the system logs a warning once naming `SystemManager.PredictionHistoryTicks`.
- **A value the server sent to resynchronize this client** (the first values received, or a resend after loss) is compared like any other, and is recorded as `MismatchCause.Resync` only when it differs.

A difference means the result depended on something the client could not see in time, such as a jump the server refuses because of health only the server drains.

Rules for `Validate` members:

- A value is only as precise as the member's `Accuracy`, the same on both peers. Choose an accuracy the simulation can tolerate.
- A `Validate` member sends on every changed tick, as a `Predict` member does. Neither takes a send interval at construction, and `SetSendInterval` on either is held at `SendInterval.Normal`, so only replicated members can be paced.
- For a value a replay cannot reproduce exactly, such as one a physics engine moves, construct the member with `resultTolerance`. A server value within that distance of the prediction counts as a match. With no tolerance set, the member compares at its `Accuracy`. The Unity validated behaviours set a tolerance on their position, rotation and velocities.
- The system needs `Predict` members. Without client state the server cannot simulate the controller's ticks, and its values simply overwrite the prediction.
- The server simulates a tick after its client state is validated, so a tick your `IMemberWriteValidator<T0>` corrected produces a different result, and the controller replays onto the server's outcome.

## Set the prediction history depth before systems spawn

`SystemManager.PredictionHistoryTicks` sets how many ticks of history `Predict` and `Validate` members keep, so a reconcile can restore any member to a past tick and a replay can read each past tick's client state. Cover the round trip plus `SystemManager.StateInterpolation`, with headroom: at 60 ticks per second a 250 ms round trip is 15 ticks, so with an interpolation of 2 use 24 or more.

- The default, `SystemManager.UnsetPredictionHistoryTicks` (0), gives the predicted members of every system a client holds, controlled or not, `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second).
- The server never rolls back and keeps the members' own two ticks.
- When a reconcile starts at a tick older than the history holds, the server's value still lands there and the system replays from it, and a warning naming the shortfall is logged once per system.
- A member takes the history when it initializes, and a system grows its members to it when this client gains control, so set the value before systems spawn.

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
