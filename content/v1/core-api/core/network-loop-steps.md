---
title: "The network loop steps"
---

> **Using Unity?** See [The network loop steps](../../unity/core/network-loop-steps.md).

## Eleven steps run in a fixed order

Every frame walks the loop's steps in this order, and a frame that runs a tick walks all eleven:

`EarlyVariableUpdate`, `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlyFixedUpdate`, `LateFixedUpdate`, `VariableUpdate`, `EarlySerialize`, `LateSerialize`, `TickAdvance`, `LateVariableUpdate`.

Each is one flag of the `NetworkLoopSteps` enum.

- **Variable steps run every frame.** `EarlyVariableUpdate`, `VariableUpdate` and `LateVariableUpdate` run on every frame, whatever the frame rate.
- **Tick steps run once per tick, on the frame that ticks.** `EarlyStateUpdate`, `LateStateUpdate`, `Reconcile`, `EarlySerialize`, `LateSerialize` and `TickAdvance` are where replicated state is applied, reconciled and written, and where the tick advances.
- **Fixed steps run once per elapsed tick interval.** `EarlyFixedUpdate` and `LateFixedUpdate` run on the frame that ticks, once for each tick interval that has passed, so after a long frame they can run twice on one frame. A frame still runs at most one tick.

A frame that does not reach the next tick runs only its variable steps, so do not assume a tick step or a fixed step fires every frame.

## Some steps run engine work before or after your callback

- **`EarlyVariableUpdate`** receives packets before your callback, and dispatches received messages to their handlers after it. React to something a message delivered later than this step.
- **`LateStateUpdate`** catches `PresentedTick` up to `Tick`, applies received state, then dispatches received RPCs, all before your callback.
- **`EarlyFixedUpdate`**, in Pro, first advances a newly spawned object that is still catching up, so its step for the tick has happened before anything simulates against it.
- **`LateSerialize`** serializes changed state before your callback, then sends the frame's messages, RPCs and kicks after it. A write made in this callback is too late for this tick's state, but a message or call sent from it still leaves this frame.
- **`TickAdvance`**, after your callback, finishes stopping systems whose stop was pending, drops clients that did not authenticate in time, increments `Tick`, then starts systems whose start was deferred. So `LateVariableUpdate`, the frames between ticks and every message handler already read the tick their writes will ride.

The other steps run only your callbacks.

Messages, RPCs and kicks are sent on every frame, not only on frames that tick: a frame that does not tick still sends them at `LateSerialize`'s place, without raising a callback. Anything queued from a `TickAdvance` or `LateVariableUpdate` callback leaves on the next frame.

## Read after the state applies and write before it serializes

- **Read replicated state on `LateStateUpdate` or later.** A read on `EarlyStateUpdate` or earlier can still see last tick's value.
- **Write on `EarlySerialize` to send this tick.** A write on `LateSerialize` or later rides the next tick.
- **Put per-frame code on a variable step,** such as `VariableUpdate`, and move things by `StepDelta.NormalizedDelta` rather than the raw frame delta, so each tick sees an even distance (see [Ticks, tick rate and time](./ticks-and-time.md)).

Typed messages are dispatched on `EarlyVariableUpdate` and system RPCs on `LateStateUpdate`; see [When a Message or Call Reaches Its Handler](../messaging/message-and-call-timing.md).

## Hook into steps with INetworkLoopStepCallback

```csharp
public interface INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.None;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta);
}
```

`GetNetworkLoopSteps` declares the steps you want and can combine any number of flags. `OnNetworkLoopStep` is called once per declared step, each time with just that one flag and its `StepDelta`.

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

Register it with the `NetworkLoopManager`, and unregister it when the object is torn down:

```csharp
public void RegisterNetworkLoopStepCallbacks(INetworkLoopStepCallback networkLoopStepCallback)
public void UnregisterNetworkLoopStepCallbacks(INetworkLoopStepCallback networkLoopStepCallback)
```

```csharp
coreManager.NetworkLoopManager.RegisterNetworkLoopStepCallbacks(scoreTracker);
```

In Unity, `NucleusBehaviour` exposes each step as a virtual (`OnEarlyVariableUpdate` through `OnLateVariableUpdate`) and registers only for the steps your type overrides.

A callback registered during a step takes effect from the following step. A callback unregistered during a step is still invoked for the rest of that step.

To find a registered callback of a known type without keeping your own reference, pass a single step, not a combination:

```csharp
public bool TryGetFirstNetworkLoopStepCallback<T0>(NetworkLoopSteps networkLoopStep, out T0 networkLoopStepCallback)
    where T0 : class, INetworkLoopStepCallback
```

## A callback that throws does not stop the step

The exception is caught and logged, and the step goes on to its remaining callbacks and engine work:

```
The loop callback [<CallbackType>] threw during [<Step>]; the step went on to its remaining callbacks: [<exception>].
```

## Test a step without allocating

`NetworkLoopStepsExtensions.FastContains` checks one `NetworkLoopSteps` value for another without allocating:

```csharp
if (networkLoopStep.FastContains(NetworkLoopSteps.EarlyFixedUpdate))
{
    // ...
}
```
