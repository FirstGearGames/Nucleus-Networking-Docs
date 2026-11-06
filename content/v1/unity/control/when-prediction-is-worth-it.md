---
title: "When prediction is worth its cost"
---

> **Driving the core API directly?** See [When prediction is worth its cost](../../core-api/control/when-prediction-is-worth-it.md).

## Prediction only hides the controller's round trip

With prediction, the controlling client applies its own input at once instead of waiting for the server's answer, and the server later confirms or corrects it. That is the whole benefit. It does not make an object more accurate, more responsive to other peers or cheaper to replicate. An object nobody controls has no round trip to hide, and most of a world (static geometry, background actors, anything only the server moves) is like that.

## Prediction costs memory, bandwidth and replay time

You turn prediction on per member with the `role` argument of `NetworkMember<T0>`: client state declared `MemberRole.Predict` and results declared `MemberRole.Validate`. That costs:

- **History.** Every client keeps `SystemManager.PredictionHistoryTicks` of history for a predicted member, or `SystemManager.DefaultPredictionHistoryTicks` (64) when that is unset. A member sent on a slower interval than the tick rate keeps more.
- **Bandwidth and replays.** A matching result costs a little upstream bandwidth each tick, more while **Send Result Values** (`SystemManager.IsResultValueSendEnabled`) is on. A result the server finds different makes the client re-run `OnEarlyFixedUpdate` and `OnLateFixedUpdate` as `SimulationType.Replayed` for every tick since, about a round trip plus the state interpolation in ticks, all in one frame. Physics replays too, so a `ValidatedRigidbody` can be predicted; see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md).
- **Code that tolerates being re-run.** Anything a replayed tick does happens again. The engine refuses remote calls, messages, predicted spawns, collection and reference writes and `NetworkAnimator` triggers during a replay, but not your own side effects, such as awarding score or writing a static. Gate those on `SimulationType.Forward`, or keep the member that drives them unpredicted. A value that only feeds a display, such as a camera or a resource bar, is safe: at worst the display corrects itself.

## Use a cheaper option when you can

Most objects need none of this:

- **An uncontrolled object with interpolation.** No history, no result check, no replay. The receiver animates between the values it receives, paced by **State Interpolation** (`SystemManager.StateInterpolation`, at most `MaximumStateInterpolation`). This is the default for anything nobody drives.
- **A controller-written value with no prediction.** The controller writes the member every tick, but its role stays `MemberRole.Replicate`, so the controller sees its own writes a round trip late, with no replay.
- **A purely local visual.** Particles, camera shake and UI feedback that only need to look right on one machine are not a `NetworkMember<T0>` at all, and cost nothing on the wire.

## Choose prediction per member

`role` is set per member, and nothing is predicted by default. A component can predict its position while leaving health or ammo as `MemberRole.Replicate`.

The `ValidatedJump` demo under `Demos/Prediction` declares the walk direction and jump press as `MemberRole.Predict` and every movement result as `MemberRole.Validate`. The validated behaviours, such as `ValidatedRigidbody` and `ValidatedTransform`, carry ready-made `Validate` members for a body, transform or character controller, and the `BallRacer` demo under `Demos/Tutorials` predicts a `Rigidbody` with one.

Predicted members and replays are in every build. Predicted spawning, predicted despawn and spawn compensation are Pro only.
