---
title: "When prediction is worth its cost"
---

## What prediction actually buys

Prediction removes one thing: the wait for a round trip before the controller sees the result of its own client state. Without it, a client presses a key, sends the resulting client state, and only moves once the server's outcome comes back. With it, the client applies that client state locally straight away and the server's outcome arrives later to confirm or correct that guess.

That is the entire benefit. Prediction does not make an object more accurate, more responsive to other peers, or cheaper to replicate. It only hides the round trip from the one peer driving the object.

## Prediction costs bandwidth, memory and replay time

Turning prediction on for a `NetworkMember<T0>` is one constructor argument, its role:

```csharp
public NetworkMember(CompressionLevel deltaCompressionLevel = CompressionLevel.Tight, bool isAutomaticPoolingEnabled = false, MemberRole role = MemberRole.Replicate, float accuracy = float.NaN, float interpolationSnapThreshold = float.NaN, SendInterval sendInterval = SendInterval.Normal, TransmissionMode transmissionMode = TransmissionMode.Interval, bool isExtrapolationEnabled = true, byte correctionSmoothingTicks = 0, bool isCarriedForward = true, float resultTolerance = 0f)
```

A result declared `MemberRole.Validate`, computed from client state declared `MemberRole.Predict`, is predicted by the controller and checked by the server. That does three things, and each one is a real cost:

- **A history, not just a live value.** A predicted member keeps a history deep enough to cover the round trip, so a reconcile can restore the member to a past tick and a replay can read each past tick's client state. Every client keeps `SystemManager.PredictionHistoryTicks` of it, or `SystemManager.DefaultPredictionHistoryTicks` (64) when that is unset, and a member served on a wider interval than the tick rate keeps more. An unpredicted member keeps only its current and previous values.
- **A replay whenever a prediction misses.** A matching result costs nothing beyond its hash on the upstream client state, plus the result values beside it while `SystemManager.IsResultValueSendEnabled` is on (the default, so the server can name what differed; turn it off to keep the hash alone). A result the server finds different orders a reconcile, which restores every system the client predicts to the server's values as of the wrong tick, and the engine re-runs the fixed updates (`OnEarlyFixedUpdate` and `OnLateFixedUpdate`, as `SimulationType.Replayed`) for every tick from there to the present. A replay covers about a round trip plus the state interpolation in ticks, all simulated in one frame.
- **Game code that tolerates being re-run.** Anything that happens during a replayed tick happens again, for every tick between the rewind point and the present. That is fine for a movement integration; it recomputes the same answer. It is not fine for a side effect that cannot be undone or repeated safely, so effects belong on `SimulationType.Forward` only. The engine refuses the worst offenders while a replayed tick runs: remote calls, messages, predicted spawns, collection and reference writes and `NetworkAnimator` triggers. The core steps no physics itself: an integration steps its physics world on `SystemManager.ReplayEarlyFixedUpdated`, which the Unity integration does, and the Unity `ValidatedRigidbody` predicts a body that way.

## The cheaper alternatives

Most objects do not need any of this. In order of cost:

- **An uncontrolled object with interpolation.** No controller, no history beyond the current and previous values, no result check, no replay. The receiver just animates between the values it receives, paced by `SystemManager.StateInterpolation` (0 by default, capped at `MaximumStateInterpolation`). This is the default for anything nobody is driving.
- **A controller-written value with no prediction.** The controller still writes the member every tick, but its role stays `MemberRole.Replicate`. The controller sees its own writes with the same round-trip delay as everyone else; no local guess, no rewind, no replay. Cheaper than prediction, more responsive than a purely server-driven value the controller doesn't write at all.
- **A purely local visual that is never replicated.** Not a `NetworkMember<T0>` at all. Particle effects, camera shake, UI feedback: anything that only needs to look right on the machine that triggered it costs nothing on the wire and needs no reconciliation, because there is nothing to reconcile.

## The rule that disqualifies a candidate

If the value only ever needs prediction because something *reads* it (a position feeding a camera, a resource bar), the reconcile replay problem is contained: worst case, the display corrects itself. Prediction turns dangerous the moment the tick being replayed can trigger a side effect the replay can't take back: spawning an object, awarding score, firing an RPC. The engine refuses remote calls, messages and predicted spawns during a replay, but it cannot know about your own side effects: awarding score or writing to a static from a replayed tick happens again on every replay. Gate side effects on `SimulationType.Forward`, or keep the member driving them unpredicted.

## Why most of a world has nothing to predict

Prediction only matters to the peer that controls the object, because it's the only peer waiting on its own round trip. An object nobody controls has no local guess to make in the first place: there's no round trip to hide, because there's no client state driving it locally. Most objects in a networked world fall into that category: static geometry, background actors, anything the server alone moves. That's the uncontrolled-plus-interpolation case above, and it's the default, not the exception.

## The choice is per member

`role` is a per-`NetworkMember<T0>` constructor argument, not a project setting or even a per-object one. A single component can predict its position while leaving its health, ammo count, or any other member as ordinary `MemberRole.Replicate`; each one is its own opt-in. Nothing turns prediction on by default. The Unity demo ValidatedJump shows it, with the walk direction and jump press of `ValidatedJumpMovementComponent` as `MemberRole.Predict` client state and every movement result as `MemberRole.Validate`. In Unity, the validated behaviours, such as `ValidatedRigidbody` and `ValidatedTransform`, carry ready-made `MemberRole.Validate` members for a body, transform or character controller, and the BallRacer demo predicts a `Rigidbody` with one.

## Predicted spawning is Pro, predicted motion is not

Predicted members, the client state that drives them, and the reconcile replay described above are available in every build. Predicted *spawning*, predicted *despawn*, and spawn compensation are Pro-only and don't exist in a Free build. Predicting an object's motion or state costs nothing extra to license; predicting the moment an object comes into or out of existence does.
