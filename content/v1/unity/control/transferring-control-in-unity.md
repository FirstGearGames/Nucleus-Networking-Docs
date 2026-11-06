---
title: "Giving a client control of an object"
---

> **Driving the core API directly?** See [Assigning and releasing control](../../core-api/control/transferring-control.md).

## Give every player an object with NetworkPlayerSpawner

When every authenticated client needs one object of its own, add a `NetworkPlayerSpawner`. On the server it spawns **Player Prefab** for each client, on **Spawn Points** in turn, and gives the client control. It also sets `ControllerRetentionPolicyOverride` on every system of each object from its **Disconnect Mode**, overriding the manager's default retention policy. See [Player objects](../systems/player-objects.md) for its fields, methods and events.

## Assign control yourself with SetController

`SetController` belongs to the networked system, so call it through `NetworkSystem`. It only works on the server; a client's call is rejected and logged. Guard it with `IsStarted(Invoker.Server)` so it is skipped quietly on clients:

```csharp
if (IsStarted(Invoker.Server))
    NetworkSystem.SetController(connection);
```

Passing `null` returns control to the server. For how repeated or conflicting calls resolve, see [Assigning and releasing control](../../core-api/control/transferring-control.md).

## Every peer sees OnControllerChanged

When control moves, `OnControllerChanged(previousControllerConnection, currentControllerConnection)` fires on every peer that has the system linked: the old controller, the new one and every other observer.

A `null` connection means the server, or a client this peer holds no `Connection` for. Control returning to the server reports `currentControllerConnection` as null, and an object spawned already under a client's control can report `previousControllerConnection` as null on a peer that cannot resolve who that was.

## A controller-simulated object overwrites its Instantiate pose

`Instantiate(prefab, position, rotation)` places an ordinary controlled object correctly; `NetworkPlayerSpawner` does exactly this. But for an object whose pose the controller simulates, such as a `NetworkRigidbody`, the controller's simulation writes its own pose back onto the object within a tick of linking, replacing the pose `Instantiate` set.

On a host this often looks fine, because the host's own client is usually the peer asserting the pose. A second peer, starting from the true placement, shows the object snap.
