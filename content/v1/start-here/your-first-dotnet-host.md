---
title: "Your first .NET host"
---

> **Using Unity?** See [Your first networked scene](./your-first-networked-scene.md).

## Bootstrap

A Nucleus session starts with a `CoreManager`, given the loop provider that will step it:

```csharp
using Nucleus.Managers.Core;

MainThreadStepProvider loop = new();
CoreManager coreManager = new(networkLoopStepProvider: loop);
```

That constructor is the whole bootstrap. It builds every manager the session needs and, on its last line, installs and starts the loop provider you pass it. There is no `Initialize` or `Start` call to make afterward. `MainThreadStepProvider` is a small class of your own, shown under "Driving the network loop" below: it steps the loop only when your code tells it to, so everything you set up before then runs against a loop that is standing still.

The constructor takes two optional arguments:

```csharp
public CoreManager(uint tickRate = NetworkLoopManager.DefaultTickRate, INetworkLoopStepProvider? networkLoopStepProvider = null)
```

`tickRate` fixes the session's ticks per second for its lifetime. `networkLoopStepProvider` is covered below.

## The managers it builds

`CoreManager` exposes each subsystem as a public field, all constructed together:

| Field | Owns |
|---|---|
| `NetworkLoopManager` | The tick loop itself. |
| `TransportManager` | Transports and connections. |
| `ServerManager` | The server role: approving, kicking, messaging clients. |
| `ClientManager` | The client role. |
| `SystemManager` | Replicated systems. |
| `InterestManager` | What each connection observes. |
| `SceneManager` | Scene load/unload and completion. |
| `PacketManager` | Packet framing. |
| `MessageManager` | `IMessage` registration and dispatch. |
| `RpcManager` | Remote calls. |
| `ViolationManager` | Misbehaving-peer tracking. |

A Pro build adds two more fields the same way: `BundleManager` (content delivered outside the build — Addressables, a patcher, a CDN) and `WorldPersistenceManager` (saving and rebuilding a world on disk). A Free build has neither field at all.

## Driving the network loop

Nothing ticks until something steps the loop. The provider from the bootstrap is the smallest one that works: each time your code calls `Step`, it hands the time since the previous call to `NetworkLoopStepDriver`, which decides when a tick runs and invokes the loop's steps in order. Put it in its own file:

```csharp
using Nucleus.Managers.NetworkLoop;

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

If your host already runs its own loop, such as a game engine's update or a custom simulation tick, call `Step` from there instead of from `Main`.

Pass the provider at construction, not after. Nothing steps the loop until the constructor's last line, so naming a provider there means the default never runs at all. Pass no provider and the constructor installs a `SystemNetworkLoopStepProvider`, which runs the loop off a `System.Timers.Timer` on a thread-pool thread from the moment the constructor returns. Everything you do after that, adding transports and subscribing to events included, races a loop that is already stepping, and swapping a provider in later leaves the default driving it until the swap. See [Threading and lifetime](../core-api/core/threading-and-lifetime.md).

## Bringing up a transport

### A single-process host

The simplest way to get a server and a client talking is one process playing both roles over an in-memory transport, `Yak`:

```csharp
using Nucleus.Connections;
using Nucleus.Transports.Yak;

TransportManager transportManager = coreManager.TransportManager;

Yak yak = new();
await transportManager.TryAddTransportAsync(yak);

await yak.ConnectAsync(Invoker.Server);
await yak.ConnectAsync(Invoker.Client);
```

Make these `ConnectAsync` calls after you have subscribed to events and registered handlers, as the next two sections show. On `Yak` the connection comes up inside `ConnectAsync` itself, so a handler added afterwards never sees it.

`ConnectAsync` lives on the `Transport`, not on `TransportManager`. `Invoker` just names which role the call acts for — it says nothing about whether that role is actually started yet.

### Two real processes

For an actual server and client across a socket, add `Synapse` and configure where it connects:

```csharp
using System.Net;
using Nucleus.Connections;
using Nucleus.Transports.Synapse;

Synapse synapse = (Synapse)await transportManager.AddTransportAsync<Synapse>();
synapse.Configuration.Port = 7777;
synapse.RemoteHost = IPAddress.Loopback;

// On the server process:
await synapse.ConnectAsync(Invoker.Server);

// On the client process:
await synapse.ConnectAsync(Invoker.Client);
```

`Configuration.Port` is the port the server listens on and the client connects to. `RemoteHost` is the address the client dials — on the core `Synapse` transport it's an `IPAddress`, not a string.

## Watching it connect

Subscribe to `TransportManager.ConnectionRemoteStateChanged` to see connections come up, and read the role flags off `TransportManager` once they do:

```csharp
transportManager.ConnectionRemoteStateChanged += change =>
{
    Console.WriteLine(change.AsString());

    Console.WriteLine($"Server started: {transportManager.IsServerStarted}");
    Console.WriteLine($"Client started: {transportManager.IsClientStarted}");
    Console.WriteLine($"Host started: {transportManager.IsHostStarted}");
};
```

`IsHostStarted` is `IsServerStarted && IsClientStarted` — true once a single process is acting as both.

## Sending something across

Define a message type by implementing `IMessage`:

```csharp
using Nucleus.Managers.Messages;
using Nucleus.Serializers;

[NetworkType]
public struct HelloMessage : IMessage
{
    public string Text;
}
```

`IsAuthenticationRequired` decides whether the sender must be authenticated for the message to be delivered; it defaults to `true`, and by default Nucleus authenticates a connecting client the moment its transport connects, so this needs no attention here. Override it to `false` only for messages that must reach an unauthenticated peer, such as a handshake of your own.

Register a handler on `MessageManager` and send with `Connection.SendMessage`:

```csharp
using Nucleus.Transports;

coreManager.MessageManager.RegisterMessageHandler<HelloMessage>((in MessageContext context, HelloMessage message) =>
{
    Console.WriteLine($"Received: {message.Text}");
});

transportManager.ConnectionRemoteStateChanged += change =>
{
    if (change.Connection.RemoteState is RemoteConnectionState.Connected && change.Connection.IsClient)
        change.Connection.SendMessage(Channel.Reliable, new HelloMessage { Text = "hello from the server" });
};
```

That's the whole round trip: the server sends the moment the client's connection comes up remotely, and the handler registered above prints it on receipt. See the Messaging pages for anything beyond a single struct — batching, per-connection sends, and the authentication handshake itself.

## Running the loop, and shutting down

With everything wired up, `Main` becomes the loop. Step the provider until you want to stop, then tear the session down:

```csharp
using System.Diagnostics;

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

Ctrl+C ends the loop, and `coreManager.Deinitialize()` tears the session down. It's idempotent: calling it more than once, or from two places that both think they own shutdown, is safe.

## One thing to know before the second hour

With this provider, your message handlers, connection-state callbacks, and anything else Nucleus calls run on the thread that calls `loop.Step`, which here is `Main`'s own thread. With the default provider they run on the network loop's own thread-pool thread instead, not the thread that constructed the `CoreManager`. If that's your UI thread or anything else that isn't thread-safe, marshal back to it yourself before touching it.
