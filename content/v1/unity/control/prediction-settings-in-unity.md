---
title: "Prediction settings on the Unity manager"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md).

The prediction fields sit under **Prediction** on the Unity system manager. Set them in the inspector before you press Play.

## Size the prediction history

**Prediction History Ticks** sets `SystemManager.PredictionHistoryTicks`: how many ticks of history `MemberRole.Predict` and `MemberRole.Validate` members keep, so a reconcile can restore a past tick and a replay can read each past tick's client state.

The default is 0 (`SystemManager.UnsetPredictionHistoryTicks`). Left at 0, every client keeps `SystemManager.DefaultPredictionHistoryTicks` (64 ticks, about a second at 60 ticks per second) for every object it holds, controlled or not, which covers most games. The server keeps two ticks.

Set a value only when the default does not fit. It must cover the worst round trip in ticks plus **State Interpolation**, with headroom: a 250 ms round trip at 60 ticks per second is 15 ticks, so with a State Interpolation of 2 use 24 or more.

- A history that falls short logs a warning once per system saying the server's value was older than its history holds, and every outcome on that system then reconciles with `MismatchCause.HistoryMissing`.
- Members take their history size when they initialize, so changing the value after objects have spawned does not resize existing members.
- A member on a paced send interval keeps a longer history of its own, whatever this field says.

## Cap replay length from code

`SystemManager.MaximumReplayTicks` has no inspector field. Set it from code once the managers exist to cap how many ticks a reconcile replays. A longer reconcile lands the server's values at its start tick without replaying and sets `ReplayReport.IsReplaySkipped`. The default, 0, sets no limit.

## Hold only nearby objects during a replay

During a replay, every object the client does not control is held at the replay's start tick. **Replay Hold Radius** (`SystemManager.ReplayHoldRadius`) limits that to objects within the radius of a restored object. An object whose position cannot be read is always held, and only Pro reads positions. The default, 0, holds every object, and a negative value is corrected to 0.

## Send Result Values

**Send Result Values** (`SystemManager.IsResultValueSendEnabled`, on by default) is read from the controlling client. While it is on, a server that finds a client's `MemberRole.Validate` result different reports which members differed and both values through `NetworkSystem.ResultMismatched`, and a member's `resultTolerance` applies. Off saves bandwidth on every tick, but the report then shows only that a mismatch happened and on which tick, and results are compared exactly. Turn it off for a release build if you do not need the values.

## Let observers predict an object

Tick **Predicted By Observers** under **Prediction** on a `NetworkSystemObject` to set `NetworkSystem.IsObserverPredictionEnabled` on every system it links, on every peer. Observing clients then predict the object as its controller does.

- It only affects an observing client that itself controls an object sending client state.
- The object's simulation must carry missing client state with `TryGetLastState`.
- Each observing client pays a simulation per tick and a replay per reconcile for it.

See [Predicting another client's object](../../core-api/control/reconciliation.md#predicting-another-clients-object). For the replay that follows a correction, see [Replaying a correction in Unity](./reconcile-in-unity.md).
