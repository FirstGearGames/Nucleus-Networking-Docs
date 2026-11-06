---
title: "Ticks, tick rate and time"
---

> **Using Unity?** See [Tick rate and the loop in Unity](../../unity/core/unity-tick-rate-and-the-loop.md).

## Set the tick rate when you construct the CoreManager

`NetworkLoopManager.TickRate` is the number of ticks per second. It comes from the `tickRate` argument of the `CoreManager` constructor and has no setter:

```csharp
public uint TickRate { get; }
```

```csharp
CoreManager coreManager = new(tickRate: 60);
uint rate = coreManager.NetworkLoopManager.TickRate; // 60
```

- The default is `NetworkLoopManager.DefaultTickRate` (30).
- A rate outside `NetworkLoopManager.MinimumTickRate` (5) through `NetworkLoopManager.MaximumTickRate` (128) is clamped to the nearer bound and logged as a warning.
- The rate cannot change mid-session. A new rate means a new `CoreManager`.

## Tick counts this peer's ticks

```csharp
public uint Tick { get; private set; } = FirstTick;
```

`NetworkLoopManager.Tick` is the current local tick. It increments at the very end of the `TickAdvance` step, after its callbacks, so `LateVariableUpdate`, the frames between ticks and every message handler already read the tick their writes will ride.

It starts at `FirstTick` (1). `UnsetTick` is 0, and a live tick is never the unset value.

`Tick` is this peer's own counter. A client's `Tick` and the server's are independent counters that run at the same rate, not a shared clock. To estimate the server's tick, use `Connection.TryGetServerTickEstimate`:

```csharp
public bool TryGetServerTickEstimate(uint localTick, out uint serverTickEstimate)
```

It derives the estimate from the newest state received from that connection, and returns `false` until at least one has arrived.

## SubtickPercentage is how far through the tick you are

```csharp
public float SubtickPercentage { get; private set; }
public void SetSubtickPercentage(float percentage)
```

`SubtickPercentage` is the fraction, 0 through 1, of the current tick that has elapsed. `SetSubtickPercentage` clamps into that range. `NetworkLoopStepDriver` sets it on every frame that runs a variable update, just before `VariableUpdate`, so any provider built on the driver (including the default and the Unity provider) keeps it current; do not set it yourself from such a provider. A provider that invokes the steps without the driver leaves it at zero, which is safe: interpolation then resolves to the previous value.

## Every step callback receives a StepDelta

```csharp
public struct StepDelta
{
    public long Delta;
    public long FixedDelta;
    public long TimeSinceLastFixedUpdate;
    public double NormalizedDelta;
}
```

All four are in milliseconds:

- `Delta`: time since the step last ran. Use it for variable-timing work.
- `FixedDelta`: the step's fixed delta when one applies, and zero otherwise. Use it for work that needs consistent timing, such as physics or anything keyed to the tick rate.
- `TimeSinceLastFixedUpdate`: time since the last fixed update completed. It does not change until that fixed update finishes.
- `NormalizedDelta`: the frame's delta adjusted so the frames between two ticks add up to exactly one tick interval. `NetworkLoopStepDriver` sets it, so it is zero when you invoke the steps yourself.

## Move per-frame work by NormalizedDelta

Frames never line up with ticks, so an object moved by each frame's raw delta covers a different distance every tick, and uneven per-tick movement costs more bandwidth to replicate. `NormalizedDelta` keeps the object moving every frame but evens out the distance per tick, without losing time or changing its speed: time past one tick interval is carried onto the next frame. A single frame longer than a tick interval still gets its whole delta, plus anything carried.

Read it on `VariableUpdate` and convert it to seconds:

```csharp
public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
{
    float seconds = (float)(stepDelta.NormalizedDelta / 1000.0);
    position += velocity * seconds;
}
```

To run your own code on the loop, see [The network loop steps](./network-loop-steps.md#hook-into-steps-with-inetworkloopstepcallback).
