---
title: "Interpolations"
---
Both the `PredictionManager` and `NetworkObject` have interpolation values, but with separate objectives.

`PredictionManager` interpolation is not the same as `NetworkObject` interpolation.

Interpolation on the `PredictionManager` holds a number of states in queue as interpolation, while `NetworkObject` interpolation handles graphical smoothing after running states.

A prediction interpolation of 0 — be it client or server setting — means that states would be run as soon as they are received. Most games will not use 0 interpolation as it's generally best to have at least 1 state in queue to compensate for latency. For every 1 interpolation added it's like adding latency to when spectated states are run, equal to `(interpolation * TickDelta)`.

For smoothing graphical objects beneath your `NetworkObject` see `NetworkTickSmoother`. This component allows you to configure how the object is interpolated for owner and spectators.

Under the scenario your `TickSmoother` graphical had a set spectator interpolation of 2 and your `PredictionManager` an interpolation of 1, the spectated graphical object would take 2 ticks to get to its goal after the `PredictionManager` ran the state 1 interpolation later than receiving it.
