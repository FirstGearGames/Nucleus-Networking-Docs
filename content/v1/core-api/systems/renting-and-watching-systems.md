---
title: "Renting and finding systems in code"
---

> **Using Unity?** See [NucleusBehaviour: the script base class](../../unity/systems/nucleus-behaviour.md).

## Rent a system

`NetworkSystemPool.TryRent<TSystem, TComponent0...>(coreManager, out networkSystem, canStartSystem)` gives you a `NetworkSystem` with no engine object behind it. Overloads take zero to thirty-one components (`TComponent0` through `TComponent30`). Each rents `TSystem`, attaches the named components, and starts the system unless you pass `canStartSystem: false`. It returns `false`, and logs the reason, when no `CoreManager` could be found or the start was refused.

```csharp
if (!NetworkSystemPool.TryRent<NetworkSystem, MatchClockComponent>(coreManager, out NetworkSystem networkSystem, canStartSystem: true))
    return; // no CoreManager instance could be resolved, or the start was refused

if (networkSystem.TryGetComponent(out MatchClockComponent matchClockComponent))
{
    matchClockComponent.Round.Value = 1;
    matchClockComponent.SecondsRemaining.Value = 10f;
}
```

`TSystem` is nearly always plain `NetworkSystem`; the component list is what tells one rent from another.

### Rent a count decided at runtime

When the number of components comes from data, such as one per seat in a vehicle, rent one component type a runtime number of times:

```csharp
public partial class SeatComponent : NetworkComponent
{
    public readonly NetworkMember<bool> IsOccupied = new();
}
```

```csharp
byte seatCount = 4;

if (!NetworkSystemPool.TryRent<NetworkSystem, SeatComponent>(coreManager, seatCount, out NetworkSystem vehicleSystem))
    return; // no CoreManager, a count outside 1 to NetworkSystem.MaximumComponentCount, or the start was refused

for (byte componentId = 0; componentId < seatCount; componentId++)
{
    if (vehicleSystem.TryGetComponent(componentId, out SeatComponent seatComponent))
        seatComponent.IsOccupied.Value = false;
}
```

The components take Ids `0` to `seatCount - 1`, the same on every peer. A count of zero, or more than `NetworkSystem.MaximumComponentCount` (31), is refused and logged.

### Return a rented system

Give a rented system back rather than letting it fall out of scope:

- `NetworkSystemPool.Return<TSystem>(networkSystem)` returns it to the pool.
- `NetworkSystemPool.ReturnAndNullifyReference<TSystem>(ref networkSystem)` does the same and sets your reference to null.

Do not call either on a started system. Stop it with `SystemManager.EnsureStopSystem(networkSystem, isPoolReturnRequestedOnDespawn: true)`, and it returns to the pool when the despawn completes. A receiver's copy returns to its pool automatically; never call `Return` on it.

## Watch for a composition to find it on other peers

A rented system has `NetworkSystem.UnsetPlatformId`, so `INetworkSystemSpawnHandler` never sees it: there is no `TryBindSceneObject` or `OnDynamicSystemSpawned` call. Other peers have no identifier to look it up by.

Register a watch instead. `NetworkSystemPool.Watch<TSystem, TComponent0...>(coreManager, acquired, released)` subscribes to every system of that type and component composition on the peer that registers it, whether the system started there or arrived from the network. It returns a `NetworkSystemWatch`; pass it to `NetworkSystemPool.Unwatch(watch)` when you are done.

```csharp
private NetworkSystemWatch _matchWatch;

private void OnMatchAcquired(NetworkSystem networkSystem) => _matchSystem = networkSystem;

private void OnMatchReleased(NetworkSystem networkSystem)
{
    if (_matchSystem == networkSystem)
        _matchSystem = null;
}

public void Start()
{
    _matchWatch = NetworkSystemPool.Watch<NetworkSystem, MatchClockComponent>(coreManager, OnMatchAcquired, OnMatchReleased);
}

public void Stop()
{
    NetworkSystemPool.Unwatch(_matchWatch);
    _matchWatch = null;
}
```

- `NetworkSystemAcquiredHandler` fires for every matching system.
- `NetworkSystemReleasedHandler` fires as an acquired system stops. Drop your reference there; a reference kept after the handler returns can end up naming a different spawn.
- Matching is by composition, not type, so name the components that set this system apart.
- Registering a watch replays it against every system already started, so it works before or after the system exists.

## Use SystemManager.SystemStarted to see every system

`SystemManager.SystemStarted` and `SystemManager.SystemStopped` raise for every system that starts or stops on this peer, whatever its composition. Use them for logging, bookkeeping across all system types, or one subscriber that dispatches by type. For systems of a known composition, use a watch.
