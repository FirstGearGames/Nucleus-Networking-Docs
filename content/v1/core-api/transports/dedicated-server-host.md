---
title: "Running a dedicated .NET server"
---

> **Using Unity?** See [Building a headless Unity server](../../unity/transports/headless-server-build.md).

There is no FishNet page for this, because every FishNet entry point begins in a scene. Nucleus does not require one: a dedicated server is a plain console application that references `Nucleus`, and nothing else.

## The whole program

```csharp
using System.Diagnostics;
using Nucleus.Connections;
using Nucleus.Managers.Core;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Managers.Transports;
using Nucleus.Transports.Synapse;

// Name your own provider here so the default thread-pool timer never starts.
MainThreadStepProvider loop = new();
CoreManager coreManager = new(networkLoopStepProvider: loop);
TransportManager transportManager = coreManager.TransportManager;

// Nothing steps the loop until this thread does, so this bring-up cannot race it.
Synapse synapse = (Synapse)await transportManager.AddTransportAsync<Synapse>();
synapse.Configuration.Port = 7777;

await synapse.ConnectAsync(Invoker.Server);

// Ctrl+C and a container stop (SIGTERM raises ProcessExit) both end the loop below.
CancellationTokenSource stopSource = new();
ManualResetEventSlim loopExited = new();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    stopSource.Cancel();
};
AppDomain.CurrentDomain.ProcessExit += (_, _) =>
{
    stopSource.Cancel();
    loopExited.Wait(TimeSpan.FromSeconds(5));
};

// Step the network loop on this thread until a stop is requested.
Stopwatch frameClock = Stopwatch.StartNew();
while (!stopSource.IsCancellationRequested)
{
    float frameDeltaMilliseconds = (float)frameClock.Elapsed.TotalMilliseconds;
    frameClock.Restart();

    loop.Step(frameDeltaMilliseconds);
    Thread.Sleep(1);
}

await synapse.ShutdownAsync();
coreManager.Deinitialize();
loopExited.Set();

/// <summary>Steps the network loop only when called, on the calling thread.</summary>
sealed class MainThreadStepProvider : INetworkLoopStepProvider
{
    private readonly NetworkLoopStepDriver _driver = new();

    public bool IsStarted { get; private set; }

    public void Initialize(NetworkLoopManager networkLoopManager) => _driver.Initialize(networkLoopManager, 1000f / networkLoopManager.TickRate);

    public void Start() => IsStarted = true;

    public void Stop() => IsStarted = false;

    public void Return() { }

    public void Step(float frameDeltaMilliseconds)
    {
        if (!IsStarted)
            return;

        _driver.AdvanceEarly(frameDeltaMilliseconds, isVariableUpdateAllowed: true);
        _driver.AdvanceLate(frameDeltaMilliseconds, isVariableUpdateAllowed: true);
    }
}
```

`CoreManager`'s constructor builds every subsystem manager, then installs the provider you pass it as its last line. This provider steps the loop only when `Main` calls `Step`, so nothing runs against the managers while `Main` adds the transport and connects. `AddTransportAsync<T0>` instantiates the transport, registers it with the `TransportManager`, and initializes it. Setting `Configuration.Port` before `ConnectAsync` is what the server socket binds to; `ConnectAsync(Invoker.Server)` is what actually starts listening.

After that, `Main` is the loop. There is no `Update` method to hook and no scene to load: the `while` loop hands the provider the time since its previous pass, and the `NetworkLoopStepDriver` inside the provider decides when a tick runs and invokes the steps in order. See [Driving the loop yourself](../core/custom-loop-step-provider.md) for more on the driver.

Pass no provider and `new CoreManager()` starts a default one that steps the loop from a thread-pool timer before the constructor returns. Everything `Main` does after that, adding the transport and connecting included, then races a loop that is already running. See [Threading and lifetime](../core/threading-and-lifetime.md).

## Referencing the engine

There is no NuGet package for Nucleus. Reference the three runtime DLLs, `Nucleus.dll`, `CodeBoost.dll`, and `SynapseSocket.dll`, as a set from one release, not independent picks. Any project that declares networked types also needs `Nucleus.CodeAnalysis.SourceGenerators.dll` from the same release as an `Analyzer` item, so the generated serializers your types need actually get produced. [Adding Nucleus to a .NET project](../../start-here/adding-nucleus-to-a-dotnet-project.md) shows the project file.

`Nucleus.dll` targets `netstandard2.1`. That is the engine's own floor, not a suggestion for your host: target a modern framework such as `net8.0` or `net9.0` for your own executable rather than copying `netstandard2.1` onto it.

## Routing engine logs

By default, Nucleus logs through `CodeBoost.Logging.LoggingService`, which starts out wired to a `ConsoleLogger`. In a container, `Console.WriteLine` output is usually fine as-is, but if you want logs routed anywhere else — a file, a structured sink, wherever your host reads them — implement `CodeBoost.Logging.ILogger` and call:

```csharp
LoggingService.UseLogger(myLogger);
```

Call this before `new CoreManager()` so every manager's startup logging already goes through it.

## Shutting down cleanly

Tear down transports before tearing down the manager:

```csharp
await synapse.ShutdownAsync();
coreManager.Deinitialize();
```

`Transport.ShutdownAsync()` closes the socket; `CoreManager.Deinitialize()` stops the network loop and releases every manager it owns, in the reverse of the order it built them. `Deinitialize()` is safe to call more than once.

In a container, wire this to `SIGTERM` rather than relying on process exit, so an orchestrator's stop signal gives connected clients a clean disconnect instead of a dropped socket. The program above already does: .NET raises `ProcessExit` on `SIGTERM`, the handler only cancels `stopSource` and waits, and `Main` leaves its loop and runs the teardown on the thread that was stepping the loop. Don't call `ShutdownAsync` or `Deinitialize` from the handler itself, because that thread would tear the session down while `Main` is still stepping it.

## The threading consequence

Every callback the engine raises (connection state changes, replication callbacks, anything you hook) runs on the thread that steps the loop. With the provider above that is `Main`'s thread, inside `loop.Step`, so code in the `while` loop can share state with those callbacks without locks. Only the two stop handlers run elsewhere, which is why they touch nothing but `stopSource` and `loopExited`.

`CoreManager`'s default network loop step provider is different: it drives the loop from a thread-pool timer, not from the thread that called `Main`, and every callback runs on that pool thread. A console host that accepts the default and touches shared state from both `Main` and an event handler needs to treat that state as cross-thread, the same as any other background-timer callback; there is no single "main thread" guarantee there the way a game engine's update loop gives you one.

## Taking the port from the command line

Hard-coding a port works for local testing, but a real deployment wants it and the bind address configurable at launch. See [Configuring a transport from launch arguments](./command-line-configuration.md) for how `Transport.ApplyCommandLineArguments()` reads flags like `port` into `Configuration.Port`.
