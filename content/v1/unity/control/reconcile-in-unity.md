---
title: "Replaying a correction in Unity"
---

> **Driving the core API directly?** See [Reconciliation and replay](../../core-api/control/reconciliation.md).

When a predicted member disagrees with the server, the engine restores the client's world to the server's values as of one start tick and replays every tick since then through your fixed updates. Put the simulation in `OnEarlyFixedUpdate` and the replay comes with it; there is no replay loop to write.

## Simulate in OnEarlyFixedUpdate

`NucleusBehaviourBase` (the base every `NucleusBehaviour` script inherits) runs its two fixed-update virtuals once per simulated tick of the linked system:

```csharp
protected virtual void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext) { }
protected virtual void OnLateFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext) { }
```

`simulationContext.Type` says which pass the call belongs to:

- `Forward`: the first time a tick is simulated. On the server, once per server tick on one of the client's ticks for an object a client drives through client state, otherwise once per tick; on the controlling client, once per live tick.
- `Replayed`: a past tick simulated again during a reconcile, on the controlling client (or an observer predicting the object).
- `None`: nothing is simulated, on a client watching an object it does not control. The call still comes once per loop tick.

`stepDelta.Tick` names the local tick being simulated, and a replayed step carries one tick's worth of every delta. On the server that is the server's own tick, even for a step that runs one of the client's ticks. The context also carries the other end's tick:

- `simulationContext.RemoteTick`: on the server, the controller's tick whose client state is being simulated; on a client, the server tick of the state it applied. `NetworkLoopManager.UnsetTick` when there is none.
- `simulationContext.IsRemoteTickEstimated`: true when that tick was inferred rather than received, as on the server's step for a client tick whose client state did not arrive, and on every replayed tick.

Use `RemoteTick` to pair a log line with what the other end did, never for timing: on the server it is a number the client chose. Time cooldowns and everything else by `stepDelta.Tick`.

With the client state as `MemberRole.Predict` members and the result as `MemberRole.Validate` members, the component looks like this:

```csharp
using Nucleus.Components;
using NumericsVector2 = System.Numerics.Vector2;
using NumericsVector3 = System.Numerics.Vector3;

namespace MyGame
{
    public partial class PredictedMoverComponent : NetworkComponent
    {
        // Client state: written by the controller each tick.
        public readonly NetworkMember<NumericsVector2> Direction = new(role: MemberRole.Predict);
        // Computed from client state by the server and, ahead of it, by the controlling client.
        public readonly NetworkMember<NumericsVector3> Position = new(role: MemberRole.Validate, accuracy: 0.01f, correctionSmoothingTicks: 6);
    }
}
```

Write the step once and let every pass run it:

```csharp
using Nucleus.Integrations.Unity.Serializers;
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Systems;
using UnityEngine;

namespace MyGame
{
    public class PredictedMover : NucleusBehaviour<PredictedMoverComponent>
    {
        [SerializeField] private float _speed = 5f;

        private Vector2 _frameDirection;

        private void Update()
        {
            if (Component is null)
                return;

            // Replace with your project's input system.
            if (IsController(ControllerType.AnyController))
                _frameDirection = Vector2.ClampMagnitude(new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")), 1f);

            transform.position = Component.Position.InterpolatedValue.ToUnity();
        }

        protected override void OnEarlyFixedUpdate(StepDelta stepDelta, SimulationContext simulationContext)
        {
            if (simulationContext.Type is SimulationType.None)
                return; // a client watching an object it does not control: nothing to simulate

            // Live tick on the controller: the keys become this tick's client state. A replay re-reads the recorded client state instead.
            if (simulationContext.Type is SimulationType.Forward && IsController(ControllerType.AnyController))
                Component.Direction.Value = _frameDirection.ToNative();

            // The server's step for a tick whose client state never arrived: carry the last tick's instead of the defaults.
            if (stepDelta.IsClientStateMissing)
                Component.TryGetLastState(isEveryMemberCarried: true);

            // Runs for the live tick, on the server once per server tick on one of the client's ticks, and again for every replayed tick.
            Component.Position.Value = Step(Component.Position.Value.ToUnity(), Component.Direction.Value.ToUnity()).ToNative();
        }

        private Vector3 Step(Vector3 position, Vector2 direction)
        {
            float seconds = 1f / CoreManager.NetworkLoopManager.TickRate;

            return position + new Vector3(direction.x, 0f, direction.y) * (_speed * seconds);
        }
    }
}
```

The controller sends a hash of `Position` with each tick of client state, never the value itself. The server simulates the same tick and, when its own result differs, orders a reconcile. Inside a replayed tick the `Validate` members write that tick and the `Predict` members read the client state recorded for it, so the same lines rebuild history instead of moving the live object. A `Validate` member is rounded to its `accuracy` on every write, on both peers, so both simulate from the same numbers. Step by the fixed tick (`1f / CoreManager.NetworkLoopManager.TickRate`), never `Time.deltaTime`, so every pass of a tick computes the same value. Physics steps between the early and late fixed update of every replayed tick, as it does on a live tick, so `CharacterController.Move` and the forces on a `ValidatedRigidbody` both replay. Bodies the replay does not rewind are held still while it runs; see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md).

The `ValidatedJump` demo under `Demos/Prediction` is a complete example: its movement lives in `ValidatedJumpMovementComponent.OnEarlyFixedUpdate`, and its behaviour only feeds it the keys and draws.

## Play effects once

A replay re-runs every tick since the start tick, so play one-shot effects (sounds, particles, a jump animation) only on `SimulationType.Forward`. The behaviour mirrors the loop's `SimulationType` and `IsPredicting` (true on a client that replays this object) for code outside the two fixed updates.

While a replayed tick runs, the engine refuses calls that would act twice, logging once per kind: `TrySendRpc` returns false, `Connection.SendMessage` sends nothing, predicted spawns report `PredictedSpawnRefusal.Replaying`, collection and reference writes change nothing, and `NetworkAnimator.SetTrigger`, `ResetTrigger`, `CrossFade` and `Play` do nothing.

## Place the object around a replay

The engine does not move your Transform. Override the replay hooks to put whatever shows the object at its member values, so replayed raycasts and `CharacterController.Move` calls start from the right place:

```csharp
protected override void OnReplayStarting(ReplayReport replayReport)
{
    // Controlled: the restored start. Another player's object: its pose as of the start tick.
    transform.position = Component.Position.Value.ToUnity();
}

protected override void OnReplayCompleted(ReplayReport replayReport)
{
    // Controlled: the corrected present. Another player's object: back on its latest pose.
    transform.position = Component.Position.Value.ToUnity();
}
```

They are called on a client, on every object the replay covers: each one it controls, restored to `replayReport.StartTick` and then replayed, and each one it does not control, held at the server's start-tick values for the replay and then returned to its latest values. Physics transforms are synced after each hook. A behaviour is subscribed only when its type overrides one of them.

## Read what was corrected

`replayReport.Mismatches` lists the predicted members that were wrong at the start tick, each with its `MemberName` and `Cause`, and `replayReport.Corrections` lists the members whose present the replay moved. `NetworkMember<T0>.TryGetMismatchValues` gives both values at the start tick, and `TryGetPreRewindValue` gives the value that was on screen, until the next tick advance:

```csharp
protected override void OnReplayCompleted(ReplayReport replayReport)
{
    foreach (MemberCorrection memberCorrection in replayReport.Corrections)
        Debug.Log($"[{memberCorrection.MemberName}] corrected from tick {replayReport.StartTick}.");
}
```

To glide to a correction instead of jumping, construct the member with `correctionSmoothingTicks: 6` and render `InterpolatedValue`: it eases from the value that was on screen while `Value` is already correct. For an object you place on each tick instead, draw it through a `GraphicalSmoother`; see [Smoothing a predicted object with GraphicalSmoother](./graphical-smoother.md).

## Hold a crowd, or predict other players

By default every object this client does not control is held at the start tick during a replay. Set **Replay Hold Radius** on the Unity system manager to hold only the ones near a restored object, or tick **Predicted By Observers** on a `NetworkSystemObject` to have observing clients predict and replay it instead of holding it. See [Prediction settings on the Unity manager](./prediction-settings-in-unity.md).

## Replaying from ReconcileRequired yourself

A game that must own the replay loop can still subscribe to `NetworkSystem.ReconcileRequired` and replay in `OnReconcile`, which runs every tick on the `Reconcile` step. Do this only for an object nothing simulates in `OnEarlyFixedUpdate`/`OnLateFixedUpdate`; otherwise the engine has already replayed it.

```csharp
private uint _pendingRewoundTick = NetworkLoopManager.UnsetTick;

protected override void OnSystemLinked() => NetworkSystem.ReconcileRequired += OnReconcileRequired;

protected override void OnSystemUnlinked() => NetworkSystem.ReconcileRequired -= OnReconcileRequired;

private void OnReconcileRequired(uint rewoundTick)
{
    if (rewoundTick != NetworkLoopManager.UnsetTick)
        _pendingRewoundTick = rewoundTick;
}

protected override void OnReconcile(StepDelta stepDelta)
{
    if (_pendingRewoundTick == NetworkLoopManager.UnsetTick)
        return;

    uint currentTick = CoreManager.NetworkLoopManager.Tick;

    for (uint tick = _pendingRewoundTick + 1; tick < currentTick; tick++)
    {
        NetworkSystem.BeginReplayTick(tick);

        // Re-run this tick's step: Predict members already read this tick's client state.

        NetworkSystem.EndReplayTick();
    }

    _pendingRewoundTick = NetworkLoopManager.UnsetTick;
}
```

`ReconcileRequired` is raised at the head of the `Reconcile` step, after the restore, so `OnReconcile` runs after it on the same step. `rewoundTick` is the start tick: the server's value there already includes that tick's client state, so replay from the tick after it. It is `NetworkLoopManager.UnsetTick` when a server `SendReconcile` landed with no echo of the processed client state tick; skip the replay then. Bracket every past tick with `BeginReplayTick` / `EndReplayTick`, in tick order: a write to a predicted member outside the bracket lands on the live value and breaks the next comparison.

A server correction of your client state alone does not raise `ReconcileRequired`. The server's value lands in that tick's history and the component raises `OnMembersChanged` with `MemberChangeDirection.Correction` instead.

## See also

- The restore, the report and every refusal are described in full in [Reconciliation and replay](../../core-api/control/reconciliation.md).
- To predict a rigidbody, see [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md). A body the server simulates while a client steers it converges instead; see [Driving a predicted body](../physics/driving-a-predicted-body.md).
