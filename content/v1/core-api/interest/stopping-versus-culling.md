---
title: "Stopping versus culling"
---
> **Using Unity?** See [Frozen or gone: what a stop does to the object](../../unity/interest/stopping-objects-in-unity.md)

Interest can end replication for a connection two different ways, and they cost the receiver differently. `InterestEffect.Spawn` controls whether a `NetworkSystem` exists for a connection at all: while an unmet `Spawn` condition holds, the system does not spawn there, and one already spawned despawns, releasing the object exactly as an ordinary despawn does. `InterestEffect.Stop` is cheaper: while an unmet `Stop` condition holds, the system stops replicating to the connection, but the connection's engine object is retained. A distant object can stay visible while it stops costing anything to keep current, and it is only reclaimed if a `Spawn` condition later culls it too.

## InterestMembership

`InterestMembership` is the resolved state of one `(NetworkSystem, Connection)` pair, as the stacked interest conditions settle it:

- `Streamed` — an ordinary delta observer, receiving the system's shared delta stream every tick. This is the deliberate default: a connection with no interest entry is streamed, so a world with no condition registered behaves exactly as it did before interest existed.
- `Stopped` — stopped for the connection by an unmet `Stop` condition; the connection holds no system, but its engine object was retained for a later re-entry.
- `Unspawned` — culled for the connection by an unmet `Spawn` condition; the connection holds neither the system nor its object.

## Reclaiming a stopped object

`NetworkSystem.DespawnWhenStoppedEnabled` decides what a stop then costs the receiver, independent of whatever resolved the stop in the first place. Left false, a stopped system keeps its object on the receiver — cheap to undo, and the right answer for something a player is currently looking at. Set true, the system asks to be reclaimed rather than left frozen, which is the right answer for something a player has left behind: the object is a cost with nothing to show for it.

For a grouped object this is a vote, not a decision: the object is reclaimed only once *every* member is stopped and asking for it. One member that still wants to be heard, or one left to freeze rather than despawn, keeps the whole object where it is. An ungrouped system answers for itself, so its stop is a despawn outright.

## The InterestStopResolving seam

Conditions can only restrict, so a rule authored for a whole object stops every system on it, and no system can hand itself back on its own. `NetworkSystem.InterestStopResolving` is the seam for the decision a condition cannot express: a subscriber can decline a stop no condition can undo, or impose one no condition asked for.

```csharp
public delegate void InterestStopResolvingHandler(ref InterestStopContext interestStopContext);
public event InterestStopResolvingHandler? InterestStopResolving;
```

`InterestStopContext` carries the pair being resolved:

```csharp
public struct InterestStopContext
{
    public readonly NetworkSystem NetworkSystem;
    public readonly Connection Connection;
    public bool IsStopped;
}
```

It is passed by reference through every subscriber in subscription order, seeded with what the registered conditions resolved. Each subscriber sees what the one before it decided, and the last one to write settles the answer. A subscriber speaking for one system alone tests `NetworkSystem` first and leaves `IsStopped` untouched otherwise. Where `DespawnWhenStoppedEnabled` is set, declining a stop here keeps the whole object with that connection, since the group vote never counts it as stopped and asking.

## When and for whom it is raised

`InterestStopResolving` is raised once per `(system, connection)` pair on the interest cadence, on the network loop thread, while the pair's spawn still stands and before the object's despawn is settled — the order that lets the answer feed into the despawn decision. Subscribers are held to what a condition is held to: pure, cheap reads that neither start nor stop systems, mutate observers, nor block.

It is never raised for an emulated connection or one sharing an in-memory transport. A host's own client is the one exception in the other direction: it is raised for while `InterestManager.HostInterestEnabled` is set, though a stop settled for it is only reported through `HostInterestMembership` rather than acted on.

Subscribing is itself a reason the pass walks the system. A `NetworkSystem` carrying no interest condition at all is normally skipped by the interest pass; adding an `InterestStopResolving` subscriber puts it back in front of the pass even with nothing else registered, and removing the last subscriber takes it back out.
