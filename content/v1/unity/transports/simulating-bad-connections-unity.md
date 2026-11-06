---
title: "Simulating a bad connection in the editor"
---

> **Driving the core API directly?** See [Simulating latency, jitter and loss](../../core-api/transports/simulating-bad-connections.md).

Play mode runs over loopback, which is instant and lossless. To make it behave like a real connection, have the transports simulate network conditions. What each field means, including `Seed`, is on [Simulating latency, jitter and loss](../../core-api/transports/simulating-bad-connections.md).

## Set the conditions in the inspector

1. Select the `UnityTransportManager`.
2. Tick the checkbox on the **Simulated Network Conditions** section header.
3. Fill in **Latency Milliseconds**, **Jitter Milliseconds**, **Packet Loss Chance**, **Out Of Order Chance** and **Duplicate Chance**. Synapse ignores **Duplicate Chance**, and a transport that supports none of them logs a warning.

The conditions are set on every transport when the transports are added, just before they start, and cleared when the box is unticked. This works with any **Automatic Start Mode**.

Synapse sends its connection setup packets without simulated delay or loss, so a connection always opens however bad the conditions are. A connect that succeeds does not show that the handshake copes with that link.

## Set the conditions from code

`SetNetworkConditions` on `UnityTransportManager` sets every transport, and `SetNetworkConditions<Synapse>` sets only the Synapse ones. Pass null to go back to a clean connection. Conditions set from code replace the inspector's.

The transports must exist before they take conditions. To have the conditions from the first packet:

1. Set **Automatic Start Mode** on `UnityTransportManager` to `None`.
2. Add the transports with `EnsureAddedAsync`.
3. Set the conditions.
4. Start the network.

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

To read what is set, call `GetNetworkConditions<Synapse>()`, or `GetNetworkConditions()` for a pooled list with one entry per transport, which you return to `ListPool` when done.

## Change the conditions while playing

A Synapse transport applies new values at once, even on a link that is already connected, so you can turn conditions on, change them or turn them off while playing.

## Each editor sets its own conditions

Conditions belong to the transports in one editor. In a ParrelSync pair each editor is its own process, so setting conditions in the host editor does nothing to the clone, and you can make only the clone's connection bad.

Each peer applies loss to the packets it sends. A request and its reply each roll separately, so a round trip survives only when both directions do.

## Check the effect on the Connection

While playing, read the measured values from `Connection`:

- `Connection.RoundTripTimeMilliseconds`: the smoothed round trip time.
- `Connection.RoundTripTimeDeviationMilliseconds`: the jitter, meaning how far samples stray from the smoothed average.
- `Connection.PacketLossPercentage`: the measured loss.

They are measured on the live connection, not echoed from your settings, so they show whether the conditions are taking effect.

## Test at more than one setting

Set jitter as well as latency: a steady 100 ms and a link swinging between 20 ms and 180 ms average the same but feel nothing alike, and some bugs only show when timing varies. Try loss of 1 to 5% for typical broadband, and 10 to 20% to stress recovery.

The simulation delays, drops and reorders packets inside the process. It does not model a slow upload beside a fast download, or a real path that silently drops packets over some size, so also test over an actual network.
