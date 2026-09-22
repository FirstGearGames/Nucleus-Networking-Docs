---
title: "Running a dedicated .NET server"
---

> **Using Unity?** See [Building a headless Unity server](../../unity/transports/headless-server-build).

There is no FishNet page for this, because every FishNet entry point begins in a scene. Nucleus does not require one: a dedicated server is a plain console application that references `Nucleus`, and nothing else.

## The whole program

```csharp
using Nucleus.Connections;
using Nucleus.Managers.Core;
using Nucleus.Managers.Transports;
using Nucleus.Transports.Synapse;

CoreManager coreManager = new();
TransportManager transportManager = coreManager.TransportManager;

Synapse synapse = (Synapse)await transportManager.AddTransportAsync<Synapse>();
synapse.Configuration.Port = 7777;

await synapse.ConnectAsync(Invoker.Server);

// Keep the process alive. The default loop provider is already stepping
// the network loop on a thread-pool thread, so there is no tick call to write here.
await Task.Delay(Timeout.Infinite);
```

`CoreManager`'s constructor builds every subsystem manager and starts the network loop before it returns. `AddTransportAsync<T0>` instantiates the transport, registers it with the `TransportManager`, and initializes it. Setting `Configuration.Port` before `ConnectAsync` is what the server socket binds to; `ConnectAsync(Invoker.Server)` is what actually starts listening.

Nothing else runs the loop for you. There is no `Update` method to hook and no scene to load — once `ConnectAsync` returns, the server is live, and the process just needs to stay alive.

## Referencing the engine

There is no NuGet package for Nucleus. Reference the engine the way its own projects do: as a set of project references, not independent picks.

`Nucleus.csproj` itself project-references `CodeBoost` and `SynapseSocket`, and its three source generators (`CodeBoost.CodeAnalysis.Analyzers`, `Nucleus.CodeAnalysis.SourceGenerators.Signatures`, `Nucleus.CodeAnalysis.SourceGenerators`) with `OutputItemType="Analyzer"` and `ReferenceOutputAssembly="false"`. Your executable's `.csproj` needs the same shape: a `ProjectReference` to `Nucleus.csproj`, plus a `ProjectReference` to `Nucleus.CodeAnalysis.SourceGenerators.csproj` set as an analyzer, so the generated serializers your types need actually get produced.

`Nucleus.csproj` itself targets `netstandard2.1` — that is the engine's own floor, not a suggestion for your host. The shipped console host targets `net9.0`; target `net9.0` (or whatever modern TFM your deployment uses) for your own executable rather than copying `netstandard2.1` onto it.

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

In a container, wire this to `SIGTERM` rather than relying on process exit, so an orchestrator's stop signal gives connected clients a clean disconnect instead of a dropped socket:

```csharp
AppDomain.CurrentDomain.ProcessExit += (_, _) =>
{
    synapse.ShutdownAsync().GetAwaiter().GetResult();
    coreManager.Deinitialize();
};
```

## The threading consequence

`CoreManager`'s default network loop step provider drives the loop from a thread-pool timer, not from the thread that called `Main`. Every callback the engine raises — connection state changes, replication callbacks, anything you hook — runs on that provider's thread. A console host that touches shared state from both `Main` and an event handler needs to treat that state as cross-thread, the same as any other background-timer callback; there is no single "main thread" guarantee here the way a game engine's update loop gives you one.

## Taking the port from the command line

Hard-coding a port works for local testing, but a real deployment wants it and the bind address configurable at launch. See [Configuring a transport from launch arguments](command-line-configuration) for how `Transport.ApplyCommandLineArguments()` reads flags like `port` into `Configuration.Port`.
