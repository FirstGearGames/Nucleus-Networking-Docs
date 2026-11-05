---
title: "Run two peers in one process"
---

> **Using Unity?** See [Test with two editors](./testing-with-two-editors.md).

The host on the previous page is one `CoreManager` playing both roles. To test a separate server and client, create two `CoreManager`s that talk over `Synapse`, the UDP transport, on this computer.

## Create a server and a client

This program uses the `MainThreadStepProvider` from [Your first .NET host](./your-first-dotnet-host.md):

```csharp
using System.Diagnostics;
using Nucleus.Connections;
using Nucleus.Managers.Core;
using Nucleus.Transports.Synapse;

MainThreadStepProvider serverLoop = new();
MainThreadStepProvider clientLoop = new();

CoreManager server = new(networkLoopStepProvider: serverLoop);
Synapse serverSynapse = (Synapse)await server.TransportManager.AddTransportAsync<Synapse>();
serverSynapse.SetPort(7777);

CoreManager client = new(networkLoopStepProvider: clientLoop);
Synapse clientSynapse = (Synapse)await client.TransportManager.AddTransportAsync<Synapse>();
clientSynapse.SetPort(7777);

await serverSynapse.ConnectAsync(Invoker.Server);
await clientSynapse.ConnectAsync(Invoker.Client);

CancellationTokenSource stopSource = new();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    stopSource.Cancel();
};

Stopwatch frameClock = Stopwatch.StartNew();
while (!stopSource.IsCancellationRequested)
{
    float frameDeltaMilliseconds = (float)frameClock.Elapsed.TotalMilliseconds;
    frameClock.Restart();

    serverLoop.Step(frameDeltaMilliseconds);
    clientLoop.Step(frameDeltaMilliseconds);
    Thread.Sleep(1);
}

client.Deinitialize();
server.Deinitialize();
```

`SetPort` sets the port the server listens on and the port the client connects to. Step both loops from the same thread.

## Split them into two programs

To run the server and the client as separate programs, give each program only its own half. The client connects to `127.0.0.1` unless you set `RemoteHost` to the server's address:

```csharp
clientSynapse.RemoteHost = "192.168.1.20";
```
