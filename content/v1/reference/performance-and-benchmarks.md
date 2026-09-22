---
title: "Performance and benchmarks"
---

## Methodology

The benchmark suites live in `Nucleus.Tests/Benchmarks` and write through the real serializer, the real interest system, and the real spawn/controller paths - not a stand-in model of them. A change that regresses wire cost or per-object overhead fails a test in that project; it does not require someone to notice a number drift in a document. Treat any figure quoted for Nucleus as only as trustworthy as the suite that produced it.

## What each suite measures

Wire cost (what a tick actually serializes onto the wire):

| Suite | Measures |
|---|---|
| `BandwidthTests` | Baseline movement and rotation cost, `TransmissionMode.Interval` versus `TransmissionMode.Divine`, in bytes per send. |
| `NetworkSystemDeltaBandwidthTests` | Delta cost at the `NetworkSystem` level rather than a single member. |
| `DivineBeltBandwidthTests` | Divine transmission under sustained, varied motion (a belt of moving objects), not just a single synthetic delta. |
| `InterestPacingBandwidthTests` | Cost as interest pacing changes what is sent and to whom. |
| `OrdinaryWorldWireCostTests` | Steady-state cost of an ordinary populated world, as a whole-scene baseline. |
| `PackingBandwidthTests` | Cost of the bit-packing layer across representative value ranges. |
| `QuaternionPackingBenchmarkTests` | Cost of packed rotation specifically. |

Resolution and per-object cost (what it costs the server to decide what to send, independent of wire size):

| Suite | Measures |
|---|---|
| `InterestResolutionBenchmarkTests` | Cost of resolving interest across a population of objects and observers. |
| `ObserverWalkBenchmarkTests` | Cost of walking an object's observer set. |
| `NetworkComponentBenchmarkTests` | Per-component overhead on a `NetworkSystem`. |
| `ControllerReleaseBenchmarkTests` | Cost of releasing a controller. |

## Running the suites and reading a result

Run `Nucleus.Tests` in **Release**. Release is the only configuration that runs the optimized code path; a Debug run measures the JIT's debug build, not the engine you ship. Each test logs its own figure (for example, `BandwidthTests` logs bytes per send via `Logger<BandwidthTests>`) and most also assert a bound, so a regression fails the run rather than only showing up in the log.

```
dotnet test Nucleus.sln -c Release --filter FullyQualifiedName~Nucleus.Tests.Benchmarks
```

Read the logged number together with the scenario that produced it - tick rate, object count, and transmission mode are part of the result, not decoration on it.

## Runtime counters

`TransportManager` exposes two counter families that answer different questions and should never be compared to each other directly:

- `TotalBytesSent` and `TotalBytesReceived` count every byte that crossed the transport, including headers, framing, and every redundant resend or arrival.
- `TotalStatePacketPayloadBitsSent` and `TotalStatePacketPayloadBitsReceived` count only serialized StatePacket payload bits, with headers and framing stripped out, and each serialized payload counted once no matter how many peers it reached.

The byte counters answer "what did the link carry." The bit counters answer "what did replication actually cost." They do not reconcile, and a feature that fans one serialized payload out to many peers or resends over an unreliable link will always move the byte counters faster than the bit counters. See [Network statistics](../api/diagnostics/network-statistics.md) for the full counter reference.

## Per-connection measurement

Each `Connection` tracks its own link quality:

- `RoundTripTimeMilliseconds` and `RoundTripTimeDeviationMilliseconds` - a smoothed round trip time and its spread. Both read as `UnsetRoundTripTimeMilliseconds` / `UnsetRoundTripTimeDeviationMilliseconds` until the first reply arrives, so check `IsRoundTripTimeUnset` before trusting either.
- `PacketLossPercentage` - the share of recent probes that went unanswered, measured the way a ping tool measures it.

A server does not re-measure a remote client's link itself once bootstrapped; it adopts the figures the client reports (`ReportedRoundTripTimeMilliseconds`, `ReportedRoundTripTimeDeviationMilliseconds`) into its own `RoundTripTimeMilliseconds` and `RoundTripTimeDeviationMilliseconds`. A misbehaving client only mishandles its own recovery by misreporting; the server never judges another peer by what one client reports.

## Quoting a figure

A bandwidth number is meaningless without its world: tick rate, object count, transmission mode, edition, and transport all change the result, so state all five whenever a figure leaves the test log. A Free build costs more than Pro on plain replication - Pro packs values more tightly - but that difference is a black box here; this page does not explain how the packing works.

Publishing a measured figure outside the engine's own test output is governed by [Licensing and confidentiality](licensing-and-confidentiality.md). Check that page before quoting a number publicly.
