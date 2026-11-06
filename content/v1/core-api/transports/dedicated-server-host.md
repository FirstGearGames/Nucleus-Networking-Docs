---
title: "Running a dedicated .NET server"
---

> **Using Unity?** See [Building a headless Unity server](../../unity/transports/headless-server-build.md).

A dedicated server is a plain console application that references Nucleus. It needs no scene.

## Reference the engine

There is no NuGet package. Reference `Nucleus.dll`, `CodeBoost.dll` and `SynapseSocket.dll` as a set from one release. A project that declares networked types also needs `Nucleus.CodeAnalysis.SourceGenerators.dll` from the same release as an `Analyzer` item, or those types cannot be sent. [Adding Nucleus to a .NET project](../../start-here/adding-nucleus-to-a-dotnet-project.md) shows the project file.

`Nucleus.dll` targets `netstandard2.1`. Target a modern framework such as `net8.0` or `net9.0` for your own executable.

## Write the program

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

    public bool IsTickFrame => _driver.IsTickFrame;

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

- Pass your own step provider. With none, `new CoreManager()` starts a default one on a thread-pool timer before the constructor returns, so adding the transport and connecting race a loop that is already running.
- Set `Configuration.Port` before `ConnectAsync(Invoker.Server)`, which starts listening.
- The `while` loop passes the time since its previous pass to the provider, whose `NetworkLoopStepDriver` decides when a tick runs. See [Driving the loop yourself](../core/custom-loop-step-provider.md).

## Callbacks run on the thread that steps the loop

With the provider above, every engine callback runs on `Main`'s thread inside `loop.Step`, so code in the `while` loop can share state with callbacks without locks. Only the two stop handlers run elsewhere, which is why they touch nothing but `stopSource` and `loopExited`.

The default provider runs every callback on a thread-pool thread instead. If you use it, treat state shared between `Main` and your handlers as cross-thread. See [Threading and lifetime](../core/threading-and-lifetime.md).

## Shut down cleanly

Shut down the transports, then the manager. `Deinitialize()` is safe to call more than once.

```csharp
await synapse.ShutdownAsync();
coreManager.Deinitialize();
```

In a container, run this on `SIGTERM` so clients get a clean disconnect instead of a dropped socket. The program above does: .NET raises `ProcessExit` on `SIGTERM`, the handler cancels `stopSource` and waits, and `Main` tears down on the thread that was stepping the loop. Do not call `ShutdownAsync` or `Deinitialize` from the handler itself, because `Main` would still be stepping the session.

## Route engine logs

Nucleus logs through `CodeBoost.Logging.LoggingService`, which starts with a `ConsoleLogger`. To send logs elsewhere, implement `CodeBoost.Logging.ILogger` and call this before `new CoreManager()`:

```csharp
LoggingService.UseLogger(myLogger);
```

## Take the port from the command line

To set the port and bind address at launch, see [Configuring a transport from launch arguments](./command-line-configuration.md).
