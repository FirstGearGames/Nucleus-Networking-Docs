---
title: "Running two peers in one process"
---

> **Using Unity?** See [Testing with two editors](./testing-with-two-editors.md).

## Two ways to run both sides in one process

A test or repro often needs a server and a client without launching a second process. Nucleus gives you two ways to do that, and they answer different questions.

`Yak` (`Nucleus.Transports.Yak`) is an offline transport with no socket underneath it at all. One `Yak` holds both the server half and the client half inside a single transport on a single `CoreManager`, so what it gives you is a host: a server and its own local client, not a second, separate peer. It cannot connect two `CoreManager` instances. `Synapse` (`Nucleus.Transports.Synapse`) is the real UDP transport; running two `CoreManager` instances over it on `127.0.0.1`, the client dialing the port the server listens on, gives you two separate peers over a genuine socket pair, still inside one process.

Use `Yak` when a host on its own is enough: single-player or offline play, or game logic that doesn't need a remote peer. Use two loopback `Synapse` managers when you need a second, separate peer, and whenever the bug - or the thing you need to prove works - lives in framing, segmentation, batching, or anything else that only happens when bytes actually cross a socket.

## Yak: no sockets at all

`Yak` overrides `IsLocalTransport()` to return `true`, which is how the rest of the engine knows it isn't talking to a real network:

```csharp
public class Yak : SocketPairTransport<ServerSocket, ClientSocket>
{
    public override bool IsLocalTransport() => true;
    ...
}
```

Add it to a `CoreManager` the same way you'd add any transport:

```csharp
CoreManager coreManager = new();
Yak yak = (Yak)await coreManager.TransportManager.AddTransportAsync<Yak>();

await yak.ConnectAsync(Invoker.Server);
await yak.ConnectAsync(Invoker.Client);
```

Connecting both halves makes that one `CoreManager` a host. Both socket halves belong to the same transport and hand data to each other directly. The engine still serializes every packet into bytes exactly as it would for a real transport; those bytes just never become a datagram, and no OS is involved.

## Two CoreManagers over Synapse

When you need the real shape - framing, segmentation, batching - build two `CoreManager` instances, each with its own `Synapse` transport, pointed at the same loopback port, and each with its own loop provider passed at construction:

```csharp
MainThreadStepProvider serverLoop = new();
MainThreadStepProvider clientLoop = new();

CoreManager server = new(tickRate: 60, networkLoopStepProvider: serverLoop);
Synapse serverSynapse = (Synapse)await server.TransportManager.AddTransportAsync<Synapse>();
serverSynapse.Configuration.Port = port;

CoreManager client = new(tickRate: 60, networkLoopStepProvider: clientLoop);
Synapse clientSynapse = (Synapse)await client.TransportManager.AddTransportAsync<Synapse>();
clientSynapse.Configuration.Port = port;
clientSynapse.RemoteHost = IPAddress.Loopback;

await serverSynapse.ConnectAsync(Invoker.Server);
await clientSynapse.ConnectAsync(Invoker.Client);

// Every frame, step both peers from this one thread:
serverLoop.Step(frameDeltaMilliseconds);
clientLoop.Step(frameDeltaMilliseconds);
```

`MainThreadStepProvider` is the small `NetworkLoopStepDriver`-based provider from [Running a dedicated .NET server](../core-api/transports/dedicated-server-host.md), which steps its loop only when you call `Step`. Because each manager gets its provider at construction, neither loop moves while the transports are added and connected, and both are then stepped from the same thread. `Synapse.RemoteHost` defaults to `IPAddress.Loopback`, so a single-process pair works without any extra addressing; you only set it explicitly on the client half to be clear about what's connecting to what.

## Why the shortcut hides bugs

A `Yak` pair never touches a socket, so anything the socket layer is responsible for never runs. A call body is length-prefixed into a per-channel accumulator that a real transport batches, segments across datagrams if it's too large, and rejoins on the other end. Hand that same buffer straight from one in-process socket to the other and none of that machinery executes - the body just arrives.

That means a framing bug - an off-by-one in a length prefix, a segment that doesn't rejoin in the right order, an accumulator that doesn't flush at the right boundary - can pass every `Yak`-based test and still break the moment it crosses a real socket. If what you're testing is replication logic, spawning, or RPC routing, `Yak` is faster and sufficient. If what you're testing is the wire format itself, it has to run over `Synapse`.

## Keeping two managers apart

`NetworkLoopManager`, `TransportManager`, and everything else hang off the `CoreManager` instance you created, not off the type - so driving two peers means holding two `CoreManager` references and passing the one you mean into whatever drives it. The one static hook, `CoreManager.Instance`, only ever names the oldest still-live manager (first write wins at construction, and a later one takes the slot over only through `EnsureSetInstance`); with two peers alive, reaching for `CoreManager.Instance` gets you whichever one happened to be built first, not "the" one you meant.

The loop enforces this at the step level, too. `NetworkLoopManager.InvokeNetworkLoopStep` claims the step for the calling thread; a second thread that calls in while a step is already in progress is turned away rather than run, and the manager counts it and reports it periodically rather than staying silent. One loop drives one manager - if you're hand-driving two peers, you drive them from the same thread, one `InvokeNetworkLoopStep` call at a time.

## Hand-driving ticks

Nothing ticks on its own unless you give the `NetworkLoopManager` a provider that drives itself. For a deterministic repro, give it one that does nothing and drive every step yourself:

```csharp
internal sealed class ManualStepProvider : INetworkLoopStepProvider
{
    public bool IsStarted { get; private set; }

    public void Initialize(NetworkLoopManager networkLoopManager) { }
    public void Start() => IsStarted = true;
    public void Stop() => IsStarted = false;
    public void Return() { }
}
```

Pass the provider to the `CoreManager` constructor, not by swapping it in later:

```csharp
CoreManager coreManager = new(networkLoopStepProvider: new ManualStepProvider());
```

Nothing steps the loop until the constructor's last line, so a provider named there means the default, thread-pool-driven provider never starts at all. Swapping yours in afterward with `UseNetworkLoopStepProvider` is too late: by then the default is already stepping the loop from the thread pool, racing whatever your code does until the swap.

With the provider silenced, drive each step yourself through `NetworkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps, StepDelta)`:

```csharp
StepDelta delta = new(0, 0, 0);

coreManager.NetworkLoopManager.InvokeNetworkLoopStep(NetworkLoopSteps.EarlyVariableUpdate, delta);
```

## The twelve-step order

`NetworkLoopSteps` declares twelve steps, and they mean something in this order - state is read and applied at the start of a tick's steps, then serialized and sent at the end of them, with a reconcile in between the two state steps and the fixed-update steps. Driving them out of order applies or sends state at the wrong point in the tick and produces a bug that doesn't exist in the real loop.

The canonical order, one call per step, per `CoreManager`, per tick:

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

For two peers, drive one full pass of all twelve steps on one `CoreManager`, then the same pass on the other, per simulated tick.
