---
title: "Simulating latency, jitter and loss"
---

> **Using Unity?** See [Simulating a bad connection in the editor](../../unity/transports/simulating-bad-connections-unity.md).

A loopback connection is instant and lossless, which means anything that only matters on a bad link never gets exercised until players hit it. A transport can make loopback behave like a real connection, so you can drive that behavior on demand.

## Describe the connection with NetworkConditions

`NetworkConditions` is a struct in `Nucleus.Transports`. Each field describes one way a real connection goes wrong, and the default value simulates nothing.

- `LatencyMilliseconds` is a one-way delay added to every packet sent.
- `JitterMilliseconds` is extra delay on top of the latency. Each packet gets a fresh random amount below this figure, so packets genuinely arrive at different times instead of all shifting by the same amount. A steady 100 ms link and one swinging between 20 ms and 180 ms average the same and feel nothing alike, and only jitter produces the second.
- `PacketLossChance` is the chance, from 0 to 1, that a packet is dropped. `0.2f` drops one packet in five.
- `OutOfOrderChance` is the chance, from 0 to 1, that a packet is held back long enough to arrive after packets sent later.
- `DuplicateChance` is the chance, from 0 to 1, that a packet is also sent a second time.

```csharp
using Nucleus.Transports;

NetworkConditions networkConditions = new()
{
    LatencyMilliseconds = 100,
    JitterMilliseconds = 40,
    PacketLossChance = 0.1f,
};
```

## Pass the conditions to the TransportManager

The `TransportManager` sets the conditions on every transport at once, or on every transport of one type.

```csharp
// Every transport.
coreManager.TransportManager.SetNetworkConditions(networkConditions);

// Only Synapse transports.
coreManager.TransportManager.SetNetworkConditions<Synapse>(networkConditions);

// Pass null to go back to a clean connection.
coreManager.TransportManager.SetNetworkConditions(null);
```

If no transport of the type you name has been added, the call logs a message and does nothing.

To read the conditions back, ask for one type or for every transport. Asking for every transport gives you a pooled list with one entry per transport, in the same order as `TransportManager.Transports`, so return it when you are done.

```csharp
NetworkConditions? synapseConditions = coreManager.TransportManager.GetNetworkConditions<Synapse>();

List<NetworkConditions?> everyTransportsConditions = coreManager.TransportManager.GetNetworkConditions();
// Read the entries here.
ListPool<NetworkConditions?>.Return(everyTransportsConditions);
```

A transport can also be set directly with `transport.SetNetworkConditions(networkConditions)`, and read with `transport.GetNetworkConditions()`.

## Not every transport supports every condition

A transport that cannot simulate a bad connection logs a warning when you set conditions on it, and reads back null. A transport that can may still support only some of the fields.

`Synapse` supports everything except `DuplicateChance`, which it ignores. A packet it puts out of order is held back by up to 100 ms.

## Set the conditions before Synapse connects

`Synapse` decides whether to simulate anything at all when it connects. Set the conditions after adding the transport and before calling `ConnectAsync`, and the connection starts out simulating them.

Once connected, a `Synapse` that started with conditions takes new values straight away. One that connected with no conditions ignores them until its next connection. If you want to change the conditions mid-session, start with a small one, such as a latency of 1 ms, so the simulation is running from the start.

## Each CoreManager has its own conditions

Conditions belong to a transport, so a test process that runs a server `CoreManager` and a client `CoreManager` side by side sets each one on its own. Setting the server's conditions changes nothing about how the client sends.

## Loss is per direction

Loss is applied by each peer to the packets it sends. A request and its reply each roll independently, so a round trip survives only when both directions do. With `PacketLossChance = 0.2f` on both peers, a round trip's chance of surviving is lower than 80%, because either leg can be the one that is dropped.

## Watch for the repair, not the breakage

The engine has its own answers to a lossy link: redundancy, targeted recovery, and a retention window. The point of testing under loss is not to watch things break but to confirm the repair actually runs. Watch for these two things:

- Check convergence: the peer should eventually hold exactly what the server holds, even with packets dropped along the way.
- Check recovery activity: the server should actually serve a repair. A test that asserts convergence without also asserting a recovery happened can pass on a clean run and prove nothing about the repair path.

## Read the result back from the Connection

`Connection` reports what actually happened on the link:

- `RoundTripTimeMilliseconds` is the smoothed round trip time.
- `RoundTripTimeDeviationMilliseconds` is how far samples typically stray from that average, which is the measured jitter.
- `PacketLossPercentage` is the connection's measured loss.

These are measured by the engine's own probes rather than echoed from the conditions, so they are a good check that the conditions are having the effect you expect before you trust the rest of the test.
