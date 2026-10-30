---
title: "Reconciliation and replay"
---

> **Using Unity?** See [Replaying a correction in Unity](../../unity/control/reconcile-in-unity.md).

A predicted member can diverge from the server: the server simulates a tick of the controller's client state, finds the controller's result different from its own, and orders a correction. The server also orders one itself when it re-anchors a stalled client, and when game code calls `SendReconcile`. Reconciliation is what the engine does next: it restores the client's world to the server's values as of one tick, replays every tick since then through the same fixed updates that produced them, and reports what was wrong and what changed. A game writes the simulation once; it does not write the replay.

## One reconcile, in order

1. **Detect, on `LateStateUpdate`.** While the inbound packets apply, a reconcile the server ordered is recorded against the echoed client state tick as `MismatchCause.ServerOrdered`, instead of rewinding on the spot. An observer predicting a system records its own [compare](./prediction-history-and-predicted-members.md#an-observer-that-predicts-compares-for-itself) the same way. Once the earliest tick is recorded, every predicted member of every system captures the value the server last sent as the restore base, so remote calls and `LateStateUpdate` callbacks that run before the `Reconcile` step cannot move it.
2. **Restore, at the head of the `Reconcile` step,** ahead of its callbacks. One start tick is chosen for the whole world: the earliest tick any member recorded. Every predicted member of every system this client predicts is set to its captured server value, its later history is cleared, and its value before the restore is kept as its pre-rewind value. A member the server has sent nothing for yet keeps its own history, rewound to the same tick. Systems this client does not control are held at their captured values. `ReplayReport` is filled with the members whose restored value differs from what this client held for the start tick.
3. **`ReconcileRequired`** is raised with the start tick on each restored system, in system Id order.
4. **Replay.** `ReplayStarting` is raised on every system the replay covers. Then, for each tick from the start tick plus one to the live tick minus one, every restored system runs its early fixed update and then its late one as `SimulationType.Replayed`, in system Id order.
5. **Report the effect.** Held systems return to their latest values. Each predicted member whose present the replay moved away from its pre-rewind value is added to `ReplayReport.Corrections` and raises `OnMembersChanged` with `MemberChangeDirection.Correction`. Then `ReplayCompleted` is raised on every system that raised `ReplayStarting`.
6. **Continue, on `EarlyFixedUpdate`.** The live tick runs the fixed updates as `SimulationType.Forward` from the corrected state.

A reconcile covers the whole world, once per inbound pass. Two members of one system, or two systems this client controls, that diverge in the same pass are restored to the same tick and replayed together, so one divergence costs one replay.

## The fixed updates the engine replays

The engine replays the fixed updates of a system something simulates: a component that overrides one of them, or a callback registered with `NetworkSystem.RegisterSimulationCallback`:

```csharp
// On NetworkComponent:
protected virtual void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext) { }
protected virtual void OnLateFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext) { }

// Or registered per system with NetworkSystem.RegisterSimulationCallback:
public interface INetworkSimulationCallback
{
    void OnSimulationStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta, SimulationContext simulationContext);
}
```

Within a system, components run first in component order, then the registered callbacks in registration order. `UnregisterSimulationCallback` removes a callback. A raw `INetworkLoopStepCallback` keeps running once per loop tick and is never replayed.

| Peer | System | How the fixed updates run |
| --- | --- | --- |
| Server or host | Driven by a remote client through client state | `Forward`, once per server tick on one of the client's ticks, after its client state is validated, or as a step missing its client state when that tick's did not arrive |
| Server or host | Controlled by the server, by the host's own client half, or by a client that sends no client state | `Forward`, once per tick |
| Controlling client | Its own system | `Forward` once per live tick, and `Replayed` once per tick a reconcile replays |
| Observing client with `IsObserverPredictionEnabled` | Another client's system | As the controlling client |
| Any other client | A system it does not control | `None`, once per loop tick; nothing is simulated |

`NetworkSystem.IsSimulatedPerClientState` is true on the server for a system run on its client's ticks. A replayed step, and the server's step for a tick of a client's client state, is not a real frame, so its `Delta`, `FixedDelta` and `NormalizedDelta` are one tick interval and `TimeSinceLastFixedUpdate` is 0.

## The simulation context

Each fixed update receives a `SimulationContext`, a read-only struct describing the step:

| Field | Meaning |
| --- | --- |
| `Type` | The pass the step belongs to: `SimulationType.Forward` the first time a tick is simulated, `Replayed` for a past tick simulated again during a reconcile, `None` on a peer that does not simulate the system. |
| `RemoteTick` | The opposite end's tick the step pairs with. On the server, for a system a client drives, the controller's tick whose client state is being simulated. On a client, the server tick of the state it applied. `NetworkLoopManager.UnsetTick` when there is none: on the server for a system no client drives, and on a client before any state has arrived. |
| `IsRemoteTickEstimated` | True when `RemoteTick` was inferred rather than arriving with the data: on the server for a client tick whose client state did not arrive, where it is the tick the server assumed, and on a client for a tick no state was applied on, every replayed tick included, where it is the newest server tick applied carried on one tick per local tick. |

Time everything by `StepDelta.Tick`, the local tick being simulated. On the server that is the server's own tick even for a step that runs one of the client's ticks. `RemoteTick` is the other end's numbering, and on the server it is a number the client chose: use it to pair what the server did with what the client logged, never for a cooldown, a timeout or any other timing.

```csharp
protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
{
    if (simulationContext.Type is not SimulationType.Forward || !CoreManager.TransportManager.IsServerStarted)
        return;

    // Pair the server's step with the client's tick in a log line; time anything by stepDelta.Tick.
    if (stepDelta.IsClientStateMissing)
        System.Console.WriteLine($"Server tick {stepDelta.Tick} ran client tick {simulationContext.RemoteTick} without its client state.");
}
```

## Writing the simulation

```csharp
using System.Numerics;
using Nucleus.Components;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;

public partial class MoverComponent : NetworkComponent
{
    // Client state: what the player asked for this tick.
    public readonly NetworkMember<Vector2> Direction = new(role: MemberRole.Predict);
    // The result the controller predicts and the server checks.
    public readonly NetworkMember<Vector3> Position = new(role: MemberRole.Validate, accuracy: 0.01f, correctionSmoothingTicks: 6);

    // Set by the game from the device on the controlling client.
    public Vector2 IntendedDirection;

    private const float Speed = 5f;

    protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
    {
        // A client watching a system it does not control: nothing to simulate.
        if (simulationContext.Type is SimulationType.None)
            return;

        // The controlling peer's live tick: this becomes the tick's client state. A replay reads the recorded client state instead.
        if (simulationContext.Type is SimulationType.Forward && NetworkSystem.IsController(ControllerType.AnyController))
            Direction.Value = IntendedDirection;

        // The server's step for a tick whose client state never arrived: carry the last tick's instead of the defaults.
        if (stepDelta.IsClientStateMissing)
            TryGetLastState(isEveryMemberCarried: true);

        // The live tick, the server's run of each client tick, and every replayed tick all compute here.
        Position.Value += new Vector3(Direction.Value.X, 0f, Direction.Value.Y) * (Speed / CoreManager.NetworkLoopManager.TickRate);
    }
}
```

The controller writes the client state for the live tick before the step reads it, on the live tick only; every other pass reads the `Predict` member, which a replay points at the tick it replays. Step by the fixed tick, never by frame time, so every pass of a tick computes the same value.

## What a replayed tick sees

- `Validate` members write the replayed tick's value, and each replayed tick becomes the member's newest, so `Value` reads the last tick replayed and the next live write lands after it.
- `Predict` members read the client state recorded for the replayed tick.
- `State` members keep their live value; writes to them land on the live value.
- Systems this client does not control read the server values that arrived with the start tick, unless the [hold radius](#holding-only-the-systems-near-a-replay) leaves them out.
- The core steps no physics itself. `SystemManager.ReplayEarlyFixedUpdated` is raised between the early and late fixed update of each replayed tick, so an integration can step its physics world there; the Unity integration does, so a body predicted through its `ValidatedRigidbody` replays.

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

`MismatchCause` is `ValueDiffered` (the server's value differed), `HistoryMissing` (the history no longer reached the tick), `Resync` (the first values received, or a resend after loss, that differed) or `ServerOrdered` (a reconcile the server sent). A held system's report names the start tick and lists no mismatches.

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
public readonly NetworkMember<Vector3> Position = new(role: MemberRole.Validate, accuracy: 0.01f, correctionSmoothingTicks: 6);
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

Its fixed updates then run as `SimulationType.Forward` on every live tick, from the client state the server forwards, which lands on the local tick the server's echo names. On a live tick that client state has not arrived yet, so the step says `StepDelta.IsClientStateMissing` and the game carries the last client state forward with `TryGetLastState`, exactly as the server does. The observer compares the server's values for the `Validate` members with its prediction at its own echo, since the server checks only the controller's result, and a reconcile restores and replays the system with the ones the observer controls. Nothing new travels. The observer needs an echo of its own, so it must control a system that sends client state: one with `MemberRole.Predict` members. An observer controlling nothing of the kind gets no echo, and the server's values land on it directly.

## Replaying from ReconcileRequired yourself

`ReconcileRequired` stays as the low-level hook, for a game that drives its own replay:

```csharp
public delegate void ReconcileRequiredHandler(uint rewoundTick);

public event ReconcileRequiredHandler? ReconcileRequired;
```

It is raised at the head of the `Reconcile` step, after the restore, on each restored system in system Id order. `rewoundTick` is the start tick: the server's value there already includes that tick's client state, so replay from the tick after it. It is `NetworkLoopManager.UnsetTick` when the correction was a snap with no replay target, a reconcile the server sent that landed with no echo of the processed client state tick. A server correction of the controller's client state alone does not raise it: a `Predict` value the server changed lands in that tick's history and raises `OnMembersChanged` with `MemberChangeDirection.Correction` instead.

When something on the system overrides a fixed update or registers a simulation callback, the engine replays it after `ReconcileRequired`, and a subscriber should not replay it a second time. A system nothing simulates is left to the subscriber. Replay it on the `Reconcile` step (an `INetworkLoopStepCallback` returning `NetworkLoopSteps.Reconcile`), bracketing every past tick in tick order:

```csharp
public void BeginReplayTick(uint tick);
public void EndReplayTick();
```

`BeginReplayTick(tick)` opens a replay of that tick: `Validate` members write that tick's value, `Predict` members read its client state, and `NetworkLoopManager.SimulationType` reads `Replayed`, so the refusals above apply. `EndReplayTick()` returns writes and reads to the live tick. A write to a predicted member outside the bracket lands on the live value and breaks the next result check. Re-simulate the ticks from `rewoundTick + 1` up to the tick before the current one this way, then apply the current tick's values normally. Systems held for the reconcile stay held until the `Reconcile` step's callbacks have run.

## SendReconcile

`SendReconcile(Connection)` is the server side of a forced, full-state correction: the server pushes a system's complete current state to one connection outright, rather than waiting for the result check to find a difference. The correction is queued and sent to that connection at the end of the tick.

```csharp
public void SendReconcile(Connection connection);
```

Only the server can call it; a client attempting to reconcile a system is refused with a logged error, and nothing is queued. A reconcile is the one kind of correction that must never travel upstream, since accepting one from a client would let it overwrite any system on the server outright.

A server reaches for this when a gameplay event invalidates a controller's prediction in a way the result check would not catch: a teleport, a respawn, an out-of-band member change the client could not have predicted from its own client state. The engine also sends one itself for a `Validate` result that differs and when it re-anchors a client that stalled. The controller's `Predict` values for the start tick are replaced with the ones the server applied after validation, raising `OnMembersChanged` with `MemberChangeDirection.Correction` when they differ from its own. Asking again for the same system and connection before the flush queues nothing more. On arrival it is recorded as `MismatchCause.ServerOrdered` and restores and replays like any other reconcile.

## Validate results the server found different

For `MemberRole.Validate` members the server compares a hash of the controller's result. When one differs it queues the correcting reconcile and raises `NetworkSystem.ResultMismatched` with a `ResultMismatchReport`: the controller's `Connection`, the server's `Tick` the difference was found on, the controller's `RemoteTick` it pairs with (for matching what the client logged, never for timing) and, when the controller sent its values beside the hash, the `Members` that differed. Each of those answers `TryGetResultMismatchValues(out controllerValue, out serverValue)` until the tick advances. The controller sends the values while its `SystemManager.IsResultValueSendEnabled` is set, the default; turn it off in a release build to keep the hash alone. No violation is raised, so what to do about the client is the game's call.

The report is one instance per system, reused by every result that differs, so read it inside the handler:

```csharp
using System.Numerics;
using Nucleus.Components;
using Nucleus.Systems;

public sealed class ResultMismatchLogger
{
    // Server: subscribe once the system has started.
    public void Watch(NetworkSystem networkSystem) => networkSystem.ResultMismatched += OnResultMismatched;

    private void OnResultMismatched(ResultMismatchReport resultMismatchReport)
    {
        foreach (NetworkMemberBase networkMember in resultMismatchReport.Members)
        {
            if (networkMember is NetworkMember<Vector3> vectorMember && vectorMember.TryGetResultMismatchValues(out Vector3 controllerValue, out Vector3 serverValue))
                System.Console.WriteLine($"Client {resultMismatchReport.Connection.Id}, its tick {resultMismatchReport.RemoteTick}: {networkMember.MemberName} was {controllerValue}, server had {serverValue}.");
        }
    }
}
```

## See also

Physics convergence followers can hide the visual jump a rewind produces; see the Physics documentation for how a follower interpolates toward the corrected pose instead of snapping to it.
