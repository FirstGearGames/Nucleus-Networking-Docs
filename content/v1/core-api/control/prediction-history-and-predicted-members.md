---
title: "Predicted members and prediction history"
---

> **Using Unity?** See [Prediction settings on the Unity manager](../../unity/control/prediction-settings-in-unity.md).

## The predictionMode constructor argument

`NetworkMember<T0>` takes a `predictionMode` constructor argument, `PredictionMode.None` by default, readable afterwards as `NetworkMember<T0>.PredictionMode`:

```csharp
public readonly NetworkMember<System.Numerics.Vector3> Position = new(predictionMode: PredictionMode.Compare, accuracy: 0.01f);
public readonly NetworkMember<ushort> JumpCount = new(predictionMode: PredictionMode.Validate);
```

| Mode | Who checks the prediction | What starts a reconcile | Upstream cost |
| --- | --- | --- | --- |
| `None` | Nobody. Inbound values apply as they arrive. | Nothing. | None |
| `Compare` | The controlling client, when the server's value comes back with the echo of its client state tick. | A value that differs, a history that no longer reaches the echoed tick, or a resync full whose values differ. | None |
| `Validate` | The server, right after it simulates the same tick of client state. | A reconcile the server orders when the controller's result differs from its own. | A result hash with each tick of client state |

Prediction is per member. A member opts in where it is declared, and members of different modes can share a system. What the mode does depends on the peer:

- **The pure-client controller** predicts the member: it computes the value from its own client state ahead of the server, and never sends it upstream. `TryFlagAsChanged` refuses to flag a predicted member while the local peer predicts its system, because the value is produced locally from client state rather than sent.
- **The server** simulates the member from the controller's client state. For a `Validate` member it also checks the controller's result.
- **Any other client** applies the server's values as they arrive, but a member with a mode other than `None` takes part in a reconcile: it is held at the server's start-tick values while the controlled systems replay. A client that sets `NetworkSystem.IsObserverPredictionEnabled` predicts the system as its controller does (see [Predicting another client's object](./reconciliation.md#predicting-another-clients-object)).
- **A host** applies values as they arrive. It is the server, so nothing it predicts is ever corrected.

The compare and the reconcile need the server's echo of the controller's client state tick, so a predicted system needs a [client state component](./client-state-components.md). Without one the server's values simply overwrite the prediction.

## The compare gate

When a server value for a `Compare` member reaches a client that predicts its system, the member looks up what it held as of the echoed client state tick and compares the two within the member's `Accuracy`, through the type's tolerance comparer:

```csharp
else if (!TryGetValueAtOrBeforeTick(compareTick, out T0 predictedValue))
{
    mismatchCause = MismatchCause.HistoryMissing;
    NetworkSystem.NotifyPredictionHistoryExceeded(compareTick);
}
else if (NetworkTypeToleranceComparer<T0>.Compare(predictedValue, received, Accuracy))
{
    resolvedValue = _ringValues[_headIndex];

    return MemberApplyVerdict.PredictionResolved;
}
else
    mismatchCause = isGenuineFull ? MismatchCause.Resync : MismatchCause.ValueDiffered;

RecordMismatch(compareTick, mismatchCause);
```

The lookup is *as of* the tick, not *on* it: `TryGetValueAtOrBeforeTick` returns the newest value written at or before the echoed tick, so a member that is not written every tick compares against the value it held then instead of failing to find a slot.

- **A match** is discarded. The prediction stands and the server's value is not applied.
- **A mismatch** is recorded, not landed. The member notes the echoed tick and a `MismatchCause`, and the system keeps predicting until the `Reconcile` step, where the engine restores every system the client predicts to the earliest tick any member recorded and replays from there. See [Reconciliation and replay](./reconciliation.md).
- **A history too shallow** to reach the echoed tick is recorded as `MismatchCause.HistoryMissing`, and the system logs a warning once naming `SystemManager.PredictionHistoryTicks`.
- **A genuine full the server did not order** (a prime or a loss recovery) is compared like any other value, and is recorded as `MismatchCause.Resync` only when a value differs.
- **A reconcile the server ordered** is recorded as `MismatchCause.ServerOrdered` without a comparison.
- **An echo at or past this client's live tick** names ticks the server ran without this client's client state, as while the client stalled. No prediction pairs with it, so the prediction stands until the reconcile the server sends when the client resumes.

The tick compared against is the controller's own processed client state tick as the server echoes it, scoped to the systems this client predicts, so a client observing other systems never compares their values against its own client state ticks.

## The silent-member compare

The server sends a member only when it changes, so a value the server holds still while the client mispredicts it (a shot the server refused, say) would never arrive to be compared. At the end of each packet that echoes a new client state tick, every `Compare` member the packet did not carry is compared against the server value it already holds, which is still current because an unsent member did not change. A difference is recorded as `MismatchCause.ValueDiffered`.

This covers members on `SendInterval.Normal` without projection only. A paced or projected member's silence can also mean its send was not due, so it is checked only when a value arrives.

## Validate

A `Validate` member moves the check to the server:

1. After its live fixed updates, the controller hashes its system's `Validate` members, each member's absolute wire encoding at its `Accuracy` in component and member order, and appends the hash with the sequence of the last reconcile it applied to that tick's client state entry.
2. The server simulates the same tick of client state, hashes its own `Validate` members the same way and compares. On a difference it counts `Connection.ResultMismatchCount` and orders a reconcile through `SendReconcile` (counted in `ReconcileSentCount`).
3. Results the controller computed before the correction arrived carry the old sequence, so the server passes them over instead of ordering a reconcile for each. If the controller has not echoed the new sequence within a round trip plus `StateInterpolation`, the server sends the reconcile again (`ReconcileResentCount`), so a lost reconcile costs one round trip, not a stuck client.

On the controller a `Validate` member keeps its prediction on every inbound value and is corrected only by a reconcile the server orders. A hash compares exactly, so a `Validate` member is quantized to its `Accuracy` on every write, on both peers, and each tick starts from the numbers the wire carries. A `Validate` member may use any `SendInterval`, since the server compares against its own current values every tick and an ordered reconcile is a full.

`Validate` is separate from `NetworkClientStateComponent.TryValidateState`, which judges the client state a client sent. Both run: the client state is validated, then simulated, then the result is compared. A tick of client state the server corrected therefore produces a different result, and the controller is reconciled onto the server's outcome. For the report the server raises when results differ, see [Validate results the server found different](./reconciliation.md#validate-results-the-server-found-different).

## Prediction history depth

`SystemManager.PredictionHistoryTicks` sets how many ticks of history predicted members and client state members keep, so the compare gate can still find the tick a server outcome echoes and a reconcile can restore any member to a past tick. It must cover the round trip plus `SystemManager.StateInterpolation`, with headroom. At 60 ticks per second a 250 ms round trip is 15 ticks; with an interpolation of 2, use 24 or more.

Left at `SystemManager.UnsetPredictionHistoryTicks` (0), the default, every client gives the predicted and client state members of every system it holds, controlled or not, `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second). The server, which never rolls back, keeps the members' own two ticks.

A member takes the history when it initializes, and a system grows its members to it when this client gains control, so set the value before systems spawn. A member served on an interval widens its history further on its own, independent of `PredictionHistoryTicks`, so a replay can still address the ticks between its serves.

## Reading ring history

```csharp
public bool TryGetValueByTick(uint tick, out T0 value)
public bool TryGetValueAtOrBeforeTick(uint tick, out T0 value)
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap)
public bool TryGetMismatchValues(out T0 predictedValue, out T0 serverValue)
public bool TryGetPreRewindValue(out T0 value)
```

- `TryGetValueByTick` returns the value written on exactly that tick, and false when the member was not written on it or its history no longer holds it. Use it to read a client state member's value for a past tick.
- `TryGetValueAtOrBeforeTick` returns the value the member held as of that tick, the last write at or before it, and is false only when every tick it holds is newer. This is the lookup the compare gate and the restore use.
- `TryGetPreviousValueAndTickGap` returns the value in the slot before the live one with the tick span between the two, for code that derives a rate of change (a velocity from position deltas, for example). It returns false when the live slot is not strictly newer than the previous one.
- `TryGetMismatchValues` returns this client's value and the server's at `ReplayReport.StartTick`, when the latest reconcile found this member wrong, from the restore until the next tick advance.
- `TryGetPreRewindValue` returns the value the member held before the latest reconcile restored it, the value that was on screen, until the next tick advance.

## PredictedStateChangeViolation

A controller must not write a predicted member's state upstream: its client state carries it, and the server simulates the outcome. If a client sends state for a member it predicts, `NetworkSystem` raises a `PredictedStateChangeViolation`:

```csharp
public struct PredictedStateChangeViolation : IViolation
{
    public uint SystemId;
}
```

It carries the `SystemId` of the `NetworkSystem` whose predicted member the sender attempted to change, and is raised with `ViolationAction.Ignore`. The incoming bits are consumed either way, by the caller's decode, so the wire stream stays aligned regardless of the verdict; only the ring is left untouched. Subscribe via `ViolationManager.PredictedStateChangeViolationDetected` to observe these without changing the outcome.

## Opting in

Prediction is an explicit, per-member opt-in you add to your own `NetworkMember<T0>` field declarations; no base class turns it on for you. The Unity demo `Demos/Prediction/ValidatedJump` declares every movement member of `ValidatedJumpMovementComponent` with `PredictionMode.Validate` and simulates them in its `OnEarlyFixedUpdate`.

See [Reconciliation and replay](./reconciliation.md) for what happens once a mismatch is recorded: the restore, the replay the engine runs, and the report of what changed.
