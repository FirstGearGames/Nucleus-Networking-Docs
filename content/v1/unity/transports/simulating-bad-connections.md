---
title: "Simulating a bad connection in the editor"
---

> **Driving the core API directly?** See [Simulating latency, jitter and loss](../../core-api/transports/simulating-bad-connections.md).

Playing in the editor runs over loopback, which is instant and lossless. You can make it behave like a real connection by giving the transports a set of network conditions.

## Describe the connection with NetworkConditions

`NetworkConditions` is a struct in `Nucleus.Transports`. Each field describes one way a real connection goes wrong, and the default value simulates nothing.

- `LatencyMilliseconds` is a one-way delay added to every packet sent.
- `JitterMilliseconds` is extra delay on top of the latency, a fresh random amount below this figure for each packet, so packets do not all arrive shifted by the same amount.
- `PacketLossChance` is the chance, from 0 to 1, that a packet is dropped. `0.2f` drops one packet in five.
- `OutOfOrderChance` is the chance, from 0 to 1, that a packet is held back long enough to arrive after packets sent later.
- `DuplicateChance` is the chance, from 0 to 1, that a packet is also sent a second time.

The Synapse transport supports every field except `DuplicateChance`, which it ignores. A transport that supports none of them logs a warning when you set them.

## Set them in the inspector

`UnityTransportManager` has a **Network Conditions** section in the inspector. Tick **Network Conditions Enabled** and fill in the values. When the transports are added, just before they start, it sets those conditions on every transport, or clears them when the box is unticked. This works with any **Automatic Start Mode**.

Each editor reads its own inspector, so in a ParrelSync pair you can make only the clone's connection bad.

## Set them from code

Call `SetNetworkConditions` on `UnityTransportManager` to set every transport, or `SetNetworkConditions<Synapse>` to set only the Synapse ones. Passing null goes back to a clean connection. Conditions set from code replace the inspector's.

The transports have to exist before they can take the conditions, and Synapse decides whether to simulate at all when it connects. So set **Automatic Start Mode** on `UnityTransportManager` to `None`, and start the network yourself: add the transports, set the conditions, then start.

```csharp
using Nucleus.Integrations.Unity.Managers.Transports;
using Nucleus.Transports;
using UnityEngine;

public class ConnectionSimulator : MonoBehaviour
{
    [SerializeField]
    private UnityTransportManager _unityTransportManager;

    private async void Start()
    {
        await _unityTransportManager.EnsureAddedAsync();

        _unityTransportManager.SetNetworkConditions(new NetworkConditions
        {
            LatencyMilliseconds = 100,
            JitterMilliseconds = 40,
            PacketLossChance = 0.05f,
        });

        await _unityTransportManager.StartHostAsync();
    }
}
```

Use `StartServerAsync` or `StartClientAsync` in place of `StartHostAsync` for the other roles.

## Changing the conditions while playing

A Synapse transport that connected with conditions takes new values straight away, so you can raise or lower them mid-session. One that connected with no conditions ignores them until it next connects. If you plan to change them while playing, start with a small condition, such as a latency of 1 ms, so the simulation is running from the start.

To see what is set, call `GetNetworkConditions<Synapse>()`, or `GetNetworkConditions()` for a pooled list with one entry per transport that you return to `ListPool` when done.

## Each editor sets its own

Conditions belong to the transports in one editor. In a ParrelSync pair, each editor is its own process with its own transports, so setting conditions in the host editor does nothing to the clone.

Each peer applies loss to the packets it sends. A request and its reply each roll independently, so a round trip only survives when both directions do.

## Reading the effect back

While playing, read the measured effect off `Connection`:

- `Connection.RoundTripTimeMilliseconds` is the smoothed round trip time.
- `Connection.RoundTripTimeDeviationMilliseconds` is the jitter, meaning how far samples stray from the smoothed average.
- `Connection.PacketLossPercentage` is the share of recent probes that went unanswered.

These are measured by the engine's own round trip probes, so they are the right numbers to check that the conditions are actually taking effect, not just an echo of the values you set.

## Values worth testing at

A steady 100 ms latency and a link swinging between 20 ms and 180 ms average the same but feel nothing alike, so set jitter as well as latency to catch bugs that only show up when timing varies. Try loss in the 1 to 5% range for typical broadband, and higher, around 10 to 20%, to stress recovery.

## What this cannot reproduce

The simulation delays, drops and reorders packets inside the process. It does not model a slow upload beside a fast download, or a real path that silently drops packets over some size. Loopback with conditions set tells you how your game feels on a poor connection, but it is not a substitute for testing over an actual network.
