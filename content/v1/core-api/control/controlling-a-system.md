---
title: "Reading who controls a system"
---

> **Using Unity?** See [Control in a Unity script](../../unity/control/control-in-unity-scripts.md).

## Checking control

`NetworkSystem.IsController(ControllerType)` answers whether the local peer controls a system:

```csharp
if (networkSystem.IsController(ControllerType.AnyController))
{
    // The local peer is the server (with no controlling client) or the controlling client.
}
```

`ControllerType` is a flags enum:

| Value | Meaning |
| --- | --- |
| `None` | No controller. |
| `Server` | The local peer is the server and no client controls the system. |
| `Client` | The local peer is the client that controls the system. |
| `AnyController` | `Server \| Client` — the local peer is the current controller, whether as server or as controlling client. |

Combine flags to test either case at once, as `AnyController` does.

## The controller fields

`NetworkSystem` exposes the controlling identity directly:

- `ControllingClient` — the `Connection` of the controlling client, or `null` when the server controls the system.
- `ControllerConnectionId` — the connection Id of the controlling client, or `NetworkSystem.UnsetId` when the server controls it. This is the canonical identity that replicates to clients.

`ControllerConnectionId` is the value to compare against a known Id. It is not itself a peer: an Id names a connection, but a `Connection` instance is a live reference that can be missing, reassigned by the pool, or simply not yet resolved on a client (see below). Prefer `IsController` or `ControllingClient` when the question is "does the local peer control this", and reach for `ControllerConnectionId` only when comparing against an externally-known Id.

`ControllingClient` can briefly be `null` on a client even while `ControllerConnectionId` names someone, because a controller change can arrive before the client has been told about the peer it names. The reference fills in once the peer is reported.

## Reacting to control changes

```csharp
networkSystem.ControllerChanged += OnControllerChanged;

void OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)
{
    // ...
}
```

`ControllerChangedHandler` is `void ControllerChangedHandler(Connection previousControllerConnection, Connection currentControllerConnection)`. Either Connection is `null` when control sits with the server, or with a peer client this peer holds no `Connection` for.

## Finding what a peer controls

`InterestManager.TryGetControlledSystems` answers the reverse question — what does this connection drive:

```csharp
if (coreManager.InterestManager.TryGetControlledSystems(connection, out IReadOnlyCollection<NetworkSystem> controlledSystems))
{
    foreach (NetworkSystem controlledSystem in controlledSystems)
    {
        // ...
    }
}
```

An identifier overload, `TryGetControlledSystems(uint connectionId, out IReadOnlyCollection<NetworkSystem> controlledSystems)`, exists for a caller that only has an Id rather than the `Connection` itself.

This is not a player-object lookup. A connection controlling a character, a vehicle, and a turret is returned all three, in no particular order — the core has no concept of a player, and no opinion about which controlled system is "the" player. That distinction belongs to the game. The returned collection is a live view, not a copy, so copy it before doing anything that can reassign a controller while walking it.

### Walking it in code that runs often

The view is an interface, so a `foreach` over it allocates an enumerator on every walk. That is fine for a one-off lookup, but not for code that runs every tick or for every pair, such as an interest condition. There, fill a list you keep instead:

```csharp
private readonly List<NetworkSystem> _controlledSystems = new();

private void CheckControlledSystems(CoreManager coreManager, Connection connection)
{
    int count = coreManager.InterestManager.GetControlledSystems(connection, _controlledSystems);

    for (int i = 0; i < count; i++)
    {
        NetworkSystem controlledSystem = _controlledSystems[i];
        // ...
    }
}
```

`GetControlledSystems` clears the list, fills it with every system the connection controls, and returns the count; it allocates nothing once the list has grown to fit. Because it is a copy, control may be reassigned while you walk it.

## Control is exclusive

A system is controlled by the server or by exactly one client, never both. `ControllerConnectionId` is either `UnsetId` (server) or a single client's Id at any moment.

## Comparing controllers: use the Id, not the reference

A `Connection` is pooled and reused once its link ends, so a reference kept from an earlier lookup can name a different peer later, while `ControllerConnectionId` is an Id to begin with.

Never compare `Connection` references to decide whether a peer controls a system. Compare `Connection.Id` values instead:

```csharp
bool controls = networkSystem.ControllerConnectionId == someConnection.Id;
```

`IsController` and `TryGetControlledSystems` already do this correctly internally; write the same comparison by hand whenever a raw Id or Connection comparison is unavoidable.
