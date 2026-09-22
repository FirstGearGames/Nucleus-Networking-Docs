---
title: "Driving the loop yourself"
---

## Why this page exists

FishNet has no equivalent of this page, because every FishNet entry point starts inside a Unity scene and Unity already owns the frame loop. Nucleus is a plain .NET engine first, so a host that is not Unity, a dedicated server process, a simulation harness, a game with its own engine loop, has to supply the clock that steps the network loop itself. `Nucleus/Managers/NetworkLoop` is where that clock plugs in.

## The default is enough for most hosts

If you construct a `CoreManager` and pass nothing for the loop step provider, it gets a `SystemNetworkLoopStepProvider`. This is a `System.Timers.Timer` running at a 1 ms interval paired with a `Stopwatch`, raising loop steps from a thread pool thread on every elapsed callback. It throttles its variable-update cadence to an 8 ms simulated frame interval, and lowers that interval to match the tick interval once the configured tick rate rises above roughly 125 Hz (`NetworkLoopManager.MaximumTickRate` is 128), so the achieved rate does not fall short of what was asked for.

Nothing needs writing to use it. Write your own provider only when you have a clock the default cannot see: a dedicated server's own fixed-step loop, or a test that must step deterministically rather than on a timer.

## The provider contract

A provider implements `INetworkLoopStepProvider`, in `Nucleus/Managers/NetworkLoop/INetworkLoopStepProvider.cs`:

```csharp
public interface INetworkLoopStepProvider
{
    public bool IsStarted { get; }

    public void Initialize(NetworkLoopManager networkLoopManager);

    public void Start();

    public void Stop();

    public void Return();
}
```

`Initialize` hands the provider the `NetworkLoopManager` it will drive; `Start` and `Stop` bracket the period the provider may raise steps; `Return` tells the provider it is being let go and may pool itself. `Stop` is always called before `Return`.

## Building a provider on NetworkLoopStepDriver

Both shipped providers, `SystemNetworkLoopStepProvider` and the Unity integration's, drive a `NetworkLoopStepDriver` rather than calling `NetworkLoopManager.InvokeNetworkLoopStep` themselves. The driver is the shared cadence engine: it owns the tick accumulator, the two-tick catch-up clamp, and the one canonical order the twelve `NetworkLoopSteps` are emitted in, so a provider only has to feed it a frame delta and let it decide when a tick actually runs.

```csharp
public sealed class HostClockStepProvider : INetworkLoopStepProvider
{
    private readonly NetworkLoopStepDriver _driver = new();

    public bool IsStarted { get; private set; }

    public void Initialize(NetworkLoopManager networkLoopManager)
    {
        float tickIntervalMilliseconds = 1000f / networkLoopManager.TickRate;

        _driver.Initialize(networkLoopManager, tickIntervalMilliseconds);
    }

    public void Start() => IsStarted = true;

    public void Stop() => IsStarted = false;

    public void Return() { }

    // Called once per frame from your host's own loop.
    public void OnHostFrame(float frameDeltaMilliseconds)
    {
        if (!IsStarted)
            return;

        _driver.AdvanceEarly(frameDeltaMilliseconds, isVariableUpdateAllowed: true);
        _driver.AdvanceLate(frameDeltaMilliseconds, isVariableUpdateAllowed: true);
    }
}
```

`AdvanceEarly` accumulates the frame, decides whether a tick fires, and invokes everything from `EarlyVariableUpdate` through the mid-cycle `VariableUpdate`. `AdvanceLate` invokes the state-write and late tick steps for the same frame. The split exists so a host that runs distinct early/late phases (Unity's `Update`/`LateUpdate`) can call them separately; a host with one frame callback, like the one above, calls both back to back, the same way `SystemNetworkLoopStepProvider` does in its timer handler.

## Naming your provider in the constructor

Pass your provider to the `CoreManager` constructor:

```csharp
CoreManager coreManager = new(tickRate: 30, networkLoopStepProvider: new HostClockStepProvider());
```

`NetworkLoopManager` also exposes `UseNetworkLoopStepProvider(INetworkLoopStepProvider)`, and it does correctly stop and return the provider it replaces. But by the time you could call it after construction, the default `SystemNetworkLoopStepProvider` is already stepping the loop from a thread pool thread, racing every registration the rest of your bring-up code makes in the meantime. Name your provider in the constructor and the default never starts at all.

## Hand-driving for tests and deterministic simulation

For deterministic simulation, or a test that must control exactly when a tick happens, drive the loop directly with `NetworkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps, StepDelta)` instead of going through a provider's timer. Install a provider that never steps on its own (the test suite's `ManualStepProvider`, which just flips `IsStarted` and does nothing else), then invoke all twelve steps yourself, in the framework's canonical order:

```csharp
StepDelta delta = new(0, 0, 0);

networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyVariableUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyTickUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyStateUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateStateUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.Reconcile, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyFixedUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateFixedUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.VariableUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyStateWrite, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateStateWrite, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateTickUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateVariableUpdate, delta);
```

This is exactly the order Nucleus's own test harness drives a full tick in. Do not reorder or skip steps: framework work is woven into specific steps (packet receive and deserialize on `EarlyVariableUpdate`, system deserialize and RPC dispatch on `LateStateUpdate`, state serialization on `LateStateWrite`, message and RPC serialization on `LateVariableUpdate`, among others), and tests that assert on replicated state depend on that order holding.

## One loop, one manager

Each `CoreManager` owns exactly one `NetworkLoopManager`, and that manager enforces that only one thread drives it at a time. `InvokeNetworkLoopStep` claims the calling thread for the duration of the step; a second thread that calls in while a step is already executing is turned away rather than run, and the rejection is logged at most once a minute so a stuck second driver does not flood the log. A re-entrant call from the thread that already holds the step is not a second driver, and runs normally.

In practice this means: do not call a hand-driven `InvokeNetworkLoopStep` from one thread while a real provider (the default timer, or your own) is also stepping the same manager. Pick one driver for a given `CoreManager`'s whole life, either a provider or hand-driving, never both at once.
