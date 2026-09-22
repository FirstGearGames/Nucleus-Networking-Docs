---
title: "Ticks, tick rate and time"
---

> **Using Unity?** See [Tick rate and the loop in Unity](../../unity/core/unity-tick-rate-and-the-loop).

## Tick rate

`NetworkLoopManager.TickRate` is the number of ticks the loop runs each second. It is set once, from the `tickRate` argument passed to the `CoreManager` constructor, and has no setter afterward:

```csharp
public uint TickRate { get; }
```

If the caller names no rate, `CoreManager`'s constructor defaults to `NetworkLoopManager.DefaultTickRate` (30). A requested rate outside `NetworkLoopManager.MinimumTickRate` (5) through `NetworkLoopManager.MaximumTickRate` (128) is clamped to the nearer bound and logged as a warning rather than rejected.

Every rate-derived value in the engine, the loop provider's tick interval, the state retention window, each `NetworkMember`'s send interval in ticks, is baked once from this value while the managers are constructed. There is no supported way to change the tick rate mid-session; a new rate means a new `CoreManager`.

```csharp
CoreManager coreManager = new(tickRate: 60);
uint rate = coreManager.NetworkLoopManager.TickRate; // 60
```

## The tick counter

`NetworkLoopManager.Tick` is the current local tick, incremented once per tick on the `EarlyTickUpdate` step:

```csharp
public uint Tick { get; private set; } = FirstTick;
```

It starts at `FirstTick` (1), never at zero. `UnsetTick` is 0, and the framework relies on "a live tick is never the unset value" wherever a tick doubles as a presence flag, such as a `NetworkMember`'s self-clearing writer stamp.

`Tick` is this peer's own local counter, not a shared wall clock. Two connected peers do not share a tick number: a client's `Tick` and the server's `Tick` are two independently incrementing counters that happen to run at the same rate. To estimate what tick a remote peer is on, read `Connection.TryGetServerTickEstimate` instead:

```csharp
public bool TryGetServerTickEstimate(uint localTick, out uint serverTickEstimate)
```

It derives the estimate from the newest state packet received from that connection, and returns `false` until at least one has arrived.

## Subtick percentage

`SubtickPercentage` is the fraction, 0 through 1, of the current tick that has elapsed:

```csharp
public float SubtickPercentage { get; private set; }
public void SetSubtickPercentage(float percentage)
```

It is set by a loop step provider that measures partial-tick time and calls `SetSubtickPercentage`, which clamps the value into the 0-1 range. A provider that does not drive subtick accumulation leaves it at zero, its default, which is a safe value: interpolation reading it resolves to the previous value rather than an undefined intermediate one.

## StepDelta

Every loop step callback receives a `StepDelta`, carrying three millisecond fields:

```csharp
public struct StepDelta
{
    public long Delta;
    public long FixedDelta;
    public long TimeSinceLastFixedUpdate;
}
```

- `Delta` — milliseconds since the step last ran. Use it for variable-timing work.
- `FixedDelta` — the fixed delta for the step, when one applies; zero otherwise. Use it for work that needs consistent timing, such as physics or anything keyed to the tick rate.
- `TimeSinceLastFixedUpdate` — milliseconds since the last fixed update completed. Not modified until that fixed update finishes.

## Running your own code on the loop

Implement `INetworkLoopStepCallback` to have code invoked on chosen loop steps:

```csharp
public interface INetworkLoopStepCallback
{
    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.None;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta);
}
```

`GetNetworkLoopSteps` declares which steps the callback wants; `OnNetworkLoopStep` is invoked on each of them, receiving the step and its `StepDelta`.

Register and unregister the callback against the `NetworkLoopManager`:

```csharp
public void RegisterNetworkLoopStepCallbacks(INetworkLoopStepCallback networkLoopStepCallback)
public void UnregisterNetworkLoopStepCallbacks(INetworkLoopStepCallback networkLoopStepCallback)
```

A callback registered from inside another callback's step is queued and takes effect from the following step; the current step has already decided who it dispatches to. The same applies to unregistering: a callback that departs mid-step is still invoked for the remainder of that step.

To find an already-registered callback of a known type back through the loop, rather than keeping a separate reference to it:

```csharp
public bool TryGetFirstNetworkLoopStepCallback<T0>(NetworkLoopSteps networkLoopStep, out T0 networkLoopStepCallback)
    where T0 : class, INetworkLoopStepCallback
```

Pass a single step, not a combination; callbacks are held per flag, so a combined value finds nothing.

## Error handling

A callback that throws does not stop the step. The exception is caught per callback, logged, and the step continues to its remaining callbacks:

```
The loop callback [<CallbackType>] threw during [<Step>]; the step went on to its remaining callbacks: [<exception>].
```

One misbehaving callback therefore cannot block the framework work, or any other registered callback, on the same step.
