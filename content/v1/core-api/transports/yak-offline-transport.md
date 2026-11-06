---
title: "The Yak offline transport"
---

`Yak` runs a server and client in the same process, on the same `CoreManager`, with no socket opened. Systems start, spawn and replicate as they would on a real transport. Use it for single-player, for tests and tools that need a real client-host pair without a socket, or to start a session offline and bring up a real transport once a player chooses to host.

Yak tells you nothing about what a real socket does: packet loss, latency, splitting large packets, or timing. Test those on [Synapse](./synapse-transport.md).

## Add and connect it

Connect both `Invoker.Server` and `Invoker.Client` on the same `Yak` instance:

```csharp
Yak yak = new();

if (!await transportManager.TryAddTransportAsync(yak))
{
    // handle failure
}

_ = yak.ConnectAsync(Invoker.Server);
_ = yak.ConnectAsync(Invoker.Client);
```

No Unity component ships for Yak. In Unity, add it to the `CoreManager` from a script.

## Peers on Yak count as local

`Yak.IsLocalTransport()` returns `true`. A connection counts as a local peer when it is emulated (`Connection.IsEmulated`), or when its transport is local and that transport's own client half is connected, which is always so on Yak. A local peer skips the interest and scene-completion checks a remote peer goes through, and in Pro it is never held back by object pacing.

## Swap Yak for Synapse without restarting

A `CoreManager` that started offline on Yak can replace it with Synapse:

```csharp
await coreManager.TransportManager.RemoveTransports<Yak>();

Synapse synapse = (Synapse)await coreManager.TransportManager.AddTransportAsync<Synapse>();
synapse.Configuration.Port = port;
synapse.RemoteHost = IPAddress.Loopback;

await synapse.ConnectAsync(Invoker.Server);
await synapse.ConnectAsync(Invoker.Client);
```

Started systems keep their state and ids. Another peer can then join over the real socket and receive the same world.
