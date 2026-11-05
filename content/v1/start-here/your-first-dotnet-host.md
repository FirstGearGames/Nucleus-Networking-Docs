---
title: "Your first .NET host"
---

> **Using Unity?** See [Set up a networked scene](./your-first-networked-scene.md).

This page builds a console app that runs a server and a client in one process and sends a message from one to the other.

## Add a loop provider

Nucleus does its work in a loop. Add this class to your project so the loop runs only when your code calls `Step`, on your own thread:

```csharp
using Nucleus.Managers.NetworkLoop;

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

## Write the program

The program below does five things in order:

1. It creates the session, a `CoreManager`, with the loop provider.
2. It adds `Yak`, a transport that connects a server and a client inside one process.
3. It registers a handler for a message, and sends that message when a client connects.
4. It starts the server and the client.
5. It steps the loop until you press Ctrl+C, then shuts the session down.

```csharp
using System.Diagnostics;
using Nucleus.Connections;
using Nucleus.Managers.Core;
using Nucleus.Managers.Messages;
using Nucleus.Managers.Transports;
using Nucleus.Transports;
using Nucleus.Transports.Yak;

MainThreadStepProvider loop = new();
CoreManager coreManager = new(networkLoopStepProvider: loop);

TransportManager transportManager = coreManager.TransportManager;
Yak yak = new();
await transportManager.TryAddTransportAsync(yak);

coreManager.MessageManager.RegisterMessageHandler<HelloMessage>((in MessageContext context, HelloMessage message) =>
{
    Console.WriteLine($"Received: {message.Text}");
});

transportManager.ConnectionRemoteStateChanged += change =>
{
    if (change.Connection.RemoteState is RemoteConnectionState.Connected && change.Connection.IsClient)
        change.Connection.SendMessage(Channel.Reliable, new HelloMessage { Text = "hello from the server" });
};

await yak.ConnectAsync(Invoker.Server);
await yak.ConnectAsync(Invoker.Client);

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

    loop.Step(frameDeltaMilliseconds);
    Thread.Sleep(1);
}

coreManager.Deinitialize();
```

The message is a struct in its own file:

```csharp
using Nucleus.Managers.Messages;
using Nucleus.Serializers;

[NetworkType]
public struct HelloMessage : IMessage
{
    public string Text;
}
```

Run it, and the console prints `Received: hello from the server`.

Subscribe to events and register handlers before you call `ConnectAsync`. `Yak` connects inside `ConnectAsync`, so a handler added afterwards misses the connection.
