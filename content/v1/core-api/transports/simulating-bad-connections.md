---
title: "Simulating latency, jitter and loss"
---

> **Using Unity?** See [Simulating a bad connection in the editor](../../unity/transports/simulating-bad-connections-unity.md).

A loopback connection is instant and lossless. A transport can make it behave like a real connection so you can test bad-link behavior on demand.

## Describe the connection with NetworkConditions

`NetworkConditions` is a struct in `Nucleus.Transports`. Its default simulates nothing.

| Field | Meaning |
|---|---|
| `LatencyMilliseconds` | One-way delay added to every packet sent. |
| `JitterMilliseconds` | Extra delay on top of the latency: each packet gets a fresh random amount below this figure, so packets arrive at different times. |
| `PacketLossChance` | Chance, from 0 to 1, that a packet is dropped. `0.2f` drops one in five. |
| `OutOfOrderChance` | Chance, from 0 to 1, that a packet is held back until after packets sent later. |
| `DuplicateChance` | Chance, from 0 to 1, that a packet is also sent a second time. |
| `Seed` | Fixes the random choices, so a test repeats them for the same packets. `0` (default) varies them every run. A networked run can still differ, because how many packets are sent and when depends on timing. To replay a failing run, pick a seed, log it and set it. |

```csharp
using Nucleus.Transports;

NetworkConditions networkConditions = new()
{
    LatencyMilliseconds = 100,
    JitterMilliseconds = 40,
    PacketLossChance = 0.1f,
};
```

## Apply the conditions

1. Add the transport.
2. Set the conditions, **before** `ConnectAsync`. `Synapse` decides whether to simulate anything when it connects: one that connected with conditions takes new values at once, but one that connected with none ignores them until it next connects. To change conditions mid-session, start with something small, such as 1 ms of latency.
3. Connect.

```csharp
// Every transport.
coreManager.TransportManager.SetNetworkConditions(networkConditions);

// Only Synapse transports.
coreManager.TransportManager.SetNetworkConditions<Synapse>(networkConditions);

// Pass null to go back to a clean connection.
coreManager.TransportManager.SetNetworkConditions(null);
```

If no transport of the named type has been added, the call logs a message and does nothing. You can also call `transport.SetNetworkConditions(networkConditions)` and `transport.GetNetworkConditions()` on one transport.

To read the conditions back, ask for one type or for every transport. The list for every transport is pooled, one entry per transport in `TransportManager.Transports` order; return it when done:

```csharp
NetworkConditions? synapseConditions = coreManager.TransportManager.GetNetworkConditions<Synapse>();

List<NetworkConditions?> everyTransportsConditions = coreManager.TransportManager.GetNetworkConditions();
// Read the entries here.
ListPool<NetworkConditions?>.Return(everyTransportsConditions);
```

Conditions belong to a transport. A test running a server `CoreManager` and a client `CoreManager` side by side sets each one separately.

## Know what each transport supports

- A transport that cannot simulate logs a warning when you set conditions, and reads back null. One that can may support only some fields.
- `Synapse` supports everything except `DuplicateChance`, which it ignores. It holds an out-of-order packet back by up to 100 ms.
- `Synapse` sends its connection setup packets, the handshake and NAT traversal probes, with no simulated delay or loss. A connection always opens, so a successful connect proves nothing about the handshake on that link.

## Loss applies to each direction separately

Each peer drops packets it sends. With `PacketLossChance = 0.2f` on both peers, a round trip survives less than 80% of the time, because either leg can be dropped.

## Check the result

- Confirm the peer ends up holding exactly what the server holds, despite the drops.
- Read what the link actually measured from `Connection`, to confirm the conditions took effect:
  - `RoundTripTimeMilliseconds`: the smoothed round trip time.
  - `RoundTripTimeDeviationMilliseconds`: how far samples typically stray from it, which is the measured jitter.
  - `PacketLossPercentage`: the measured loss.
