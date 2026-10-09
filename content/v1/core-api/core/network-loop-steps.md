---
title: "The network loop steps"
---

## Eleven steps run in a fixed order

Nucleus never lets game code touch networked state at an arbitrary point in a frame. Every frame walks the loop's named steps in one fixed order, and a frame that runs a tick walks all eleven:

`EarlyVariableUpdate`, `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyFixedUpdate`, `LateFixedUpdate`, `VariableUpdate`, `EarlySerialize`, `LateSerialize`, `TickAdvance`, `LateVariableUpdate`.

Each is one flag of the `NetworkLoopSteps` enum. A callback for a step only ever receives that one flag; combinations are for declaring interest across several steps, never for a single dispatch.

The steps group by how often they run:

- **Variable steps run every frame.** `EarlyVariableUpdate`, `VariableUpdate` and `LateVariableUpdate` run on every frame the platform produces, whatever the frame rate is doing.
- **Tick steps run once per tick, on the frame that ticks.** `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlySerialize`, `LateSerialize` and `TickAdvance` run at the engine's fixed tick rate. They are where replicated state is applied, reconciled and written, and where the tick advances.
- **Fixed steps run once per elapsed tick interval.** `EarlyFixedUpdate` and `LateFixedUpdate` run on the frame that ticks, once for each tick interval that has passed, so after a long frame they can run twice on one frame. A frame still runs at most one tick.

A frame that does not reach the next tick runs only its variable steps. Do not assume a tick step or a fixed step fires on every frame.

## Several steps run framework work around your callback

Several steps carry framework work woven in alongside your callbacks, and whether that work runs before or after your callback matters:

- **`EarlyVariableUpdate` receives packets before your callback runs.** After your callback, received messages are dispatched to their handlers. If you need to react to something a message just delivered, do it downstream of this step, not inside it.
- **`LateStateUpdate` applies received state before your callback runs.** First `PresentedTick` catches up to `Tick`, then received state is applied, then received RPCs are dispatched, so a callback on this step sees the state and calls that arrived this tick already applied.
- **`EarlyFixedUpdate` advances a catching-up object before your callback runs.** In Pro, a newly spawned object that is still catching up advances one step first, so its step for the tick has already happened before anything simulates against it.
- **`LateSerialize` serializes changed state before your callback runs.** After your callback, the frame's messages, RPCs and kicks are sent. A write made inside this step's own callback is too late for this tick's state, but a message or call sent from it still leaves this frame.
- **`TickAdvance` ends the tick after your callback runs.** Systems whose stop was pending this tick finish stopping, clients that did not finish authenticating in time are dropped, `Tick` increments, and then systems whose start was deferred go live. It is the last step of a tick, so `LateVariableUpdate`, the frames between ticks and every message handler already read the tick their writes will ride.

The remaining steps (`EarlyStateUpdate`, `Reconcile`, `LateFixedUpdate`, `VariableUpdate`, `EarlySerialize` and `LateVariableUpdate`) carry no framework work of their own; your callback is the only thing that runs on them.

Messages, RPCs and kicks are sent on every frame, not only on frames that tick. On a frame that does not tick, the engine still sends them at `LateSerialize`'s place in the order; that send is internal and raises no callback. A message, call or kick queued from a `TickAdvance` or `LateVariableUpdate` callback leaves on the next frame.

## Where a step sits decides what your code may safely do

- **Read replicated state after it has been applied**, not before. `LateStateUpdate` and later is where incoming values are current; a read during `EarlyStateUpdate` or earlier can still see last tick's value.
- **Write before it is serialized.** `EarlySerialize` is the step for writing values you want sent this tick. `LateSerialize` serializes whatever changed before its callbacks run, so a write made in `LateSerialize` or later rides the next tick.
- **Do not expect a tick step every frame.** The tick steps and the fixed steps run at the tick rate, not the frame rate. Code that must run every frame regardless belongs on `VariableUpdate` or one of the other variable steps, and anything it moves should move by `StepDelta.NormalizedDelta` rather than the raw frame delta, so each tick sees an even distance.

## Message and RPC dispatch

Two dispatch points fall directly out of this ordering: typed messages resolve on `EarlyVariableUpdate`, and system RPCs resolve on `LateStateUpdate`. The difference, and why each lands where it does, is covered in [When a Message or Call Reaches Its Handler](../messaging/message-and-call-timing.md) rather than repeated here.

## Hooking into a step

**In plain C#**, implement `INetworkLoopStepCallback` and register it with the `NetworkLoopManager`:

```csharp
public class ScoreTracker : INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() =>
        NetworkLoopSteps.LateStateUpdate | NetworkLoopSteps.EarlySerialize;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
    {
        if (networkLoopStep == NetworkLoopSteps.LateStateUpdate)
        {
            // Read applied state here.
        }
    }
}
```

```csharp
coreManager.NetworkLoopManager.RegisterNetworkLoopStepCallbacks(scoreTracker);
```

`GetNetworkLoopSteps` can combine any number of flags; `OnNetworkLoopStep` is called once per step it declared, each time with just that one flag. Unregister with `UnregisterNetworkLoopStepCallbacks` when the object is torn down.

**In Unity**, a `NucleusBehaviour` exposes the same eleven steps as per-step virtuals instead: `OnEarlyVariableUpdate`, `OnEarlyStateUpdate`, `OnLateStateUpdate`, `OnReconcile`, `OnEarlyFixedUpdate`, `OnLateFixedUpdate`, `OnVariableUpdate`, `OnEarlySerialize`, `OnLateSerialize`, `OnTickAdvance`, `OnLateVariableUpdate`. Override the ones you need; the base class only registers for the steps your concrete type actually overrides. See [Tick rate and the loop in Unity](../../unity/core/unity-tick-rate-and-the-loop.md) for the component side of this.

## Testing a step in a hot path

`NetworkLoopStepsExtensions.FastContains` checks one `NetworkLoopSteps` value for another without allocating, useful when a hot path needs to branch on the current step:

```csharp
if (networkLoopStep.FastContains(NetworkLoopSteps.EarlyFixedUpdate))
{
    // ...
}
```
