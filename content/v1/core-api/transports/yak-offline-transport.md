---
title: "The Yak offline transport"
---

`Yak` is a `SocketPairTransport<ServerSocket, ClientSocket>` whose two sockets are emulated rather than bound to anything. A client and a host exist in the same process, on the same `CoreManager`, with no socket opened and nothing sent over a wire. `Yak.IsLocalTransport()` returns `true`.

## Adding and connecting it

```csharp
Yak yak = new();

if (!await transportManager.TryAddTransportAsync(yak))
{
    // handle failure
}

_ = yak.ConnectAsync(Invoker.Server);
_ = yak.ConnectAsync(Invoker.Client);
```

Both `Invoker.Server` and `Invoker.Client` are connected on the same `Yak` instance. Nothing else changes about how the rest of the engine is used — systems start, spawn, and replicate exactly as they would on a real transport.

## IsLocalTransport and IsLocalPeer

`IsLocalTransport()` is read by exactly one place in the engine: `Connection.IsLocalPeer`. A Connection answers `IsLocalPeer` true when it is emulated, or when its Transport reports itself local and that Transport's own client half is connected — which is always the case on Yak.

`IsLocalPeer` in turn is read by both Pro and Free code. On Pro it gates spawn pacing (`InterestManager.SpawnPacing.Pro.cs`), so a peer running on Yak is never paced as if it were a remote client waiting on bandwidth. On Free it's read by `SceneInterestCondition.cs` and `SceneManager.cs`, where a local peer is exempted from the interest and scene-completion bookkeeping that only makes sense for a peer receiving state over a real link.

## Swapping Yak for Synapse under a running CoreManager

A `CoreManager` that started offline on Yak can drop Yak and bring up Synapse in its place without restarting:

```csharp
await coreManager.TransportManager.RemoveTransports<Yak>();

Synapse synapse = (Synapse)await coreManager.TransportManager.AddTransportAsync<Synapse>();
synapse.Configuration.Port = port;
synapse.RemoteHost = IPAddress.Loopback;

await synapse.ConnectAsync(Invoker.Server);
await synapse.ConnectAsync(Invoker.Client);
```

The world the peer was already running survives the swap: started systems keep their state and their ids, because the swap only replaces the transport underneath an authority that was never anything but its own server. A second peer can then join over the real socket and receive that same retained world, as if the host had been on Synapse from the start.

## When to use Yak

Reach for Yak for single-player, or for any test or tool that wants a real client-host pair — real replication, real spawning, real state flow — without opening a socket. It's also the natural way to start a session offline and only bring a real transport up once a player chooses to host.

Don't use Yak to reason about anything a socket actually does. It proves nothing about serialization timing, packet loss, MTU splitting, or latency over a real connection — those only show up once packets cross a real socket, which is what Synapse is for.

## No Unity component

No `NetworkTransport` component ships for Yak. To use it from a Unity project, add it to the `CoreManager` from a script rather than from the Inspector.
