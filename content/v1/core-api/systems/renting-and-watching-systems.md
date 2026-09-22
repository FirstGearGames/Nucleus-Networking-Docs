---
title: "Renting and finding systems in code"
---

> **Using Unity?** See [NucleusBehaviour: the script base class](../../unity/systems/nucleus-behaviour).

## Renting a system

`NetworkSystemPool.Rent<TSystem, TComponent0...>(coreManager, canStartSystem)` gets you a `NetworkSystem` with no engine object behind it at all. The generated overloads run from zero components up to sixty-four (`TComponent0` through `TComponent63`), and each one rents `TSystem`, attaches every named component, and starts the system unless you pass `canStartSystem: false`.

```csharp
NetworkSystem networkSystem = NetworkSystemPool.Rent<NetworkSystem, MatchClockComponent>(coreManager, canStartSystem: true);

if (networkSystem is null)
    return; // no CoreManager instance could be resolved

if (networkSystem.TryGetComponent(out MatchClockComponent matchClockComponent))
{
    matchClockComponent.Round.Value = 1;
    matchClockComponent.SecondsRemaining.Value = 10f;
}
```

`TSystem` is nearly always the plain `NetworkSystem` type itself; what distinguishes one rent from another is the component list, not the system type.

### Returning one

A rented system is pooled, not `new`'d, so give it back rather than letting it fall out of scope:

- `NetworkSystemPool.Return<TSystem>(networkSystem)` returns it to `ResettableObjectPool<TSystem>`.
- `NetworkSystemPool.ReturnAndNullifyReference<TSystem>(ref networkSystem)` does the same and clears your reference to null.

A started system does not go through either of these directly — stop it through `SystemManager.EnsureStopSystem(networkSystem, isPoolReturnRequestedOnDespawn: true)`, and the pool return happens as the despawn completes. A receiver's copy, built by the framework from the wire, returns to its own pool automatically once its despawn is applied; you never call `Return` on that one.

## The problem: nothing to find it by

A system rented this way carries `NetworkSystem.UnsetPlatformId`. `INetworkSystemSpawnHandler` is only consulted for a spawn whose `PlatformId` is set, so a pure-code system never reaches it — there is no `TryBindSceneObject` call and no `OnDynamicSystemSpawned` call to hang a reference off. On the peer that rented it you already have the reference the rent call returned. On every other peer, the system just starts; nothing tells that peer's code it exists, and there is no identifier it could have known in advance to look one up by.

## The answer: watching for a composition

`NetworkSystemPool.Watch<TSystem, TComponent0...>(coreManager, acquired, released)` registers a standing subscription for every system of a given type and component composition, on whichever peer registers it — the one that rents the system, the one that receives it over the wire, or both. It returns a `NetworkSystemWatch`; hand that back to `NetworkSystemPool.Unwatch(watch)` when you're done.

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

`NetworkSystemAcquiredHandler` fires for every system that satisfies the watch, whether it started here or arrived off the wire. `NetworkSystemReleasedHandler` fires as an acquired system stops; drop whatever you took in `acquired` there; a wire-constructed system returns to its pool immediately after that call, so a reference kept past it can end up naming a different spawn entirely.

Matching is by **composition, not type**. Nearly every rent asks for a plain `NetworkSystem` and differs only in the components attached, so naming the right components in the watch is what tells it apart from every other system in the world. Registering a watch also replays it against every system already started, so it works whether it is set up before or after the system exists.

## A worked sample

The server rents and starts a match clock with no engine object:

```csharp
public class MatchClock : INetworkLoopStepCallback
{
    public NetworkSystem NetworkSystem { get; private set; }

    private readonly CoreManager _coreManager;
    private float _secondsPerTick;

    public MatchClock(CoreManager coreManager) => _coreManager = coreManager;

    public NetworkLoopSteps GetNetworkLoopSteps() => NetworkLoopSteps.EarlyFixedUpdate;

    public bool Start()
    {
        NetworkSystem = NetworkSystemPool.Rent<NetworkSystem, MatchClockComponent>(_coreManager, canStartSystem: true);

        if (NetworkSystem is null)
            return false;

        _secondsPerTick = 1f / _coreManager.NetworkLoopManager.TickRate;

        if (NetworkSystem.TryGetComponent(out MatchClockComponent matchClockComponent))
        {
            matchClockComponent.Round.Value = 1;
            matchClockComponent.SecondsRemaining.Value = 10f;
        }

        _coreManager.NetworkLoopManager.RegisterNetworkLoopStepCallbacks(this);

        return true;
    }

    public void OnNetworkLoopStep(NetworkLoopSteps networkLoopStep, StepDelta stepDelta)
    {
        if (NetworkSystem is null || !NetworkSystem.TryGetComponent(out MatchClockComponent matchClockComponent))
            return;

        matchClockComponent.SecondsRemaining.Value -= _secondsPerTick;
    }
}
```

The receiver watches for the same composition and is handed that exact system, whether it registered before the rent happened (via the replay) or the spawn arrives afterward:

```csharp
public class MatchReadout
{
    public NetworkSystem MatchSystem { get; private set; }

    private NetworkSystemWatch _matchWatch;

    public void Start(CoreManager coreManager)
        => _matchWatch = NetworkSystemPool.Watch<NetworkSystem, MatchClockComponent>(coreManager, OnMatchAcquired, OnMatchReleased);

    private void OnMatchAcquired(NetworkSystem networkSystem) => MatchSystem = networkSystem;

    private void OnMatchReleased(NetworkSystem networkSystem)
    {
        if (MatchSystem == networkSystem)
            MatchSystem = null;
    }
}
```

Both sides drive the same real loop: the server's `MatchClock` ticks `SecondsRemaining` down every `EarlyFixedUpdate`, and `MatchReadout.MatchSystem` reads the replicated value off the very system the watch handed it, on whichever peer it runs on. Neither side special-cases which peer it is.

## When to use SystemManager.SystemStarted instead

`SystemManager.SystemStarted` and `SystemManager.SystemStopped` are the broad half of the discovery surface: they raise for *every* system that starts or stops on this peer, regardless of composition. Reach for them instead of a watch when you genuinely want everything and will sort it out yourself — logging, bookkeeping across arbitrary system types, or a single subscriber that dispatches by type. A subscriber that wants only systems of a known composition should register a `NetworkSystemWatch` instead and be handed just those.
