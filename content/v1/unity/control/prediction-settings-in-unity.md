---
title: "Prediction settings on the Unity manager"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md).

## Prediction History Ticks

The Unity system manager exposes a **Prediction History Ticks** field (backed by `_predictionHistoryTicks`). It defaults to `SystemManager.UnsetPredictionHistoryTicks`, which is zero.

Zero means "leave the per-member defaults alone." Every predicted member and client state member already sizes its own ring; this field only raises that ring when a value is set.

## The field is pushed onto the core manager as it comes up

`UnitySystemManager.ManagersInstantiated` assigns the field straight onto the core manager:

```csharp
NucleusSystemManager.PredictionHistoryTicks = _predictionHistoryTicks;
```

This runs inside `ManagersInstantiated`, before any user script's `Awake` or `Start` can observe `SystemManager`. Script execution order cannot get ahead of it, so there is no ordering trap to work around.

## The value must cover the round trip plus interpolation

`SystemManager.PredictionHistoryTicks` must cover the round trip plus the state interpolation depth (`StateInterpolation`). A predicted member's compare gate has to still hold the tick a server outcome echoes, and that echo arrives a round trip plus interpolation later. A member's own default ring depth is two slots, which spans only a single tick of history — not enough to address a compare tick more than one tick back, so a networked prediction setup almost always needs this field raised above zero.

## How the value is actually used

The depth is read once, when a member initializes. The ring it allocates is the largest of three numbers:

- the member's own default ring depth (`GetRingDepth()`)
- `PredictionHistoryTicks`
- the member's served-interval history, sized from its own send cadence, which the prediction history figure does not cover

Two consequences follow directly from this:

- Raising the manager's field does not always change a given member's ring. If a member's served-interval history or its own `GetRingDepth()` already exceeds `PredictionHistoryTicks`, the field has no effect on that member.
- Changing the field after systems have started does not resize rings already allocated. The comparison happens at member initialization, not continuously.

## Replay Hold Radius

The **Replay Hold Radius** field (backed by `_replayHoldRadius`) sets `SystemManager.ReplayHoldRadius` as the managers come up. When a reconcile restores the objects this client controls, every object it does not control is held at the reconcile's start tick while they replay; with a radius set, only the ones within it of a restored object are held. Distances are read through the interest position reader, so an object whose position cannot be read is always held, and only Pro reads positions. Zero, the default, holds every object. The inspector corrects a negative value to zero.

## Send Result Values

The **Send Result Values** field (backed by `_resultValueSendEnabled`, on by default) sets `SystemManager.IsResultValueSendEnabled`. It is read on the controller: while it is on, the controller sends its `PredictionMode.Validate` result values beside the hash every tick, so a server that finds a result different can name the members and both values through `NetworkSystem.ResultMismatched`. The values cost bandwidth on every tick, so turn it off for a release build to keep the hash alone.

## Predicted By Observers

The **Predicted By Observers** toggle sits under Prediction on the `NetworkSystemObject` inspector. Ticked, it sets `NetworkSystem.IsObserverPredictionEnabled` on every system as it links to the object, on every peer, so a client that observes the object predicts it as its controller does. It has an effect only on an observing client that itself controls an object sending client state. The object's simulation must carry missing client state with `TryGetLastState`, and each observing client pays a simulation per tick and a replay per reconcile for it. See [Predicting another client's object](../../core-api/control/reconciliation.md#predicting-another-clients-object).

## Where to go next

For what a predicted member does with the ring once it is sized, see [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members.md).
