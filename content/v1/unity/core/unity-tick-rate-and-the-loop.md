---
title: "Tick rate and the loop in Unity"
---

> **Driving the core API directly?** See [Ticks, tick rate and time](../../core-api/core/ticks-and-time.md).

## Setting the tick rate

`UnityNetworkLoopManager` has a single inspector field, **Tick Rate**. It defaults to `NetworkLoopManager.DefaultTickRate` (30) and is clamped by the engine between `NetworkLoopManager.MinimumTickRate` (5) and `NetworkLoopManager.MaximumTickRate` (128). The inspector draws it as a slider bounded to that same range, so an unsupported value cannot be authored in the first place, and shows a note that the rate is fixed once the session starts.

If a scene has no `UnityNetworkLoopManager` at all, the session falls back to `NetworkLoopManager.DefaultTickRate`.

## Why the rate is fixed for the session

`UnityCoreManager` reads the tick rate off `UnityNetworkLoopManager` in its own `Awake`, before it constructs the `CoreManager`. The rate is baked into every value derived from it at that point, and `NetworkLoopManager.TickRate` exposes no setter afterward. Changing the inspector field in play mode does nothing: the running session already built its derived values from the rate it started with, and the inspector disables the slider while playing to say so.

To run at a different rate, stop play mode, change the value, and start again.

## How Unity drives the loop

Rather than the engine's default background-timer provider, a Unity session is driven by loop-stepping behaviour that `UnityCoreManager` adds to the scene at runtime, alongside `UnityNetworkLoopManager` (or the `UnityCoreManager`'s own object, when no `UnityNetworkLoopManager` is present). You never add or reference this behaviour yourself.

It splits the loop across Unity's own update methods, both driven from `Time.deltaTime`:

- **`Update`** advances the early half of the loop.
- **`LateUpdate`** advances the late half of the loop.

It runs at a negative execution order, so its `Update` executes before your own scripts' `Update` for the frame. A tick's early steps, and anything they trigger, have already happened by the time your gameplay code runs.

## What this means for your code

Because the loop is driven from Unity's own `Update`/`LateUpdate`, every network loop callback in a Unity session runs on Unity's main thread. You can read and write Unity objects (transforms, components, `GameObject`s) directly from a loop step callback. This is unlike the engine's default, non-Unity provider, which steps the loop from a background timer and does not give you the main thread for free.

## Reading the clock from a script

`UnityNetworkLoopManager.NucleusNetworkLoopManager` is the underlying `NetworkLoopManager` for the session. From it:

- **`Tick`** — the current local tick.
- **`TickRate`** — the ticks-per-second the session is running at, fixed for the session.
- **`SubtickPercentage`** — how far the loop is into the current tick, as a 0–1 fraction.
- **`IsTickFrame`** is true when the current frame runs a network tick. It is set before the frame's first loop step, so every step of the frame, and your own `Update`, reads the same answer.

The Unity provider updates it every frame, through the same loop driver the default .NET provider uses, so `SubtickPercentage` is meaningful in a Unity session. It's what render smoothing between ticks rides on.

## Move objects every frame by the normalized delta, not Time.deltaTime

If your authority moves an object every frame, move it in `OnVariableUpdate` by `stepDelta.NormalizedDelta` rather than in Unity's `Update` by `Time.deltaTime`:

```csharp
protected override void OnVariableUpdate(StepDelta stepDelta)
{
    if (!IsController(ControllerType.AnyController))
        return;

    float seconds = (float)(stepDelta.NormalizedDelta / 1000.0);
    transform.position += _velocity * seconds;
}
```

Frames never line up with ticks, so an object moved by `Time.deltaTime` covers a different distance in every tick, and that unevenness costs bandwidth to replicate. `NormalizedDelta` is the frame's delta adjusted so the frames between two ticks add up to exactly one tick interval. The object still moves every frame at the same speed, but every tick sees the same distance moved.

The difference is large. In the Belted Asteroid benchmark, moving with `Time.deltaTime` cost 1.52 bytes per object per send, and moving with `NormalizedDelta` cost 0.44, against 0.41 for moving once per tick. In the roaming character benchmark the same three figures were 3.22, 0.52 and 0.48.

`NormalizedDelta` is in milliseconds, like the other `StepDelta` fields. See [Ticks and time](../../core-api/core/ticks-and-time.md) for exactly how it is worked out.

## See also

- [The network loop steps](../../core-api/core/network-loop-steps.md) — what actually runs at each step, and in what order.
- [Driving the loop yourself](../../core-api/core/custom-loop-step-provider.md) — writing your own `INetworkLoopStepProvider` instead of the one Unity supplies.
