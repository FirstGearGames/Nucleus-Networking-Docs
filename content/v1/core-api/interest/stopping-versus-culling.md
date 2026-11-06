---
title: "Stopping versus culling"
---
> **Using Unity?** See [Frozen or gone: what a stop does to the object](../../unity/interest/stopping-objects-in-unity.md)

Interest can end replication to a connection in two ways:

- **Cull** (`InterestEffect.Spawn`): while an unmet `Spawn` condition holds, the `NetworkSystem` does not spawn for the connection, and one already spawned is despawned like any ordinary despawn.
- **Stop** (`InterestEffect.Stop`): while an unmet `Stop` condition holds, the system stops replicating to the connection but the connection keeps its object. A distant object can stay visible at no replication cost. It is reclaimed only if a `Spawn` condition later culls it too.

## Each pair resolves to one InterestMembership

`InterestMembership` is the resolved state of one `(NetworkSystem, Connection)` pair:

- `Streamed`: an ordinary observer, receiving updates. This is the default for a connection with no interest entry.
- `Stopped`: stopped by an unmet `Stop` condition. The connection holds no system, but its object was kept for a later re-entry.
- `Unspawned`: culled by an unmet `Spawn` condition. The connection holds neither the system nor its object.

## Choose whether a stopped object is reclaimed

`NetworkSystem.DespawnWhenStoppedEnabled` decides what a stop costs the receiver:

- `false`: the stopped object stays on the receiver. Use this for something a player is looking at.
- `true`: the stopped object is reclaimed rather than left frozen. Use this for something a player has left behind.

For a grouped object, the object is reclaimed only once every member is stopped with this set. One member that is still streamed, or left to freeze, keeps the whole object. An ungrouped system's stop with this set is a despawn.

## Override a stop with InterestStopResolving

Conditions can only restrict, so a rule authored for a whole object stops every system on it. `NetworkSystem.InterestStopResolving` lets a subscriber decline a stop no condition can undo, or impose one no condition asked for.

```csharp
public delegate void InterestStopResolvingHandler(ref InterestStopContext interestStopContext);
public event InterestStopResolvingHandler? InterestStopResolving;
```

```csharp
public struct InterestStopContext
{
    public readonly NetworkSystem NetworkSystem;
    public readonly Connection Connection;
    public bool IsStopped;
}
```

- The context is seeded with what the conditions resolved and passed by reference through every subscriber in subscription order. The last subscriber to write settles the answer.
- A subscriber speaking for one system tests `NetworkSystem` first and otherwise leaves `IsStopped` alone.
- Where `DespawnWhenStoppedEnabled` is set, declining a stop keeps the whole object with that connection.
- It is raised once per pair on the interest cadence, on the network loop thread. Subscribers must be pure, cheap reads that neither start nor stop systems, change observers, nor block.
- It is never raised for an emulated connection or one on an in-memory transport. It is raised for a host's own client while `InterestManager.HostInterestEnabled` is set, but a stop settled there is only reported through `HostInterestMembership`, not acted on.
- Subscribing makes the interest pass evaluate the system even when it has no interest condition. Removing the last subscriber undoes that.

## React when interest moves

Conditions and `InterestStopResolving` decide interest and must not act on it. To act when a pair actually moves, such as showing a "player left your view" marker or recording analytics, subscribe to an interest change event. Both events are raised on the authority only, on the network loop thread, after the tick's state has been sent. A handler may do engine work; a system it starts goes live with the next tick.

For one object, subscribe to `NetworkSystem.InterestChanged`, or override `OnInterestChanged` in a subclass:

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

It is raised only for a move. An object that reaches a connection with no condition ever restricting it raises nothing, and neither does a system or connection leaving the world, since their own events cover that. It is never raised for a host's own client, which uses `HostInterestChanged` instead (see [The host interest report](./host-interest-report.md)).

For the whole world, subscribe to `InterestManager.InterestChanged`. It is raised once per tick that moved anything, with every move from that tick:

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

- Each `InterestChange` carries the `NetworkSystem`, the `Connection`, the `PreviousInterestMembership` and the new `InterestMembership`.
- One call covers the whole tick, which suits a per-player visibility tracker.
- The list is cleared once your handler returns. Copy whatever must outlive the call.
- A move whose system has since left the world is still included, so check `NetworkSystem.IsStarted` where that matters.

To read where a pair stands now, call `NetworkSystem.GetInterestMembership(connection)` on the authority. A connection with no entry reads `Streamed`.
