---
title: "Stopping versus culling"
---
> **Using Unity?** See [Frozen or gone: what a stop does to the object](../../unity/interest/stopping-objects-in-unity.md)

Interest can end replication for a connection two different ways, and they cost the receiver differently. `InterestEffect.Spawn` controls whether a `NetworkSystem` exists for a connection at all: while an unmet `Spawn` condition holds, the system does not spawn there, and one already spawned despawns, releasing the object exactly as an ordinary despawn does. `InterestEffect.Stop` is cheaper: while an unmet `Stop` condition holds, the system stops replicating to the connection, but the connection's engine object is retained. A distant object can stay visible while it stops costing anything to keep current, and it is only reclaimed if a `Spawn` condition later culls it too.

## InterestMembership

`InterestMembership` is the resolved state of one `(NetworkSystem, Connection)` pair, as the stacked interest conditions settle it:

- `Streamed`: an ordinary observer, receiving the system's updates every tick. This is the default: a connection with no interest entry is streamed, so a world with no condition registered sends every system to every connection.
- `Stopped`: stopped for the connection by an unmet `Stop` condition; the connection holds no system, but its engine object was retained for a later re-entry.
- `Unspawned`: culled for the connection by an unmet `Spawn` condition; the connection holds neither the system nor its object.

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

## Reacting when interest moves

Conditions and the stop seam decide interest; they must not act on it. To act when a pair actually moves (show a "player left your view" marker, start a server-side effect for a player who just gained an object, record analytics), subscribe to one of the two interest change events. Both are raised on the authority only, after the tick's state has been sent, on the network loop thread, so every move is settled when a handler reads it and a handler is free to do engine work: a system it starts goes live with the next tick.

For one object, subscribe to `NetworkSystem.InterestChanged`:

```csharp
public delegate void InterestChangedHandler(Connection connection, InterestMembership previousInterestMembership, InterestMembership interestMembership);
public event InterestChangedHandler? InterestChanged;
```

```csharp
networkSystem.InterestChanged += OnInterestChanged;

void OnInterestChanged(Connection connection, InterestMembership previousInterestMembership, InterestMembership interestMembership)
{
    if (interestMembership is InterestMembership.Unspawned)
    {
        // This client no longer has the object at all.
    }
}
```

A subclass of `NetworkSystem` can override `OnInterestChanged` instead of subscribing. The event is raised only for a move: an object that reaches a connection with no condition ever restricting it raises nothing, and neither does a system leaving the world or a connection leaving it, since their own events already say so. It is never raised for a host's own client, which is reported through `HostInterestChanged` instead (see [Host interest report](./host-interest-report.md)).

For the whole world, subscribe to `InterestManager.InterestChanged`, which is raised once per tick that moved anything, with every move that tick:

```csharp
public delegate void InterestChangesHandler(IReadOnlyList<InterestChange> interestChanges);
public event InterestChangesHandler? InterestChanged;
```

```csharp
coreManager.InterestManager.InterestChanged += OnInterestChanges;

void OnInterestChanges(IReadOnlyList<InterestChange> interestChanges)
{
    for (int i = 0; i < interestChanges.Count; i++)
    {
        InterestChange interestChange = interestChanges[i];

        if (interestChange.InterestMembership is InterestMembership.Streamed)
        {
            // interestChange.Connection gained interestChange.NetworkSystem.
        }
    }
}
```

Each `InterestChange` carries the `NetworkSystem`, the `Connection`, the `PreviousInterestMembership` and the new `InterestMembership`. One call carries the whole tick, so a player joining and receiving a thousand objects costs one invocation rather than a thousand, which makes this the right event for a per-player visibility tracker. The list belongs to the engine and is cleared once your handler returns: read it inside the handler and copy whatever must outlive the call. Every recorded move is handed over, including one whose system has since left the world, so check `NetworkSystem.IsStarted` where that matters.

To read where a pair stands right now instead of waiting for a move, call `NetworkSystem.GetInterestMembership(connection)` on the authority. A connection the system holds no entry for reads `Streamed`.
