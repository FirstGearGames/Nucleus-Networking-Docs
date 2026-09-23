---
title: "Reading network statistics in Unity"
---

> **Driving the core API directly?** See [Network statistics](../../core-api/diagnostics/network-statistics.md)

## Getting to the counters

Every counter lives on `TransportManager`, off the process's `CoreManager`. Three ways to reach it from a Unity script:

- From a component that already sits next to `UnityCoreManager`: read its `CoreManager` property.
- From any plain `MonoBehaviour`: `NucleusUnity.BoundCoreManager`, the CoreManager the integration bound at startup.
- From a script deriving from `NucleusBehaviour` or `NucleusBehaviour<TComponent0>`: the behaviour already exposes a `CoreManager` property, resolved in `Awake`.

Once you have a `CoreManager`, its `TransportManager` property holds the counters and connection lists this page covers.

## A worked readout component

`TransportManager.TotalBytesSent` and `TotalBytesReceived` are running totals, not rates - sample them once a second and diff against the previous sample:

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

The readout is a plain `MonoBehaviour` that registers itself with the network loop while it is enabled, not a `NucleusBehaviour`: a `NucleusBehaviour` only receives loop steps while a networked system is linked to it, and a readout for the whole process has no system of its own. `PacketLossPercentage` already runs from 0 to 100, so it prints with `F1` rather than `P1`, which would multiply it by 100 again. A client reads its own link from `TryGetServerConnection` rather than `ActiveConnections`: on a client that collection holds stand-ins for the other players, which have no link of their own to measure.

## Sample on a loop step, not `Update`

Take the reading from a network loop step (`LateVariableUpdate` above, or any other `NetworkLoopSteps` value) rather than Unity's `Update`. The network loop's own steps run serialization and deserialization at defined points in the tick; a plain `Update` callback has no guaranteed order relative to those steps and can read a counter mid-update. A loop-step callback only fires when the framework has finished the work for that step.

## Sample content, not shipped API

`Nucleus.Integrations.Unity/Demos/Common/Scripts` ships a full diagnostics HUD - `NetworkDiagnosticsHud`, `NetworkStatisticProvider`, `RollingNetworkStatisticProvider`, and five concrete providers covering role, round-trip time, bandwidth, state-packet bandwidth, and object bandwidth. It is real, working code, worth reading for patterns.

It is sample content, not part of the `Nucleus.Integrations.Unity` assembly: the folder has no runtime asmdef of its own, so it is not something your project references. Copying `NetworkDiagnosticsHud` or a provider into your project is forking that sample, not consuming a shipped API - you own the copy and its upkeep from that point on.

## Totals are process-wide

`TotalBytesSent` and `TotalBytesReceived` count every byte the process sends or receives, across every connection and every networked object. There is no per-object bandwidth counter. To estimate what one object costs, disable it (or the behaviour driving its state) and compare the rate before and after - the difference is the object's share, not something the engine reports directly. The shipped `NetworkObjectBandwidthStatisticProvider` uses this same divide-by-count approach, using `SystemManager.StartedSystemCount` as the denominator.

## Other routes worth knowing

- `TransportManager.ActiveConnections` lists every connected client on a server, for a per-connection round-trip time and loss readout like the one above. On a client it lists stand-ins for the other players, which carry no link figures.
- `TransportManager.GetLocalConnections(Invoker.Server)` (or `Invoker.Client`) returns this peer's own connection for that role on each added transport. On a client, the `Invoker.Server` entry is the one holding the server link's round-trip time and loss, the same connection `TryGetServerConnection` returns.
- `SystemManager.StartedSystemCount` is the started-object count the shipped per-object provider divides bandwidth by; use it for the same kind of estimate in your own readout.
