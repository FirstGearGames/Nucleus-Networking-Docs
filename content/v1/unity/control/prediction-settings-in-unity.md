---
title: "Prediction settings on the Unity manager"
---

> **Driving the core API directly?** See [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members).

## Prediction History Ticks

The Unity system manager exposes a **Prediction History Ticks** field (backed by `_predictionHistoryTicks`). It defaults to `SystemManager.UnsetPredictionHistoryTicks`, which is zero.

Zero means "leave the per-member defaults alone." Every predicted member and input member already sizes its own ring; this field only raises that ring when a value is set.

## When it takes effect

`UnitySystemManager.ManagersInstantiated` assigns the field straight onto the core manager:

```csharp
NucleusSystemManager.PredictionHistoryTicks = _predictionHistoryTicks;
```

This runs inside `ManagersInstantiated`, before any user script's `Awake` or `Start` can observe `SystemManager`. Script execution order cannot get ahead of it, so there is no ordering trap to work around.

## Sizing it

`SystemManager.PredictionHistoryTicks` must cover the round trip plus the state interpolation depth (`StateInterpolation`). A predicted member's compare gate has to still hold the tick a server outcome echoes, and that echo arrives a round trip plus interpolation later. A member's own default ring depth is two slots, which spans only a single tick of history — not enough to address a compare tick more than one tick back, so a networked prediction setup almost always needs this field raised above zero.

## How the value is actually used

The depth is read once, when a member initializes. The ring it allocates is the largest of three numbers:

- the member's own default ring depth (`GetRingDepth()`)
- `PredictionHistoryTicks`
- the member's served-interval history, sized from its own send cadence, which the prediction history figure does not cover

Two consequences follow directly from this:

- Raising the manager's field does not always change a given member's ring. If a member's served-interval history or its own `GetRingDepth()` already exceeds `PredictionHistoryTicks`, the field has no effect on that member.
- Changing the field after systems have started does not resize rings already allocated. The comparison happens at member initialization, not continuously.

## Where to go next

For what a predicted member does with the ring once it is sized, see [Predicted members and prediction history](../../core-api/control/prediction-history-and-predicted-members).
