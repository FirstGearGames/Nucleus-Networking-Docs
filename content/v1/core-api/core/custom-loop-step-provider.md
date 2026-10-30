---
title: "Driving the loop yourself"
---

## Why this page exists

FishNet has no equivalent of this page, because every FishNet entry point starts inside a Unity scene and Unity already owns the frame loop. Nucleus is a plain .NET engine first, so a host that is not Unity, a dedicated server process, a simulation harness, a game with its own engine loop, has to supply the clock that steps the network loop itself. The `Nucleus.Managers.NetworkLoop` namespace is where that clock plugs in.

## The default is enough for most hosts

If you construct a `CoreManager` and pass nothing for the loop step provider, it gets a `SystemNetworkLoopStepProvider`, a timer that raises loop steps from a thread pool thread. It keeps pace with any configured tick rate up to `NetworkLoopManager.MaximumTickRate`, which is 128.

Nothing needs writing to use it. Write your own provider only when you have a clock the default cannot see: a dedicated server's own fixed-step loop, or a test that must step deterministically rather than on a timer.

## The provider contract

A provider implements `INetworkLoopStepProvider`:

```csharp
public interface INetworkLoopStepProvider
{
    public bool IsStarted { get; }

    public bool IsTickFrame { get; }

    public void Initialize(NetworkLoopManager networkLoopManager);

    public void Start();

    public void Stop();

    public void Return();
}
```

`Initialize` hands the provider the `NetworkLoopManager` it will drive; `Start` and `Stop` bracket the period the provider may raise steps; `Return` tells the provider it is being let go and may pool itself. `Stop` is always called before `Return`.

`IsTickFrame` answers whether the frame the provider is driving runs a tick. The engine reads it to decide whether the frame's serialize steps write state and raise their callbacks. A provider built on `NetworkLoopStepDriver` forwards `NetworkLoopStepDriver.IsTickFrame`. A provider that invokes the steps itself answers true before the steps of a pass that ticks and false otherwise; left false, the pass sends its messages but writes no state.

## Building a provider on NetworkLoopStepDriver

Both shipped providers, `SystemNetworkLoopStepProvider` and the Unity integration's, are built on a `NetworkLoopStepDriver` rather than calling `NetworkLoopManager.InvokeNetworkLoopStep` themselves. Build yours on it too and it keeps the tick rate for you: call its `Initialize` once with the manager and the tick interval, then hand it each frame's elapsed time through `AdvanceEarly` and `AdvanceLate`.

```csharp
public sealed class HostClockStepProvider : INetworkLoopStepProvider
{
    private readonly NetworkLoopStepDriver _driver = new();

    public bool IsStarted { get; private set; }

    public bool IsTickFrame => _driver.IsTickFrame;

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

Call `AdvanceEarly` at the start of each of your host's frames and `AdvanceLate` at the end of the same frame, passing both the same frame delta and the same `isVariableUpdateAllowed` value. A host that runs separate early and late phases (Unity's `Update` and `LateUpdate`) calls one from each; a host with one frame callback, like the one above, calls both back to back.

## Naming your provider in the constructor

Pass your provider to the `CoreManager` constructor:

```csharp
CoreManager coreManager = new(tickRate: 30, networkLoopStepProvider: new HostClockStepProvider());
```

`NetworkLoopManager` also exposes `UseNetworkLoopStepProvider(INetworkLoopStepProvider)`, and it does correctly stop and return the provider it replaces. But by the time you could call it after construction, the default `SystemNetworkLoopStepProvider` is already stepping the loop from a thread pool thread, racing every registration the rest of your bring-up code makes in the meantime. Name your provider in the constructor and the default never starts at all.

## Hand-driving for tests and deterministic simulation

For deterministic simulation, or a test that must control exactly when a tick happens, drive the loop directly with `NetworkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps, StepDelta)` instead of going through a provider's timer. Install a provider that never steps on its own and lets you say whether a pass ticks:

```csharp
public sealed class HandDrivenStepProvider : INetworkLoopStepProvider
{
    public bool IsStarted { get; private set; }

    // Set by the code driving the loop: true before the steps of a pass that ticks.
    public bool IsTickFrame { get; set; }

    public void Initialize(NetworkLoopManager networkLoopManager) { }

    public void Start() => IsStarted = true;

    public void Stop() => IsStarted = false;

    public void Return() { }
}
```

Then set its `IsTickFrame` to true and invoke all eleven steps yourself, in the framework's canonical order:

```csharp
HandDrivenStepProvider stepProvider = new();
CoreManager coreManager = new(networkLoopStepProvider: stepProvider);

NetworkLoopManager networkLoopManager = coreManager.NetworkLoopManager;
StepDelta delta = new(0, 0, 0);

stepProvider.IsTickFrame = true;

networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyVariableUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyStateUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateStateUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.Reconcile, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyFixedUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateFixedUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.VariableUpdate, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlySerialize, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateSerialize, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.TickAdvance, delta);
networkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.LateVariableUpdate, delta);
```

Do not reorder or skip steps: replicated state, messages and RPCs only work when every step runs, in this order. Only `TickAdvance` advances `Tick`. Left false, `IsTickFrame` makes `EarlySerialize` and `LateSerialize` write no state and raise no callbacks, though the pass still sends its messages.

## One loop, one manager

Each `CoreManager` owns exactly one `NetworkLoopManager`, and only one thread may drive it at a time. A call to `InvokeNetworkLoopStep` from a second thread while a step is already running on another is refused and logs an error. A re-entrant call from the thread that is already running the step is not a second driver, and runs normally.

In practice this means: do not call a hand-driven `InvokeNetworkLoopStep` from one thread while a real provider (the default timer, or your own) is also stepping the same manager. Pick one driver for a given `CoreManager`'s whole life, either a provider or hand-driving, never both at once.
