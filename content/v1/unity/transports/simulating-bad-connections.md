---
title: "Simulating a bad connection in the editor"
---

> **Driving the core API directly?** See [Simulating latency, jitter and loss](../../core-api/transports/simulating-bad-connections.md).

## The three fields

`Synapse` exposes three static diagnostic knobs:

- `Synapse.SimulatedLatencyMilliseconds` — one-way latency added to every outbound packet.
- `Synapse.SimulatedJitterMilliseconds` — a random amount below this, added on top of the base latency, so packets don't all arrive shifted by the same constant.
- `Synapse.SimulatedPacketLossChance` — a fraction from 0 to 1; `0.2` drops one outbound packet in five.

All three default to zero (disabled).

```csharp
using Nucleus.Transports.Synapse;

public class ConnectionSimulator : MonoBehaviour
{
    private void Awake()
    {
        Synapse.SimulatedLatencyMilliseconds = 100;
        Synapse.SimulatedJitterMilliseconds = 40;
        Synapse.SimulatedPacketLossChance = 0.05;
    }
}
```

## The trap: set them before the socket connects

These fields are read when a socket builds its engine configuration — that is, when it connects, not while it's already running. Set them too late and the running session simply never picks them up.

If `UnityTransportManager`'s Automatic Start Mode is anything but `None`, that manager starts the transport from its own `Start()`. A script sitting at Unity's default script execution order runs against no guaranteed ordering relative to that `Start()` — by the time your script's `Start()` or a same-order `Awake()` runs, the transport may already have connected with the fields still at their defaults.

Two ways to win the race:

- Set the fields from `Awake()` (Unity calls every `Awake()` before any `Start()`).
- Or give your simulator script an earlier execution order than `UnityTransportManager` in Project Settings → Script Execution Order.

Either way, set them before `StartServerAsync`, `StartClientAsync`, or `StartHostAsync` runs — whichever `UnityTransportManager` calls for your configured start mode.

## Static fields, both editors

The fields are `static`, scoped to the process, not to a Connection or a transport instance. In a ParrelSync pair, each editor is its own process, so each one needs the fields set independently — setting them in the host editor does nothing to the clone.

Each peer rolls loss on its own outbound side. A request and its reply each roll independently, so a round trip only survives when both directions do.

## Reading the effect back

While playing, read the measured effect off `Connection`:

- `Connection.RoundTripTimeMilliseconds` — smoothed round trip time.
- `Connection.RoundTripTimeDeviationMilliseconds` — the jitter: how far samples stray from the smoothed average.
- `Connection.PacketLossPercentage` — the share of recent probes that went unanswered.

These read the link as the engine actually measures it (via its own round-trip probes), so they're the right numbers to check that your simulated settings are actually taking effect, not just an echo of the values you set.

## Values worth testing at

A steady 100ms latency and a link swinging between 20ms and 180ms average the same but feel nothing alike — set jitter, not just latency, to catch bugs that only show up when timing varies. Try loss in the 1-5% range for typical broadband conditions, and higher (10-20%) to stress recovery paths.

## What this can't reproduce

The simulator delays and drops packets in-process; it does not reorder them across a real path, model asymmetric upload/download links, or reproduce MTU black holes (a real path silently dropping packets over some size). Loopback with these knobs on tells you how your game feels under latency, jitter, and loss — it is not a substitute for testing over an actual network.
