---
title: "Prediction settings on the Unity manager"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md).

The Unity system manager groups its prediction fields under **Prediction**. Each one is applied to the core `SystemManager` when the session is built, before any user script's `Awake` or `Start` can observe `SystemManager`, so script execution order cannot get ahead of them. Set them in the inspector before play.

## Prediction History Ticks

The **Prediction History Ticks** field sets `SystemManager.PredictionHistoryTicks`: how many ticks of history `MemberRole.Predict` and `MemberRole.Validate` members keep, so a reconcile can restore any object to a past tick and a replay can read each past tick's client state.

```csharp
NucleusSystemManager.PredictionHistoryTicks = _predictionHistoryTicks;
```

It defaults to `SystemManager.UnsetPredictionHistoryTicks`, zero. Left at zero, every client keeps `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second) for every object it holds, controlled or not, which covers most games. The server, which never rolls back, keeps two ticks.

## Sizing it

Set a value only when the default does not fit. It must cover the worst round trip in ticks plus **State Interpolation**, with headroom: a 250 ms round trip at 60 ticks per second is 15 ticks, so with an interpolation of 2 use 24 or more. A history that falls short logs a warning once per system saying the server's value was older than any tick its predicted history still holds; every outcome on that system then reconciles with `MismatchCause.HistoryMissing`.

A member takes the history when it initializes, so changing the field after objects have spawned does not resize the members that already exist. A member served on a paced send interval keeps a longer history on its own, sized from its send cadence, whatever this field says.

## Maximum replay length

`SystemManager.MaximumReplayTicks` has no inspector field. Set it from code once the managers exist to cap how many ticks a reconcile replays; a longer one lands the server's values at its start tick without replaying and sets `ReplayReport.IsReplaySkipped`. Zero, the default, sets no limit.

## Replay Hold Radius

The **Replay Hold Radius** field sets `SystemManager.ReplayHoldRadius` as the managers come up. When a reconcile restores the objects this client controls, every object it does not control is held at the reconcile's start tick while they replay; with a radius set, only the ones within it of a restored object are held. Distances are read through the interest position reader, so an object whose position cannot be read is always held, and only Pro reads positions. Zero, the default, holds every object. The inspector corrects a negative value to zero.

## Send Result Values

The **Send Result Values** field (on by default) sets `SystemManager.IsResultValueSendEnabled`, and it is the controlling client's setting that counts. While it is on, a server that finds a client's `MemberRole.Validate` result different can report which members differed and both values through `NetworkSystem.ResultMismatched`, and a member's `resultTolerance` applies. Turning it off saves bandwidth on every tick, but the report then shows only that a mismatch happened and on which tick, and results are compared exactly. Turn it off for a release build if you do not need the values.

## Predicted By Observers

The **Predicted By Observers** toggle sits under Prediction on the `NetworkSystemObject` inspector. Ticked, it sets `NetworkSystem.IsObserverPredictionEnabled` on every system as it links to the object, on every peer, so a client that observes the object predicts it as its controller does. It has an effect only on an observing client that itself controls an object sending client state. The object's simulation must carry missing client state with `TryGetLastState`, and each observing client pays a simulation per tick and a replay per reconcile for it. See [Predicting another client's object](../../core-api/control/reconciliation.md#predicting-another-clients-object).

## Where to go next

For what a predicted member does with its history, see [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md); for the replay that follows a correction, see [Replaying a correction in Unity](./reconcile-in-unity.md).
