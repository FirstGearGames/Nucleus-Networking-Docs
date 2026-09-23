---
title: "Network statistics"
---

> **Using Unity?** See [Reading network statistics in Unity](../../unity/diagnostics/network-statistics-in-unity.md).

`TransportManager` keeps four cumulative counters. They answer two different questions, and reading the wrong one for the wrong question is the usual mistake.

## The counters

| Counter | Type | What it counts |
|---|---|---|
| `TotalBytesSent` | `long` | Transmitted packet payload bytes, counted at the send chokepoint. Every redundant resend counts again. |
| `TotalBytesReceived` | `long` | Received packet payload bytes, counted at the receive chokepoint. Every redundant arrival counts again. |
| `TotalStatePacketPayloadBitsSent` | `long` | Bits of serialized StatePacket payload sent, excluding padding and every packet header. Each serialized StatePacket counts once, no matter how many peers it reached. |
| `TotalStatePacketPayloadBitsReceived` | `long` | Bits of StatePacket payload received, excluding padding and every packet header. Every redundant arrival counts again, same as `TotalBytesReceived`. |

All four are `public long` with a private setter, live on `TransportManager`, and are never reset by the engine.

```csharp
long bytesSent = coreManager.TransportManager.TotalBytesSent;
long bytesReceived = coreManager.TransportManager.TotalBytesReceived;
long stateBitsSent = coreManager.TransportManager.TotalStatePacketPayloadBitsSent;
long stateBitsReceived = coreManager.TransportManager.TotalStatePacketPayloadBitsReceived;
```

## Why the two families disagree

`TotalBytesSent`/`TotalBytesReceived` count everything that crossed the transmit and receive chokepoints: headers, framing, and every redundant resend or arrival. They answer "what did the link carry."

`TotalStatePacketPayloadBitsSent`/`TotalStatePacketPayloadBitsReceived` count only the state payload bits inside StatePackets, with headers and framing stripped out. The sent counter also counts each serialized payload once, regardless of how many connections it was transmitted to. They answer "what did replication actually cost."

A feature that fans one serialized StatePacket out to many peers, or that resends over an unreliable link, will move the byte counters more than the bit counters. That gap is expected, not a bug.

## Reading a rate

The counters are cumulative for the manager's lifetime. To get a rate, sample a counter, wait an interval, sample again, and subtract:

```csharp
long before = coreManager.TransportManager.TotalBytesSent;
// ... wait one second ...
long after = coreManager.TransportManager.TotalBytesSent;
long bytesPerSecond = after - before;
```

The state-bit counters work the same way; divide the delta by eight to get bytes.

## No per-object attribution

There is no counter for what one object, one system, or one member cost. The counters are manager-wide totals. To isolate the cost of a feature, measure the counters with it on, then off, and compare. A test can read `TotalStatePacketPayloadBitsSent` and `TotalStatePacketPayloadBitsReceived` directly, turning a wire-cost regression into a failing assertion instead of a surprise.
