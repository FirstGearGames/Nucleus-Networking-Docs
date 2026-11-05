---
title: "Driving the loop yourself"
---

Outside Unity, something has to supply the clock that steps the network loop; the types on this page are in `Nucleus.Managers.NetworkLoop`. If you pass no loop step provider to the `CoreManager` constructor, it uses `SystemNetworkLoopStepProvider`, a timer that steps the loop from a thread pool thread at any tick rate up to `NetworkLoopManager.MaximumTickRate` (128). That needs no code.

Write your own provider only when you have a clock the default cannot see, such as a dedicated server's own fixed-step loop, or a test that must step deterministically.

## Implement INetworkLoopStepProvider

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

- `Initialize` hands the provider the `NetworkLoopManager` it will drive.
- `Start` and `Stop` bracket the period the provider may raise steps.
- `Return` tells the provider it is being let go and may pool itself. `Stop` is always called before `Return`.
- `IsTickFrame` says whether the frame being driven runs a tick. Left false, the frame's serialize steps send messages but write no state and raise no callbacks. A provider built on `NetworkLoopStepDriver` forwards `NetworkLoopStepDriver.IsTickFrame`. A provider that invokes the steps itself must set it true before the steps of a pass that ticks, and false otherwise.

## Build it on NetworkLoopStepDriver

`NetworkLoopStepDriver` keeps the tick rate for you, as both shipped providers do. Call its `Initialize` once with the manager and the tick interval, then hand it each frame's elapsed time through `AdvanceEarly` and `AdvanceLate`:

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

Call `AdvanceEarly` at the start of each frame and `AdvanceLate` at the end of the same frame, with the same frame delta and the same `isVariableUpdateAllowed`. A host with separate early and late phases calls one from each; a host with one frame callback calls both back to back, as above.

## Pass your provider to the constructor

```csharp
CoreManager coreManager = new(tickRate: 30, networkLoopStepProvider: new HostClockStepProvider());
```

Named in the constructor, your provider replaces the default before it ever starts. `NetworkLoopManager.UseNetworkLoopStepProvider(INetworkLoopStepProvider)` also swaps providers, stopping and returning the one it replaces, but by the time you can call it the default is already stepping the loop from a thread pool thread, racing the rest of your setup.

## Step the loop by hand for tests and deterministic simulation

To control exactly when a tick happens, call `NetworkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps, StepDelta)` yourself.

1. Install a provider that never steps on its own and lets you set `IsTickFrame`:

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

2. Set `IsTickFrame` to true and invoke all eleven steps in this order:

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

Do not reorder or skip steps: replicated state, messages and RPCs only work when every step runs, in this order. Only `TickAdvance` advances `Tick`.

## Drive each CoreManager from one thread

Only one thread may drive a `NetworkLoopManager` at a time. A call to `InvokeNetworkLoopStep` from a second thread while a step is running on another is refused and logs an error. A re-entrant call from the thread already running the step runs normally.

Never hand-drive a `CoreManager` while a provider (the default timer or your own) is also stepping it. Pick one driver for its whole life.
