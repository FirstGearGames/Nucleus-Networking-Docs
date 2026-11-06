---
title: "Carrying and re-parenting objects"
---

> **Driving the core API directly?** See [Parents, children and hierarchy](../../core-api/systems/system-hierarchy.md).

## Parent one object to another on the server

Call `EnsureSetSystemParent` on the server with the child's and the parent's `NetworkSystem`, not their GameObjects:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem);
```

Pass `null` as the parent to detach the object to the root of its scene:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, parentNetworkSystem: null);
```

It returns `true` when the parent changed, and `false` when the caller is not the server, either system is not started, or the pair is not allowed (see the limits below).

Every peer, the server included, moves the child's GameObject under the new parent's transform for you, so never call `transform.SetParent` yourself. The server also refreshes the object's interest.

## Place the child where you want it

`NetworkTransform`'s **Transform Space** decides what the ride costs:

- **Local** (default): the child sends its offset inside the parent, which stops changing while it rides, so it costs nothing to send. Only the carrier's own transform is sent each tick.
- **World**: the child sends its scene pose and keeps paying for full pose replication while it rides.

Under Local, a re-parent carries the child's local values through instead of holding its world pose, so it lands wherever those values put it inside the new parent. To land it on a specific spot, such as a deck slot or a socket, set its world pose right after the call:

```csharp
if (!CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem))
    return;

crate.transform.SetPositionAndRotation(carrierTransform.TransformPoint(slotPosition), carrierTransform.rotation);
```

When detaching, read the world pose before the call and write it back afterwards, or the object jumps to where its local offset puts it from the scene root.

## React to a parent change

`NetworkSystem` exposes the link:

- `ParentId`: the server's `Id` for the current parent, or unset when there is none.
- `HasParent`: true whenever `ParentId` is set, even if the parent has not arrived on this peer yet.
- `Parent`: the parent's `NetworkSystem`, or `null` when unparented or not yet arrived.
- `IsParentResolved`: true once `Parent` is not null.
- `ParentChanged`: a `NetworkSystem.ParentChangedHandler(uint previousParentId, uint currentParentId)` event, raised on the server as it makes the change and on each client as it applies it.

`Parent` may still be null inside the callback, so read `ParentId` or `HasParent` there:

```csharp
private void OnSystemLinked(NetworkSystem system)
{
    _crateSystem = system;
    _crateSystem.ParentChanged += OnParentChanged;
}

private void OnParentChanged(uint previousParentId, uint currentParentId)
{
    // React to _crateSystem.HasParent here; _crateSystem.Parent may not be resolved yet.
}
```

## Design around the hierarchy limits

- **Only a dynamically spawned prefab can be a child.** A scene object or a system with no GameObject cannot, though either can be a parent.
- **Hierarchies nest at most 8 deep**, counted from a root.
- **Despawning a parent despawns its children**, deepest first.

The core page lists every check the server makes before it accepts a parent.
