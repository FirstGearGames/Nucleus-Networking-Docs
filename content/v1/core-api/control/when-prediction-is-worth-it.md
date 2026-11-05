---
title: "When prediction is worth its cost"
---

## Prediction only hides the controller's round trip

Without prediction, a client sends its client state and only sees the result once the server's outcome comes back. With it, the client applies its client state locally at once, and the server's outcome later confirms or corrects that guess.

That is the whole benefit. Prediction does not make an object more accurate, more responsive to other peers or cheaper to replicate, and it only matters to the peer driving the object. An object nobody controls has no round trip to hide, and most of a world (static geometry, background actors, anything only the server moves) is like that.

## Prediction costs memory, bandwidth and replay time

You turn it on per member with the `role` constructor argument of `NetworkMember<T0>` (see [NetworkMember](../state/network-member.md)): a result declared `MemberRole.Validate`, computed from client state declared `MemberRole.Predict`, is predicted by the controller and checked by the server. That costs:

- **A history, not just a live value.** Every client keeps `SystemManager.PredictionHistoryTicks` of history for a predicted member, or `SystemManager.DefaultPredictionHistoryTicks` (64) when that is unset, and a member served on a wider interval than the tick rate keeps more. An unpredicted member keeps only its current and previous values.
- **Upstream bandwidth and replays.** A matching result costs a little upstream bandwidth each tick, more while `SystemManager.IsResultValueSendEnabled` is on (the default, so the server can name what differed; turn it off to save that bandwidth). A result the server finds different orders a reconcile: every system the client predicts is restored to the server's values at the wrong tick, and the engine re-runs `OnEarlyFixedUpdate` and `OnLateFixedUpdate` as `SimulationType.Replayed` for every tick from there to the present. That is about a round trip plus the state interpolation in ticks, all simulated in one frame.
- **Game code that tolerates being re-run.** Anything that happens during a replayed tick happens again. A movement integration recomputes the same answer, but a side effect that cannot be undone or repeated safely belongs on `SimulationType.Forward` only. The engine refuses remote calls, messages, predicted spawns, collection and reference writes and `NetworkAnimator` triggers during a replay, but it cannot know about your own side effects: awarding score or writing to a static from a replayed tick happens again on every replay. A value that only feeds a display, such as a position feeding a camera or a resource bar, is safe: at worst the display corrects itself.

The core steps no physics itself. An integration steps its physics world on `SystemManager.ReplayEarlyFixedUpdated`, which the Unity integration does, and the Unity `ValidatedRigidbody` predicts a body that way.

## Use a cheaper option when you can

Most objects need none of this. From cheapest:

- **An uncontrolled object with interpolation.** No controller, no history beyond the current and previous values, no result check, no replay. The receiver animates between the values it receives, paced by `SystemManager.StateInterpolation` (0 by default, capped at `MaximumStateInterpolation`). This is the default for anything nobody drives.
- **A controller-written value with no prediction.** The controller writes the member every tick, but its role stays `MemberRole.Replicate`. The controller sees its own writes a round trip late like everyone else, with no rewind and no replay. This is cheaper than prediction and more responsive than a value only the server writes.
- **A purely local visual that is never replicated.** Particle effects, camera shake and UI feedback that only need to look right on the machine that triggered them are not a `NetworkMember<T0>` at all, cost nothing on the wire and need no reconciliation.

## Choose prediction per member

`role` is set per member, not per project or per object, and nothing turns prediction on by default. A component can predict its position while leaving its health or ammo count as ordinary `MemberRole.Replicate`.

The Unity demo ValidatedJump declares the walk direction and jump press of `ValidatedJumpMovementComponent` as `MemberRole.Predict` client state and every movement result as `MemberRole.Validate`. In Unity, the validated behaviours, such as `ValidatedRigidbody` and `ValidatedTransform`, carry ready-made `MemberRole.Validate` members for a body, transform or character controller, and the BallRacer demo predicts a `Rigidbody` with one.

## Predicted spawning is Pro, predicted motion is not

Predicted members, the client state that drives them and the reconcile replay are in every build. Predicted spawning, predicted despawn and spawn compensation are Pro-only and don't exist in a Free build.
