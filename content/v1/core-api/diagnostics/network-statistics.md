---
title: "Network statistics"
---

> **Using Unity?** See [Reading network statistics in Unity](../../unity/diagnostics/network-statistics-in-unity.md).

`TransportManager` keeps four read-only `long` counters. The engine never resets them.

| Counter | What it counts |
|---|---|
| `TotalBytesSent` | Packet bytes sent. Every redundant resend counts again. |
| `TotalBytesReceived` | Packet bytes received. Every redundant arrival counts again. |
| `TotalStatePacketPayloadBitsSent` | State payload bits sent, excluding headers and padding. Each serialized state payload counts once, however many peers it reached. |
| `TotalStatePacketPayloadBitsReceived` | State payload bits received, excluding headers and padding. Every redundant arrival counts again. |

```csharp
long bytesSent = coreManager.TransportManager.TotalBytesSent;
long bytesReceived = coreManager.TransportManager.TotalBytesReceived;
long stateBitsSent = coreManager.TransportManager.TotalStatePacketPayloadBitsSent;
long stateBitsReceived = coreManager.TransportManager.TotalStatePacketPayloadBitsReceived;
```

## The two kinds of counter answer different questions

The byte counters answer "what did the link carry", including headers and every redundant copy. The state bit counters answer "what did replication cost". Sending one state payload to many peers, or resending over an unreliable link, moves the byte counters more than the bit counters. That gap is expected.

## Sample twice to read a rate

The counters are totals for the manager's lifetime. Sample, wait, sample again and subtract:

```csharp
long before = coreManager.TransportManager.TotalBytesSent;
// ... wait one second ...
long after = coreManager.TransportManager.TotalBytesSent;
long bytesPerSecond = after - before;
```

Divide a state bit difference by eight to get bytes.

## No counter attributes cost to one object

The counters cover the whole manager. To measure one feature, read the counters with it on, then off, and compare. A test can assert on `TotalStatePacketPayloadBitsSent` and `TotalStatePacketPayloadBitsReceived` to catch a bandwidth regression.
