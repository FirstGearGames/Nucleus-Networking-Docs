---
title: "Reading who controls a system"
---

> **Using Unity?** See [Control in a Unity script](../../unity/control/control-in-unity-scripts.md).

## Check whether the local peer controls a system

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
| `AnyController` | `Server \| Client`: the local peer is the current controller, as server or as controlling client. |

Combine flags to test either case at once, as `AnyController` does.

## Read who the controller is

- `ControllingClient` is the controlling client's `Connection`, or `null` when the server controls the system. On a client it can briefly be `null` while `ControllerConnectionId` names someone, because a controller change can arrive before the client is told about that peer. It fills in once the peer is reported.
- `ControllerConnectionId` is the controlling client's connection Id, or `NetworkSystem.UnsetId` when the server controls it. This is the identity that replicates to clients.

## Compare controllers by Id, never by reference

A `Connection` is pooled and reused once its link ends, so a reference kept from an earlier lookup can later name a different peer. To ask whether the local peer controls a system, use `IsController` or `ControllingClient`. To compare against a known peer, compare Ids:

```csharp
bool controls = networkSystem.ControllerConnectionId == someConnection.Id;
```

`IsController` and `TryGetControlledSystems` already compare this way.

## React to control changes

```csharp
networkSystem.ControllerChanged += OnControllerChanged;

void OnControllerChanged(Connection previousControllerConnection, Connection currentControllerConnection)
{
    // ...
}
```

The handler type is `ControllerChangedHandler`. Either `Connection` is `null` when control sits with the server, or with a peer client this peer holds no `Connection` for.

## Find what a connection controls

```csharp
if (coreManager.InterestManager.TryGetControlledSystems(connection, out IReadOnlyCollection<NetworkSystem> controlledSystems))
{
    foreach (NetworkSystem controlledSystem in controlledSystems)
    {
        // ...
    }
}
```

The overload `TryGetControlledSystems(uint connectionId, out IReadOnlyCollection<NetworkSystem> controlledSystems)` takes an Id instead of a `Connection`.

It returns every system the connection controls, in no particular order. The core has no concept of a player, so deciding which controlled system is the player is up to the game. The collection is a live view, not a copy: copy it before doing anything that can reassign a controller while you walk it.

### Fill a list instead in code that runs often

A `foreach` over the view allocates an enumerator on every walk. In code that runs every tick or for every pair, such as an interest condition, fill a list you keep:

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

`GetControlledSystems` clears the list, fills it with every system the connection controls and returns the count. It allocates nothing once the list has grown to fit. Because it is a copy, control may be reassigned while you walk it.
