---
title: "Reading network statistics in Unity"
---

> **Driving the core API directly?** See [Network statistics](../../core-api/diagnostics/network-statistics.md)

The counters live on `TransportManager`, reached through `CoreManager.TransportManager`. Get the `CoreManager` from `NucleusUnity.BoundCoreManager` in any script, from the `CoreManager` property of `UnityCoreManager`, or from the `CoreManager` property a `NucleusBehaviour` already has.

## Read a rate once a second

`TotalBytesSent` and `TotalBytesReceived` are running totals, so sample them once a second and subtract the previous sample:

```csharp
using Nucleus.Connections;
using Nucleus.Integrations.Unity;
using Nucleus.Managers.Core;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Managers.Transports;
using UnityEngine;

public class NetworkStatsReadout : MonoBehaviour, INetworkLoopStepCallback
{
    private CoreManager _coreManager;
    private long _lastBytesSent;
    private long _lastBytesReceived;
    private long _elapsedMilliseconds;

    private void OnEnable()
    {
        _coreManager = NucleusUnity.BoundCoreManager;
        _coreManager?.NetworkLoopManager.RegisterNetworkLoopStepCallbacks(this);
    }

    private void OnDisable() => _coreManager?.NetworkLoopManager.UnregisterNetworkLoopStepCallbacks(this);

    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.LateVariableUpdate;

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
    {
        _elapsedMilliseconds += stepDelta.Delta;

        if (_elapsedMilliseconds < 1000)
            return;

        _elapsedMilliseconds = 0;

        TransportManager transportManager = _coreManager.TransportManager;

        long bytesSent = transportManager.TotalBytesSent;
        long bytesReceived = transportManager.TotalBytesReceived;

        long sentPerSecond = bytesSent - _lastBytesSent;
        long receivedPerSecond = bytesReceived - _lastBytesReceived;

        _lastBytesSent = bytesSent;
        _lastBytesReceived = bytesReceived;

        Debug.Log($"Up: {sentPerSecond} B/s, Down: {receivedPerSecond} B/s");

        if (transportManager.IsServerStarted)
        {
            // A server holds one live link per client.
            foreach (Connection connection in transportManager.ActiveConnections)
                Debug.Log($"Client {connection.Id} RTT: {connection.RoundTripTimeMilliseconds} ms, Loss: {connection.PacketLossPercentage:F1}%");
        }
        else if (transportManager.IsClientStarted && transportManager.TryGetServerConnection(out Connection serverConnection))
        {
            // A client's link figures live on the connection that stands for the server.
            Debug.Log($"Server RTT: {serverConnection.RoundTripTimeMilliseconds} ms, Loss: {serverConnection.PacketLossPercentage:F1}%");
        }
    }
}
```

- The readout registers itself with the network loop as a plain `MonoBehaviour`. A `NucleusBehaviour` only receives loop steps while a networked system is linked to it, and a readout for the whole process has none.
- `PacketLossPercentage` already runs from 0 to 100, so print it with `F1`, not `P1`.
- A client reads its own link from `TryGetServerConnection`. On a client, `ActiveConnections` holds stand-ins for the other players, which carry no link figures.
- `TransportManager.GetLocalConnections(Invoker.Server)` (or `Invoker.Client`) returns this peer's own connection for that role on each transport. On a client, the `Invoker.Server` entry is the same connection `TryGetServerConnection` returns.

## Sample on a loop step, not `Update`

Read the counters from a network loop step callback (`LateVariableUpdate` above, or any other `NetworkLoopSteps` value). `Update` has no fixed order relative to the loop's own work and can read a counter partway through an update.

## The demo HUD is sample code

The demos include a full diagnostics HUD, `NetworkDiagnosticsHud`, with providers for role, round-trip time, bandwidth, state-packet bandwidth and per-object bandwidth. It is part of the demos, not the integration your project links against, so if you copy it into your project you maintain the copy.

There is no per-object bandwidth counter. The demo's `NetworkObjectBandwidthStatisticProvider` estimates one by dividing bandwidth by `SystemManager.StartedSystemCount`, and you can do the same in your own readout.
