---
title: "Reading network statistics in Unity"
---

> **Driving the core API directly?** See [Network statistics](../../core-api/diagnostics/network-statistics)

## Getting to the counters

Every counter lives on `TransportManager`, off the process's `CoreManager`. Three ways to reach it from a Unity script:

- From a component that already sits next to `UnityCoreManager`: read its `CoreManager` property.
- From any plain `MonoBehaviour`: `NucleusUnity.BoundCoreManager`, the CoreManager the integration bound at startup.
- From a `NucleusBehaviourBase` subclass (or the generic `NucleusBehaviour<TComponent0>` it backs): the behaviour already exposes a `CoreManager` property, resolved in `Awake`.

Once you have a `CoreManager`, its `TransportManager` property holds the counters and connection lists this page covers.

## A worked readout component

`TransportManager.TotalBytesSent` and `TotalBytesReceived` are running totals, not rates - sample them once a second and diff against the previous sample:

```csharp
using Nucleus.Connections;
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Managers.NetworkLoop;
using Nucleus.Managers.Transports;
using Nucleus.Systems;
using UnityEngine;

public class NetworkStatsReadout : NucleusBehaviourBase
{
    private long _lastBytesSent;
    private long _lastBytesReceived;
    private long _elapsedMilliseconds;

    protected override void OnLateVariableUpdate(StepDelta stepDelta)
    {
        _elapsedMilliseconds += stepDelta.Delta;

        if (_elapsedMilliseconds < 1000)
            return;

        _elapsedMilliseconds = 0;

        TransportManager transportManager = CoreManager.TransportManager;

        long bytesSent = transportManager.TotalBytesSent;
        long bytesReceived = transportManager.TotalBytesReceived;

        long sentPerSecond = bytesSent - _lastBytesSent;
        long receivedPerSecond = bytesReceived - _lastBytesReceived;

        _lastBytesSent = bytesSent;
        _lastBytesReceived = bytesReceived;

        Debug.Log($"Up: {sentPerSecond} B/s, Down: {receivedPerSecond} B/s");

        foreach (Connection connection in transportManager.ActiveConnections)
            Debug.Log($"RTT: {connection.RoundTripTimeMilliseconds} ms, Loss: {connection.PacketLossPercentage:P1}");
    }
}
```

`NucleusBehaviourBase` requires a `NetworkSystemObject` on the same GameObject, so this readout needs one nearby even though it does not use the linked system.

## Sample on a loop step, not `Update`

Take the reading from a `NucleusBehaviourBase` per-step virtual (`OnLateVariableUpdate` above, or any of the others `NucleusBehaviourBase` exposes) rather than Unity's `Update`. The network loop's own steps run serialization and deserialization at defined points in the tick; a plain `Update` callback has no guaranteed order relative to those steps and can read a counter mid-update. A loop-step virtual only fires when the framework has finished the work for that step.

## Sample content, not shipped API

`Nucleus.Integrations.Unity/Demos/Common/Scripts` ships a full diagnostics HUD - `NetworkDiagnosticsHud`, `NetworkStatisticProvider`, `RollingNetworkStatisticProvider`, and five concrete providers covering role, round-trip time, bandwidth, state-packet bandwidth, and object bandwidth. It is real, working code, worth reading for patterns.

It is sample content, not part of the `Nucleus.Integrations.Unity` assembly: the folder has no runtime asmdef of its own, so it is not something your project references. Copying `NetworkDiagnosticsHud` or a provider into your project is forking that sample, not consuming a shipped API - you own the copy and its upkeep from that point on.

## Totals are process-wide

`TotalBytesSent` and `TotalBytesReceived` count every byte the process sends or receives, across every connection and every networked object. There is no per-object bandwidth counter. To estimate what one object costs, disable it (or the behaviour driving its state) and compare the rate before and after - the difference is the object's share, not something the engine reports directly. The shipped `NetworkObjectBandwidthStatisticProvider` uses this same divide-by-count approach, using `SystemManager.StartedSystemCount` as the denominator.

## Other routes worth knowing

- `TransportManager.ActiveConnections` lists every connection this peer currently has open, for a per-connection round-trip time and loss readout like the one above.
- `TransportManager.GetLocalConnections(Invoker.Server)` (or `Invoker.Client`) narrows that to one role's connections when a host process needs to separate its two roles.
- `SystemManager.StartedSystemCount` is the started-object count the shipped per-object provider divides bandwidth by; use it for the same kind of estimate in your own readout.
