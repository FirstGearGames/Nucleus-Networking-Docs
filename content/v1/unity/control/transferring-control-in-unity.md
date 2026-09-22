---
title: "Giving a client control of an object"
---

> **Driving the core API directly?** See [Assigning and releasing control](../../core-api/control/transferring-control).

## Calling SetController

`SetController` is a member of the networked system, not of the `NucleusBehaviour`, so a component calls it through `NetworkSystem`. It is server-only: calling it from a client is rejected and logged. Guard the call with `EnsureIsStarted(Invoker.Server)` so a misplaced call fails loudly instead of silently doing nothing on a client.

```csharp
if (EnsureIsStarted(Invoker.Server))
    NetworkSystem.SetController(connection);
```

Passing `null` returns control to the server.

## The built-in case: NetworkPlayerSpawner

`NetworkPlayerSpawner` is the component to reach for when every authenticated client needs one object of its own. It exposes two inspector fields:

- `_playerPrefab` - the networked prefab spawned for each client. It needs a `NetworkSystemObject` marker.
- `_spawnPoints` - the poses new objects are placed on, taken in turn and wrapping when exhausted. Leave this empty to spawn every player on the spawner's own transform.

On the server, each authenticated client gets exactly one object of this prefab. When a fresh spawn is needed, the spawner calls `Instantiate(_playerPrefab, spawnPose.position, spawnPose.rotation)` and then hands the client control with `SetController`. The spawner only ever creates objects while its peer is the server; a client never spawns one for itself.

## What each peer sees

Control changes are announced through `NetworkSystem.ControllerChanged`, and `NucleusBehaviourBase.OnControllerChanged(previousControllerConnection, currentControllerConnection)` forwards it to every peer that has the system linked:

- The previous controller (if any) sees its `OnControllerChanged` fire with the new controller as `currentControllerConnection`, and loses whatever control-gated behavior it was running.
- The new controller sees the same callback, with itself as `currentControllerConnection`, and can now act as this system's controller.
- Every other observer - every peer with the object in interest, controller or not - sees the same callback fire, with both connections filled in as far as that peer can resolve them.

A `null` connection in either parameter means either the server or a peer client this peer holds no `Connection` for: control returning to the server reports `currentControllerConnection` as null, and an object spawned already under a client's control reports `previousControllerConnection` as null on a peer that cannot yet resolve who that was.

## Retention policy is set on every object the spawner creates

Before calling `SetController`, the spawner's `AssignController` writes `ControllerRetentionPolicyOverride` on every `NetworkSystem` the object carries:

```csharp
ControllerRetentionPolicy controllerRetentionPolicy = _disconnectMode is NetworkPlayerDisconnectMode.RetainForReturn
    ? ControllerRetentionPolicy.Retain
    : ControllerRetentionPolicy.Release;

foreach (NetworkSystem playerNetworkSystem in playerNetworkSystemObject.Systems)
{
    playerNetworkSystem.ControllerRetentionPolicyOverride = controllerRetentionPolicy;
    playerNetworkSystem.SetController(connection);
}
```

This happens for every system the spawned object carries, not just the first, and it happens whether the disconnect mode is `Despawn` or `RetainForReturn`. It overrides whatever the manager's default retention policy is - a world configured to retain by default would otherwise retain a player object the spawner means to despawn on disconnect, and the two would disagree about what happens to it.

## The Instantiate trap

Placing a controlled object with `Instantiate(prefab, position, rotation)` works in the ordinary case - that is exactly what `NetworkPlayerSpawner` does. The trap is narrower, and specific to an object whose *pose* the controller itself simulates, such as a `ProjectedRigidbody`. Once that component links to its system, the controller's own simulation asserts its projected pose back onto the object within a tick, overwriting whatever position and rotation `Instantiate` set.

This is easy to miss on a host, because the host's own client is often the same peer whose simulated pose is being asserted - the overwrite lands on the pose the host expected anyway, so nothing looks wrong until a second peer, whose simulation starts from the true placement, shows the object snap.

## The spawner's public surface

- `EnsurePlayerObject(Connection connection)` - the only way an object is created for a client. Idempotent: a client that already has one is a no-op.
- `TryGetPlayerObject(uint connectionId, out NetworkSystemObject playerNetworkSystemObject)` and the `TryGetPlayerObject(Connection connection, ...)` overload - look up the object this spawner holds for a client.
- `PlayerObjectCount` - how many clients this spawner currently holds an object for.
- `PlayerObjectSpawned` - raised on the server when a client is given a newly created object, after control has been assigned.
- `PlayerObjectReclaimed` - raised when a client is given an object that already existed, whether redeemed from a retention record or found already under that client's control after a world adoption. The object may carry state from its previous controller, so any per-player reset a game needs must run here as well as on `PlayerObjectSpawned`.
- `PlayerObjectDespawned` - raised when a player object leaves the world, whether its player disconnected under `NetworkPlayerDisconnectMode.Despawn` or a retention record lapsed unredeemed.

## Arbitration rules

For how `SetController` resolves conflicting or repeated calls, see [Assigning and releasing control](../../core-api/control/transferring-control).
