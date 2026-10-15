---
title: "Reconciliation and replay"
---

> **Using Unity?** See [Replaying a correction in Unity](../../unity/control/reconcile-in-unity.md).

A predicted member can diverge from the server: the client's prediction and the server's outcome disagree beyond the member's accuracy, the client's history no longer reaches the tick the server echoes, or the server orders a correction. Reconciliation is what the engine does next: it restores the client's world to the server's values as of one tick, replays every tick since then through the same fixed updates that produced them, and reports what was wrong and what changed. A game writes the simulation once; it does not write the replay.

## One reconcile, in order

1. **Detect, on `LateStateUpdate`.** While the inbound packets apply, the [compare gate](./prediction-history-and-predicted-members.md#the-compare-gate) records each member that did not confirm, with the echoed tick and a `MismatchCause`, instead of rewinding it on the spot. At the end of the packet that recorded the earliest tick, every predicted member of every system captures the value the server last sent as the restore base, so remote calls and `LateStateUpdate` callbacks that run before the `Reconcile` step cannot move it.
2. **Restore, at the head of the `Reconcile` step,** ahead of its callbacks. One start tick is chosen for the whole world: the earliest tick any member recorded. Every predicted member of every system this client predicts is set to its captured server value, its later history is cleared, and its value before the restore is kept as its pre-rewind value. A member the server has sent nothing for yet keeps its own history, rewound to the same tick. Systems this client does not control are held at their captured values. `ReplayReport` is filled with the members whose restored value differs from what this client held for the start tick.
3. **`ReconcileRequired`** is raised with the start tick on each restored system, in system Id order.
4. **Replay.** `ReplayStarting` is raised on every system the replay covers. Then, for each tick from the start tick plus one to the live tick minus one, every restored system runs its early fixed update and then its late one as `SimulationType.Replayed`, in system Id order.
5. **Report the effect.** Held systems return to their latest values. Each predicted member whose present the replay moved away from its pre-rewind value is added to `ReplayReport.Corrections` and raises `OnMembersChanged` with `MemberChangeDirection.Correction`. Then `ReplayCompleted` is raised on every system that raised `ReplayStarting`.
6. **Continue, on `EarlyFixedUpdate`.** The live tick runs the fixed updates as `SimulationType.Forward` from the corrected state.

A reconcile covers the whole world, once per inbound pass. Two members of one system, or two systems this client controls, that diverge in the same pass are restored to the same tick and replayed together, so one divergence costs one replay.

## Writing the simulation

The engine replays the fixed updates of a system something simulates: a component that overrides one of them, or a callback registered with `NetworkSystem.RegisterSimulationCallback`:

```csharp
// On NetworkComponent:
protected virtual void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationType simulationType) { }
protected virtual void OnLateFixedUpdate(StepDelta stepDelta, SimulationType simulationType) { }

// Or registered per system:
public interface INetworkSimulationCallback
{
    void OnSimulationStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta, SimulationType simulationType);
}
```

Within a system, components run first in component order, then the registered callbacks in registration order. A raw `INetworkLoopStepCallback` keeps running once per loop tick and is never replayed.

| Peer | System | How the fixed updates run |
| --- | --- | --- |
| Server or host | Driven by a remote client through client state | `Forward`, once per server tick on one of the client's ticks, after `TryValidateState`, or as a step missing its client state when that tick's did not arrive |
| Server or host | Controlled by the server, or by the host's own client half | `Forward`, once per tick |
| Controlling client | Its own system | `Forward` once per live tick, and `Replayed` once per tick a reconcile replays |
| Observing client with `IsObserverPredictionEnabled` | Another client's system | As the controlling client |
| Any other client | A system it does not control | `None`, once per loop tick; nothing is simulated |

`StepDelta.Tick` names the tick being simulated. A replayed step, and the server's step for a tick of a client's client state, is not a real frame, so its `Delta`, `FixedDelta` and `NormalizedDelta` are one tick interval and `TimeSinceLastFixedUpdate` is 0.

```csharp
public partial class MoverComponent : NetworkComponent
{
    public readonly NetworkMember<Vector3> Position = new(predictionMode: PredictionMode.Compare, correctionSmoothingTicks: 6);

    protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationType simulationType)
    {
        // A client watching a system it does not control: nothing to simulate.
        if (simulationType is SimulationType.None || !NetworkSystem.TryGetClientStateComponent(out MoveClientStateComponent clientState))
            return;

        // The server's step for a tick whose client state never arrived: carry the last tick's instead of the defaults.
        if (stepDelta.IsClientStateMissing)
            clientState.TryGetLastState(isEveryMemberCarried: false);

        // The live tick, the server's run of each client tick, and every replayed tick all compute here.
        Position.Value = MoverRules.Step(Position.Value, clientState.Direction, CoreManager.NetworkLoopManager.TickRate);
    }
}
```

The controller writes the client state for the live tick (here `clientState.Direction`) before the step reads it, on the live tick only; a replay reads the client state it recorded. Step by the fixed tick, never by frame time, so every pass of a tick computes the same value.

## What a replayed tick sees

- Predicted members write the replayed tick's slot, and each replayed tick becomes the member's newest, so `Value` reads the last tick replayed and the next live write lands after it.
- Client state members read the client state recorded for the replayed tick.
- Members that are not predicted keep their live value; writes to them land on the live value.
- Systems this client does not control read the server values that arrived with the start tick, unless the [hold radius](#holding-only-the-systems-near-a-replay) leaves them out.
- No physics step runs between the early and late fixed update, so movement that must replay cannot wait on one.

`NetworkLoopManager.SimulationType` is the pass running now (`None` outside a simulate step), mirrored as `NetworkSystem.SimulationType`. `NetworkLoopManager.ReplayTick` is the replayed tick during a replay and `NetworkLoopManager.UnsetTick` otherwise, and `SimulationTick` is the replayed tick during a replay and `Tick`, which stays the live tick throughout, otherwise. `NetworkSystem.IsPredicting` is true on the clients that replay a system: its controller, or an observer predicting it, while it has a predicted member.

## Calls refused during a replay

A replay re-runs every tick since the start tick, so anything with an effect outside the simulation would happen again. While a replayed tick runs, the engine refuses these calls, logging once per kind of call:

- `TrySendRpc` returns false, and `Connection.SendMessage<T0>` sends nothing.
- `EnsureStartPredictedSystem` and `EnsureStopPredictedSystem` refuse with `PredictedSpawnRefusal.Replaying`.
- Writes to collection members and reference members change nothing.
- `NetworkAnimator.SetTrigger`, `ResetTrigger`, `CrossFade` and `Play` do nothing.

Play one-shot effects (sounds, particles, an RPC to the server) on `SimulationType.Forward` only.

## What the reconcile reports

```csharp
public event ReplayStartingHandler? ReplayStarting;
public event ReplayCompletedHandler? ReplayCompleted;
public delegate void ReplayStartingHandler(ReplayReport replayReport);
public delegate void ReplayCompletedHandler(ReplayReport replayReport);

public ReplayReport ReplayReport { get; }
```

`NetworkSystem.ReplayReport` describes the latest reconcile on the system. It is one instance per system, reused by every reconcile, so read it while the reconcile it describes is current:

| Member | Meaning |
| --- | --- |
| `StartTick` | The tick the world was restored to. The replay re-runs the ticks after it. |
| `EndTick` | The last tick the replay re-runs: the live tick less one. |
| `IsReplaySkipped` | True when the replay would have run longer than `SystemManager.MaximumReplayTicks`, so the server's values stand at `StartTick` without one. |
| `Mismatches` | The cause: each `PredictionMismatch` (`Member`, `MemberName`, `Cause`) whose value at `StartTick` differed from this client's. Empty on a system restored only because another one diverged. |
| `Corrections` | The effect: each `MemberCorrection` (`Member`, `MemberName`) whose present the replay moved. Filled before `ReplayCompleted`. |

`MismatchCause` is `ValueDiffered` (the server's value differed), `HistoryMissing` (the history no longer reached the tick), `Resync` (a prime or loss-recovery full whose values differed) or `ServerOrdered` (a reconcile the server sent). A held system's report names the start tick and lists no mismatches.

Inside a handler, `NetworkMember<T0>.TryGetMismatchValues(out predictedValue, out serverValue)` gives both values at the start tick and `TryGetPreRewindValue(out value)` gives the value that was on screen, both until the next tick advance. A correction reaches components through `OnMembersChanged`, so a replay that took back a jump can cancel its effects:

```csharp
public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
{
    if (memberChangeDirection != MemberChangeDirection.Correction)
        return;

    if ((memberFlags & (ulong)MovementComponentFlags.JumpCount) != 0 && JumpCount.TryGetPreRewindValue(out ushort shownJumpCount) && JumpCount.Value < shownJumpCount)
        CancelJumpEffects();
}
```

On the controlling client each system also counts `ReconcileCount`, `ReplayedTickCount` and `LastReplayTickCount` since it was rented, and `GetMismatchCount(MismatchCause)` per cause. All of them stay at zero while predictions agree.

## Smoothing a correction

Construct a member with `correctionSmoothingTicks` to have its `InterpolatedValue` glide from the pre-rewind value to the corrected one over that many presented ticks, while `Value` is correct at once:

```csharp
public readonly NetworkMember<Vector3> Position = new(predictionMode: PredictionMode.Compare, correctionSmoothingTicks: 6);
```

0, the default, shows the correction at once.

## Limiting how long a replay runs

```csharp
coreManager.SystemManager.MaximumReplayTicks = 30;
```

A reconcile whose replay would run longer lands the server's values at the start tick without replaying, and its report sets `IsReplaySkipped`. `SystemManager.UnsetMaximumReplayTicks` (0), the default, sets no limit.

## Systems this client does not control

A system controlled by the server or by another client takes its values from the server, which are the truth, and is never compared or simulated on this client. It still takes part in a reconcile: the client only knows it up to the start tick, so from the restore its predicted members read the server values that arrived with the start tick, and the controlled systems replay against it there. It raises `ReplayStarting` and `ReplayCompleted` with the replayed systems, so whatever shows it can be placed where the replay sees it and put back. Before `ReplayCompleted` it returns to its latest values, so a replay leaves no net change on it.

## Holding only the systems near a replay

Systems the client does not control are held at the start tick while the ones it controls replay. In a crowded scene, set a radius so only those near a restored system are held:

```csharp
coreManager.SystemManager.ReplayHoldRadius = 20f;
```

Distances are read through the interest position reader (`InterestManager.SetPositionReader`). A system whose position cannot be read is always held, and the rest keep their latest values and raise no replay events. `SystemManager.UnsetReplayHoldRadius`, the default, holds every system, and so does a build without distance interest.

## Predicting another client's object

A client can predict a system another client controls instead of holding it, opted in per system on that client:

```csharp
observedSystem.IsObserverPredictionEnabled = true;
```

Its fixed updates then run as `SimulationType.Forward` on every live tick, from the client state the server forwards, which lands on the local tick its packet's echo names. On a live tick that client state has not arrived yet, so the step says `StepDelta.IsClientStateMissing` and the game carries the last client state forward with `TryGetLastState`, exactly as the server does. The server's outcomes are compared with the prediction at the observer's echo, and a reconcile restores and replays the system with the ones the observer controls. Nothing new travels. The component must leave `ForwardingEnabled` on, and the observer needs an echo of its own, so it must control a system that sends client state.

## Replaying from ReconcileRequired yourself

`ReconcileRequired` stays as the low-level hook, for a game that drives its own replay:

```csharp
public delegate void ReconcileRequiredHandler(uint rewoundTick);

public event ReconcileRequiredHandler? ReconcileRequired;
```

It is raised at the head of the `Reconcile` step, after the restore, on each restored system in system Id order. `rewoundTick` is the start tick: the server's value there already includes that tick's client state, so replay from the tick after it. It is `NetworkLoopManager.UnsetTick` when the correction was a snap with no replay target, a reconcile the server sent that landed with no echo of the processed client state tick. A server correction of the controller's client state alone does not raise it; that raises `NetworkClientStateComponent.ClientStateCorrected` instead.

When something on the system overrides a fixed update or registers a simulation callback, the engine replays it after `ReconcileRequired`, and a subscriber should not replay it a second time. A system nothing simulates is left to the subscriber. Replay it on the `Reconcile` step (an `INetworkLoopStepCallback` returning `NetworkLoopSteps.Reconcile`), bracketing every past tick in tick order:

```csharp
public void BeginReplayTick(uint tick);
public void EndReplayTick();
```

`BeginReplayTick(tick)` opens a replay of that tick: predicted members write its slot, client state members read its client state, and `NetworkLoopManager.SimulationType` reads `Replayed`, so the refusals above apply. `EndReplayTick()` returns writes and reads to the live tick. A write to a predicted member outside the bracket lands on the live value and breaks the next comparison. Re-simulate the ticks from `rewoundTick + 1` up to the tick before the current one this way, then apply the current tick's values normally. Systems held for the reconcile stay held until the `Reconcile` step's callbacks have run.

## SendReconcile

`SendReconcile(Connection)` is the server side of a forced, full-state correction: the server pushes a system's complete current state to one connection outright, rather than waiting for the controller's own prediction to drift out of tolerance. The correction is queued and sent to that connection at the end of the tick.

```csharp
public void SendReconcile(Connection connection);
```

Only the server can call it; a client attempting to reconcile a system is refused with a logged error, and nothing is queued. A reconcile is the one kind of correction that must never travel upstream, since accepting one from a client would let it overwrite any system on the server outright.

A server reaches for this when a gameplay event invalidates a controller's prediction in a way the ordinary compare would not catch: a teleport, a respawn, an out-of-band state change the client could not have predicted from its own client state. The engine also sends one itself for a `Validate` result that differs and when it re-anchors a client that stalled. The reconcile carries the client state the server applied for its tick, after `TryValidateState`, and the controller writes it into its history at that tick, raising `ClientStateCorrected` when it differs from its own. On arrival it is recorded as `MismatchCause.ServerOrdered` and restores and replays like any other reconcile.

## Validate results the server found different

For `PredictionMode.Validate` members the server compares a hash of the controller's result. When one differs it queues the correcting reconcile and raises `NetworkSystem.ResultMismatched` with a `ResultMismatchReport`: the controller's `Connection`, the `Tick` and, when the controller sent its values beside the hash, the `Members` that differed. Each of those answers `TryGetResultMismatchValues(out controllerValue, out serverValue)` until the tick advances. The controller sends the values while its `SystemManager.IsResultValueSendEnabled` is set, the default; turn it off in a release build to keep the hash alone. No violation is raised, so what to do about the client is the game's call.

## See also

Physics convergence followers can hide the visual jump a rewind produces — see the Physics documentation for how a follower interpolates toward the corrected pose instead of snapping to it.
