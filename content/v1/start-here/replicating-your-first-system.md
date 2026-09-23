---
title: "Replicating your first system"
---

> **Using Unity?** See [Replicating your first object](./replicating-your-first-object.md).

## Declare the data

A networked component is a `partial class` deriving from `NetworkComponent`, holding one `NetworkMember<T0>` field per value you want replicated:

```csharp
public partial class MatchClockComponent : NetworkComponent
{
    public readonly NetworkMember<int> Round = new();
    public readonly NetworkMember<int> SecondsRemaining = new();
    public readonly NetworkMember<int> Score = new();
}
```

You never write the serialization for these fields yourself. The class is `partial` because the source generator emits the other half: the reads and writes that put each `NetworkMember<T0>` on the wire, and the bookkeeping that tracks which members changed on a given tick. You declare the fields and their types; the generator supplies everything that moves them across the network.

A `NetworkSystem` is the thing that gets spawned and despawned; the components attached to it are what carry state. A system can carry more than one component, which is what the spawning APIs below are generic over.

## Spawn on the server

The server rents a system and attaches the components it needs in one call:

```csharp
NetworkSystem? matchSystem = NetworkSystemPool.Rent<NetworkSystem, MatchClockComponent>(coreManager, canStartSystem: true);
```

`canStartSystem` defaults to `true`; pass `false` to rent a system without starting it yet. `Rent` is generated in overloads that take up to 64 component type arguments (`TComponent0` through `TComponent63`), so a system with several components is still one call:

```csharp
NetworkSystemPool.Rent<NetworkSystem, MatchClockComponent, ScoreboardComponent>(coreManager, canStartSystem: true);
```

Once started, write to the component's members the same way on either peer:

```csharp
if (matchSystem!.TryGetComponent(out MatchClockComponent clock))
    clock.Round.Value = 1;
```

## Finding it on the receiver

A system rented purely from code carries `NetworkSystem.UnsetPlatformId` — there is no prefab and no scene object behind it, so there is nothing for a spawn handler to bind or instantiate. That id being unset is deliberate: this kind of spawn never reaches `INetworkSystemSpawnHandler`.

Without an object to hang a reference off, and without an `Id` the receiver could have learned in advance, there is no handle to grab when the spawn arrives. `NetworkSystemPool.Watch` is the answer: a standing subscription that matches on system type and component composition, and hands the receiver its own instance the moment a matching system starts.

```csharp
NetworkSystemWatch? watch = NetworkSystemPool.Watch<NetworkSystem, MatchClockComponent>(coreManager, acquiredSystem =>
{
    if (acquiredSystem.TryGetComponent(out MatchClockComponent clock))
    {
        // acquiredSystem is this peer's own instance, already carrying the server's state.
    }
});
```

Composition, not type alone, is what a watch matches on: a watch for `NetworkSystem, MatchClockComponent` is never offered a plain `NetworkSystem` that carries a different component. `Watch` also takes an optional released handler for when the matching system stops, and is generated in the same up-to-64-component overloads as `Rent`.

Registering a watch is safe at any time. If a matching system already exists when you watch, it is replayed against the new watch immediately, so a subscriber that starts late still gets it.

Drop the subscription with `Unwatch` when you no longer need it:

```csharp
NetworkSystemPool.Unwatch(watch);
```

## Reading a value and reacting to a change

Read a member's current value through its `Value` property:

```csharp
int secondsRemaining = clock.SecondsRemaining.Value;
```

To react when values change rather than poll them, override `OnMembersChanged` on the component. It is the single callback for every inbound apply, and it also fires on the peer that wrote the change:

```csharp
public partial class MatchClockComponent : NetworkComponent
{
    public readonly NetworkMember<int> Round = new();
    public readonly NetworkMember<int> SecondsRemaining = new();
    public readonly NetworkMember<int> Score = new();

    public override void OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)
    {
        if (memberChangeDirection == MemberChangeDirection.Read)
        {
            // Applied from the wire — this peer received the change.
        }
    }
}
```

`memberChangeDirection` tells you which side of the wire the raise is reporting: `Write` fires on the peer that just committed the change for serialization, `Read` fires when a peer applies a change that arrived from the wire. A handler that only cares about remote changes checks for `Read`.

## Returning what you rented

A rented system is returned to the pool when you're done with it:

```csharp
NetworkSystemPool.Return(matchSystem);
```

Or, to return it and clear your own reference in the same call:

```csharp
NetworkSystemPool.ReturnAndNullifyReference(ref matchSystem);
```

A system handed to you by a watch is borrowed, not owned: the same instance stays valid from your acquired handler until your released handler, and a wire-constructed instance returns to its pool immediately after your released handler returns, so drop your reference there and keep none past it.

## Using Unity

The Unity track replaces both the rent and the watch with a marker component on a GameObject and `NetworkSystemObjectPool.RequireSystem`. See [Replicating your first object](./replicating-your-first-object.md) for that version.
