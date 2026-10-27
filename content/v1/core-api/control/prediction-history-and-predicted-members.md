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
| `Validate` | A predicted result, computed from the client state. | Every peer that simulates the system. | Never the value: a hash of the tick's results, with its client state |

Roles are per member. Members of every role can share a component, and the usual predicted object has all three: `Predict` members for what the player asked, `Validate` members for what the step computes from them, and `State` members for what only the server decides.

What a predicted role does depends on the peer:

- **The pure-client controller** predicts the system: it writes its `Predict` members on its live tick, runs the step at once to compute its `Validate` members, and never sends those upstream. The server checks the result and orders a correction when it differs.
- **The server** takes the controller's `Predict` members, simulates the same tick, and checks the controller's `Validate` result against its own.
- **Any other client** applies the server's values as they arrive, but a member with a role other than `State` takes part in a reconcile: it is held at the server's start-tick values while the controlled systems replay. A client that sets `NetworkSystem.IsObserverPredictionEnabled` predicts the system as its controller does (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).
- **A host** applies values as they arrive. It is the server, so nothing it predicts is ever corrected.

## The server checks the result

A `Validate` member puts the check on the server, which holds the client state and everything else the step reads:

1. After its live fixed updates, the controller hashes its system's `Validate` members, each member's absolute wire encoding at its `Accuracy` in component and member order, and appends the hash, with the sequence of the last reconcile it applied, to that tick's client state.
2. The server simulates the same tick of client state, hashes its own `Validate` members the same way and compares. On a difference it counts `Connection.ResultMismatchCount`, orders a reconcile (counted in `ReconcileSentCount`) and raises `NetworkSystem.ResultMismatched`; see [Validate results the server found different](./reconciliation.md#validate-results-the-server-found-different).
3. Results the controller computed before the correction arrived carry the old sequence, so the server passes them over instead of ordering a reconcile for each. If the controller has not echoed the new sequence within a round trip plus `StateInterpolation`, the server sends the reconcile again (`ReconcileResentCount`), so a lost reconcile costs one round trip, not a stuck client. A resend that reaches a controller which already applied the first lands as an ordinary full rather than ordering a second replay.

The controller never judges its own prediction. Every server value for a predicted member that arrives, a full that primes or recovers it included, leaves the prediction standing; only a reconcile the server orders corrects it. That is why the check works for results that depend on values the client cannot see in time: a jump the server refuses because of health only the server drains is still caught, because the server holds both the client state and the health.

A hash compares exactly, so a `Validate` member is quantized to its `Accuracy` on every write, on both peers, and each tick starts from the numbers the wire carries. Choose an accuracy the simulation can tolerate rounding to. A `Validate` member may use any `SendInterval`, since the server compares against its own current values every tick and an ordered reconcile is a full.

For a value a replay cannot reproduce exactly, such as one a physics engine moves, construct the member with `resultTolerance`. A predicted value within that distance of the server's does not count as a misprediction, so it orders no reconcile. The server can only measure the distance while the controller sends its result values (`SystemManager.IsResultValueSendEnabled`, on by default); with only the hash, the result is compared exactly. The Unity validated behaviours set it on their position, rotation and velocities.

A predicted system needs `Predict` members: the result check rides each tick of client state, and the reconcile pairs with the server's echo of that tick. A system with `Validate` members and no client state sends nothing for the server to check, and the server's values simply overwrite the prediction.

The result check runs after the client state is validated. A tick the server's `IMemberWriteValidator<T0>` corrected therefore produces a different result, and the controller is reconciled onto the server's outcome.

## An observer that predicts compares for itself

An observer predicting a system another client controls (`IsObserverPredictionEnabled`) has no result check of its own on the server, which checks only the controller. It compares the server's values for that system's `Validate` members itself, at the tick its own echo names, within each member's `Accuracy`:

- **A match** is discarded. The prediction stands and the server's value is not applied.
- **A mismatch** is recorded with the tick and a `MismatchCause`, and the system keeps predicting until the `Reconcile` step, where the engine restores and replays (see [Reconciliation and replay](./reconciliation.md)).
- **A history too shallow** to reach the echoed tick is recorded as `MismatchCause.HistoryMissing`, and the system logs a warning once naming `SystemManager.PredictionHistoryTicks`.
- **A full the server did not order** (a prime or a loss recovery) is compared like any other value, and is recorded as `MismatchCause.Resync` only when a value differs.

The server sends a member only when it changes, so at the end of each packet that echoes a new tick, every `Validate` member on `SendInterval.Normal` without projection that the packet did not carry is compared against the server value the observer already holds. A paced or projected member's silence can also mean its send was not due, so it is checked only when a value arrives.

## Prediction history depth

`SystemManager.PredictionHistoryTicks` sets how many ticks of history `Predict` and `Validate` members keep, so a reconcile can restore any member to a past tick and a replay can read each past tick's client state. It must cover the round trip plus `SystemManager.StateInterpolation`, with headroom. At 60 ticks per second a 250 ms round trip is 15 ticks; with an interpolation of 2, use 24 or more.

Left at `SystemManager.UnsetPredictionHistoryTicks` (0), the default, every client gives the predicted members of every system it holds, controlled or not, `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second). The server, which never rolls back, keeps the members' own two ticks. When a reconcile starts at a tick older than the history holds, the server's value still lands there and the system replays from it, and a warning naming the shortfall is logged once per system.

A member takes the history when it initializes, and a system grows its members to it when this client gains control, so set the value before systems spawn. A member served on an interval widens its history further on its own, independent of `PredictionHistoryTicks`, so a replay can still address the ticks between its serves.

## Reading ring history

```csharp
public bool TryGetValueByTick(uint tick, out T0 value)
public bool TryGetValueAtOrBeforeTick(uint tick, out T0 value)
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap)
public bool TryGetMismatchValues(out T0 predictedValue, out T0 serverValue)
public bool TryGetPreRewindValue(out T0 value)
```

- `TryGetValueByTick` returns the value written on exactly that tick, and false when the member was not written on it or its history no longer holds it. Use it to read a `Predict` member's value for a past tick.
- `TryGetValueAtOrBeforeTick` returns the value the member held as of that tick, the last write at or before it, and is false only when every tick it holds is newer. This is the lookup the restore uses, so a predicted member need not be written every tick.
- `TryGetPreviousValueAndTickGap` returns the value in the slot before the live one with the tick span between the two, for code that derives a rate of change (a velocity from position deltas, for example). It returns false when the live slot is not strictly newer than the previous one.
- `TryGetMismatchValues` returns this client's value and the server's at `ReplayReport.StartTick`, when the latest reconcile found this member wrong, from the restore until the next tick advance.
- `TryGetPreRewindValue` returns the value the member held before the latest reconcile restored it, the value that was on screen, until the next tick advance.

## PredictedMemberChangeViolation

A controller must not send a `Validate` member's value upstream: its client state carries what the server needs, and the server simulates the outcome. If a client sends a value for a member it predicts, `NetworkSystem` raises a `PredictedMemberChangeViolation`:

```csharp
public struct PredictedMemberChangeViolation : IViolation
{
    public uint SystemId;
}
```

It carries the `SystemId` of the `NetworkSystem` whose predicted member the sender attempted to change, and is raised with `ViolationAction.Ignore`. The incoming bits are consumed either way, by the caller's decode, so the wire stream stays aligned regardless of the verdict; only the ring is left untouched. Subscribe via `ViolationManager.PredictedMemberChangeViolationDetected` to observe these without changing the outcome.

## Opting in

Prediction is an explicit, per-member opt-in you add to your own `NetworkMember<T0>` field declarations; no base class turns it on for you. The Unity demo `Demos/Prediction/ValidatedJump` declares its walk direction and jump press with `MemberRole.Predict`, every movement result of `ValidatedJumpMovementComponent` with `MemberRole.Validate`, and simulates them in its `OnEarlyFixedUpdate`.

See [Reconciliation and replay](./reconciliation.md) for what happens once the server orders a correction: the restore, the replay the engine runs, and the report of what changed.
