---
title: "Tick rate and the loop in Unity"
---

> **Driving the core API directly?** See [Ticks, tick rate and time](../../core-api/core/ticks-and-time.md).

## Set the tick rate before you press Play

Set **Tick Rate** on `UnityNetworkLoopManager`, or in the **Session** section of the **Setup** tab of the Nucleus window (**Tools > Nucleus**).

- Default: 30 (`NetworkLoopManager.DefaultTickRate`), which is also used when the scene has no `UnityNetworkLoopManager`.
- Range: 5 (`NetworkLoopManager.MinimumTickRate`) to 128 (`NetworkLoopManager.MaximumTickRate`).

The rate is fixed once the session starts, and the slider is disabled during play. To change it, stop play mode, change the value and start again.

## Loop callbacks run on the main thread

Every network loop callback in Unity runs on Unity's main thread, so you can read and write transforms, components and GameObjects directly from one.

## Time.timeScale does not affect networking

The loop runs on unscaled time. With `Time.timeScale = 0` the game keeps receiving, ticking and sending, so a paused client stays connected, and slow motion does not drift the tick away from other peers. If a pause should freeze networked gameplay, stop your own simulation in your callbacks, for example by skipping your movement code while paused.

## Read the clock from a script

`UnityNetworkLoopManager.NucleusNetworkLoopManager` gives:

- `Tick`: the current local tick.
- `TickRate`: ticks per second, fixed for the session.
- `SubtickPercentage`: how far the loop is into the current tick, from 0 to 1. It updates every frame and is what render smoothing between ticks uses.

## Move objects every frame by the normalized delta

If your authority moves an object every frame, move it in `OnVariableUpdate` by `stepDelta.NormalizedDelta`, not in `Update` by `Time.deltaTime`:

```csharp
protected override void OnVariableUpdate(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    float seconds = (float)(stepDelta.NormalizedDelta / 1000.0);
    transform.position += _velocity * seconds;
}
```

Frames never line up with ticks, so an object moved by `Time.deltaTime` covers a different distance each tick, and that unevenness costs bandwidth. `NormalizedDelta` adjusts each frame's delta so the frames between two ticks add up to exactly one tick interval. It is in milliseconds, like the other `StepDelta` fields.

## See also

- [The network loop steps](./network-loop-steps.md): what runs at each step, and in what order.
- [Driving the loop yourself](../../core-api/core/custom-loop-step-provider.md): writing your own `INetworkLoopStepProvider` instead of the one Unity supplies.
