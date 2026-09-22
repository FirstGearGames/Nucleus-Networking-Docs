---
title: "Your first .NET host"
---

> **Using Unity?** See [Your first networked scene](./your-first-networked-scene).

## Bootstrap

A Nucleus session starts with one line:

```csharp
using Nucleus.Managers.Core;

CoreManager coreManager = new();
```

That constructor is the whole bootstrap. It builds every manager the session needs and, on its last line, starts the network loop. There is no `Initialize` or `Start` call to make afterward — by the time `new CoreManager()` returns, the loop is already running.

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

You don't have to drive ticks yourself. Pass no provider, as above, and the constructor installs a `SystemNetworkLoopStepProvider`, which runs the loop off a `System.Timers.Timer` on a thread-pool thread for as long as the process lives.

If your host already runs its own loop — a game engine's update, a custom simulation tick — implement `INetworkLoopStepProvider` and pass it in at construction:

```csharp
CoreManager coreManager = new(tickRate: 30, networkLoopStepProvider: myProvider);
```

Do this at construction, not after. Nothing steps the loop until the constructor's last line, so naming a provider there means the default never runs at all. Swapping a provider in later instead leaves the default driving the loop from the thread pool for the rest of construction — a second thread writing the loop's collections while your code writes them too.

## Bringing up a transport

### A single-process host

The simplest way to get a server and a client talking is one process playing both roles over an in-memory transport, `Yak`:

```csharp
using Nucleus.Connections;
using Nucleus.Transports.Yak;

TransportManager transportManager = coreManager.TransportManager;

Yak yak = new();
await transportManager.TryAddTransportAsync(yak);

_ = yak.ConnectAsync(Invoker.Server);
_ = yak.ConnectAsync(Invoker.Client);
```

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

## Keeping the process alive, and shutting down

The network loop runs on its own thread, so `Main` has to block on something or the process exits immediately:

```csharp
Console.ReadKey();
```

When you're done, tear the session down with `coreManager.Deinitialize()`. It's idempotent — calling it more than once, or from two places that both think they own shutdown, is safe.

## One thing to know before the second hour

With the default provider, your message handlers, connection-state callbacks, and anything else Nucleus calls run on the network loop's own thread-pool thread — not the thread that constructed the `CoreManager`. If that's your UI thread or anything else that isn't thread-safe, marshal back to it yourself before touching it.
