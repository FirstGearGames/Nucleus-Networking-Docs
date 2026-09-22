---
title: "Simulating latency, jitter and loss"
---

> **Using Unity?** See [Simulating a bad connection in the editor](../../unity/transports/simulating-bad-connections-unity).

A loopback connection is instant and lossless, which means anything that only matters on a bad link never gets exercised until players hit it. `Synapse` has three static knobs that make loopback behave like a real connection so you can drive that behavior on demand.

## The three knobs

All three live on `Synapse` itself, as static fields:

- `Synapse.SimulatedLatencyMilliseconds` — a one-way delay added to every outbound packet.
- `Synapse.SimulatedJitterMilliseconds` — added on top of the base latency. Each outbound packet gets a fresh random value below this figure, not a fixed offset, so successive packets genuinely arrive at different times instead of all shifting by the same amount. A steady 100ms link and one swinging between 20ms and 180ms average the same and feel nothing alike; only a per-packet knob produces the second.
- `Synapse.SimulatedPacketLossChance` — a fraction from 0 to 1. `0.2` drops one outbound packet in five. Zero disables it.

```csharp
Synapse.SimulatedLatencyMilliseconds = 100;
Synapse.SimulatedJitterMilliseconds = 40;
Synapse.SimulatedPacketLossChance = 0.1;
```

## Two setup traps

**Set them before you connect.** Each value is read when a socket builds its engine configuration — in `ClientSocket.ConnectAsync` and `ServerSocket.ConnectAsync`. Setting it on an already-connected pair changes nothing; the run keeps measuring a clean wire while you think you're testing a lossy one. Set the knobs, then call `ConnectAsync` on the server and client transports.

**They're static, so a two-CoreManager process shares them.** If your test process runs a server `CoreManager` and a client `CoreManager` in the same process (the common pattern for a live test), both sockets read the same three fields — there's no per-socket override. If a test times out and gets abandoned rather than unwound, a value it set can outlive it and leak into the next test's sockets. Reset the knobs in a `finally`, and also reset them in shared test setup so an abandoned run can't take down unrelated cases.

## Loss is per direction

Loss is applied on each peer's outbound side. A request and its reply each roll independently, so a round trip survives only when both directions do. At `SimulatedPacketLossChance = 0.2`, a round trip's survival chance is lower than 80% — either leg can be the one that's dropped.

## What to watch while you test

The engine has its own answers to a lossy link — redundancy, targeted recovery, and a retention window — so the point of testing under loss isn't to watch things break, it's to confirm the repair actually runs. Watch for:

- Convergence: does the peer eventually end up holding exactly what the authority holds, even with packets dropped along the way?
- Recovery activity: did the authority actually serve a repair, or did the run get lucky and lose nothing? A test that asserts convergence without also asserting a recovery happened can pass on a clean run and prove nothing about the repair path.

## Reading the result back

`Connection` reports what actually happened on the link:

- `RoundTripTimeMilliseconds` — the smoothed round trip time.
- `RoundTripTimeDeviationMilliseconds` — how far samples typically stray from that average, i.e. the measured jitter.
- `PacketLossPercentage` — the connection's measured loss.

These read back what the simulator produced, so they're a good sanity check that your knobs are actually having the effect you expect before you trust the rest of the test.

## How the engine's own suites do it

`SynapseLiveIntervalDropRecoveryTests` is a working example of the pattern: set `Synapse.SimulatedPacketLossChance` before bringing the pair up, run enough rounds that loss is actually likely to hit, assert both that the peer converges on the authority's value and that a recovery was actually served, then reset the knob to zero in a `finally`.

`Nucleus.Tests.Integrations.Initialization` also resets `Synapse.SimulatedPacketLossChance = 0` in its shared per-test setup, precisely to guard against the case above: a test that times out and never reaches its own `finally`.
