---
title: "When prediction is worth its cost"
---

## What prediction actually buys

Prediction removes one thing: the wait for a round trip before the controller sees the result of its own input. Without it, a client presses a key, sends the input, and only moves once the server's outcome comes back. With it, the client applies the input locally the moment it happens and the server's outcome arrives later to confirm or correct that guess.

That is the entire benefit. Prediction does not make an object more accurate, more responsive to other peers, or cheaper to replicate. It only hides the round trip from the one peer driving the object.

## What it costs

Turning prediction on for a `NetworkMember<T0>` is one constructor argument:

```csharp
public NetworkMember(CompressionLevel deltaCompressionLevel = CompressionLevel.Tight, bool isAutomaticPoolingEnabled = false, bool isPredicted = false, float accuracy = float.NaN, float interpolationSnapThreshold = float.NaN, SendInterval sendInterval = SendInterval.Normal, TransmissionMode transmissionMode = TransmissionMode.Interval, PathContinuation pathContinuation = PathContinuation.Implied)
```

`isPredicted: true` does three things, and each one is a real cost:

- **A history ring, not just a live value.** A predicted member's ring depth is sized to cover the round trip: it adopts `SystemManager.PredictionHistoryTicks` when that is configured wider than the member's own default depth (two slots), because the compare gate has to still be able to address the tick a server outcome echoes back. A member served on a wider interval than the tick rate widens its own ring further, since the gap between its writes has to fit in the ring too. None of this is allocated for an unpredicted member.
- **A replay whenever the compare gate misses.** On every inbound server outcome, the predicted member's ring value is compared against what actually arrived. A match costs nothing further. A miss rewinds the member to the corrected tick and fires `NetworkSystem.ReconcileRequired`, which hands back the tick to replay forward from. Game code that subscribes to it calls `BeginReplayTick(tick)`, re-runs its own simulation for each re-simulated tick so state member writes land in that tick's ring slot instead of stomping the live head, then calls `EndReplayTick()` once it's caught back up to the present.
- **Game code that tolerates being re-run.** Anything that happens during a replayed tick happens again, for every tick between the rewind point and the present. That is fine for a physics step or a movement integration; it recomputes the same answer. It is not fine for a side effect that cannot be undone or repeated safely.

## The cheaper alternatives

Most objects do not need any of this. In order of cost:

- **An uncontrolled object with interpolation.** No controller, no ring beyond the ordinary two slots, no compare gate, no replay. The receiver just animates between the values it receives, paced by `SystemManager.StateInterpolation` (0 by default, capped at `MaximumStateInterpolation`). This is the default for anything nobody is driving.
- **A controller-written value with no prediction.** The controller still writes the member every tick, but `isPredicted` stays `false`. The controller sees its own writes with the same round-trip delay as everyone else; no local guess, no rewind, no replay. Cheaper than prediction, more responsive than a purely server-driven value the controller doesn't write at all.
- **A purely local visual that is never replicated.** Not a `NetworkMember<T0>` at all. Particle effects, camera shake, UI feedback — anything that only needs to look right on the machine that triggered it costs nothing on the wire and needs no reconciliation, because there is nothing to reconcile.

## The rule that disqualifies a candidate

If the value only ever needs prediction because something *reads* it (a position feeding a camera, a resource bar), the reconcile replay problem is contained: worst case, the display corrects itself. Prediction turns dangerous the moment the tick being replayed can trigger a side effect the replay can't take back — spawning an object, awarding score, firing an RPC. A replay that fires the same RPC or spawns the same object again on every re-simulated tick corrupts state in a way no reconcile can undo. Keep side-effecting logic out of anything that lives inside a `ReconcileRequired` replay, or keep the member driving it unpredicted.

## Why most of a world has nothing to predict

Prediction only matters to the peer that controls the object, because it's the only peer waiting on its own round trip. `NetworkMember<T0>` checks this directly: a predicted member skips its own upstream serialization when the local peer is a pure client controller (`NetworkSystem.IsController(ControllerType.Client)` and not server-started), because its value is driven by local input and read out through the compare gate rather than sent. An object nobody controls has no local guess to make in the first place — there's no round trip to hide, because there's no input driving it locally. Most objects in a networked world fall into that category: static geometry, background actors, anything the server alone moves. That's the uncontrolled-plus-interpolation case above, and it's the default, not the exception.

## The choice is per member

`isPredicted` is a per-`NetworkMember<T0>` constructor argument, not a project setting or even a per-object one. A single component can predict its transform while leaving its health, ammo count, or any other member unpredicted — each one is its own opt-in. As of this writing, no shipped component in the codebase passes `isPredicted: true`; the only members that do live in the test tree (`Nucleus.Tests/Components/Testing/PredictedStateComponent.cs`, `InterpolationStateComponent.cs`). Prediction is available, per member, wherever the compare-gate-and-replay cost is worth paying — it just isn't turned on anywhere by default.

## What's Pro

Predicted members, their inputs, and the reconcile replay described above are available in every build. Predicted *spawning*, predicted *despawn*, and spawn compensation are Pro-only — `NetworkSystem.PredictedSpawn.Pro.cs`, `SystemManager.PredictedSpawn.Pro.cs`, `NetworkSystem.SpawnCompensation.Pro.cs`, and `SystemManager.SpawnCompensation.Pro.cs` don't exist in a Free build. Predicting an object's motion or state costs nothing extra to license; predicting the moment an object comes into or out of existence does.
