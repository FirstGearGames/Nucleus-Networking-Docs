---
title: "The network loop steps"
---

## Twelve steps, in order, every tick

Nucleus never lets game code touch networked state at an arbitrary point in a frame. Every tick walks through the same twelve named steps, always in this order:

`EarlyVariableUpdate`, `EarlyTickUpdate`, `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyFixedUpdate`, `LateFixedUpdate`, `VariableUpdate`, `EarlyStateWrite`, `LateStateWrite`, `LateTickUpdate`, `LateVariableUpdate`.

Each is one flag of the `NetworkLoopSteps` enum. A callback for a step only ever receives that one flag; combinations are for declaring interest across several steps, never for a single dispatch.

The names group into three kinds:

- **Variable steps** (`EarlyVariableUpdate`, `VariableUpdate`, `LateVariableUpdate`) run every frame the platform produces, whatever the frame rate is doing.
- **Tick steps** (`EarlyTickUpdate`, `LateTickUpdate`) run once per network tick, at the engine's fixed tick rate.
- **Fixed steps** (`EarlyFixedUpdate`, `LateFixedUpdate`) run alongside physics timing.
- **State steps** (`EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyStateWrite`, `LateStateWrite`) mark where replicated state is applied, reconciled, or written, nested inside the tick.

A fixed step only runs on a frame that also ran a tick step; there is no fixed step floating outside a tick. A frame that does not land on the network tick rate runs its variable steps and nothing between `EarlyTickUpdate` and `LateTickUpdate`. Do not assume a tick step, or the fixed and state steps nested inside it, fires on every frame.

## Where the framework does its own work

Several steps carry framework work woven in alongside your callbacks, and whether that work runs before or after your callback matters:

- **`EarlyVariableUpdate`**: the transport's incoming packets are received *before* your callback runs. After your callback, received packets are deserialized and any messages queued from it are drained. If you need to react to something a message just delivered, do it downstream of this step, not inside it.
- **`EarlyTickUpdate`**: the tick counter increments here, ahead of anything else in the step.
- **`LateStateUpdate`**: received systems and RPCs are deserialized *before* your callback runs, so a callback on this step sees state and calls that arrived this tick already applied.
- **`EarlyFixedUpdate`**: an object still catching up through latency it lost advances that catch-up *before* your callback runs, so its step for the tick has already happened before anything simulates against it.
- **`LateStateWrite`**: changed state is serialized for sending *before* your callback runs. A write made inside this step's own callback is too late for this tick's outgoing packet.
- **`LateTickUpdate`**: *after* your callback runs, a system whose stop was pending completes, and a client that never finished authenticating in time is dropped.
- **`LateVariableUpdate`**: after your callback runs, outgoing messages and RPCs are flushed and any pending kicks execute. This is the last step of the tick, not a place to expect state you just wrote to have gone out yet.

The remaining steps — `EarlyStateUpdate`, `Reconcile`, `LateFixedUpdate`, `VariableUpdate`, `EarlyStateWrite` — carry no framework work of their own; your callback is the only thing that runs on them.

## What this means for your code

- **Read replicated state after it has been applied**, not before. `LateStateUpdate` and later is where incoming values are current; a read during `EarlyStateUpdate` or earlier can still see last tick's value.
- **Write before it is serialized.** `EarlyStateWrite` is the step for setting values you want sent; `LateStateWrite` serializes whatever changed, so a write registered for `LateStateWrite` itself may miss the packet.
- **Do not expect a tick step every frame.** `EarlyTickUpdate`, `LateTickUpdate`, and everything nested between them run at the tick rate, not the frame rate. Code that must run every frame regardless belongs on `VariableUpdate` or one of the other variable steps.

## Message and RPC dispatch

Two dispatch points fall directly out of this ordering: typed messages resolve on `EarlyVariableUpdate`, and system RPCs resolve on `LateStateUpdate`. The difference, and why each lands where it does, is covered in [When a Message or Call Reaches Its Handler](/v1/core-api/messaging/message-and-call-timing) rather than repeated here.

## Hooking into a step

**In plain C#**, implement `INetworkLoopStepCallback` and register it with the `NetworkLoopManager`:

```csharp
public class ScoreTracker : INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() =>
        NetworkLoopSteps.LateStateUpdate | NetworkLoopSteps.EarlyStateWrite;

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

**In Unity**, a `NucleusBehaviour` exposes the same twelve steps as per-step virtuals instead: `OnEarlyVariableUpdate`, `OnEarlyTickUpdate`, `OnEarlyStateUpdate`, `OnLateStateUpdate`, `OnReconcile`, `OnEarlyFixedUpdate`, `OnLateFixedUpdate`, `OnVariableUpdate`, `OnEarlyStateWrite`, `OnLateStateWrite`, `OnLateTickUpdate`, `OnLateVariableUpdate`. Override the ones you need; the base class only registers for the steps your concrete type actually overrides. See [Tick rate and the loop in Unity](/v1/unity/core/unity-tick-rate-and-the-loop) for the component side of this.

## Testing a step in a hot path

`NetworkLoopStepsExtensions.FastContains` checks one `NetworkLoopSteps` value for another without allocating, useful when a hot path needs to branch on the current step:

```csharp
if (networkLoopStep.FastContains(NetworkLoopSteps.EarlyFixedUpdate))
{
    // ...
}
```
