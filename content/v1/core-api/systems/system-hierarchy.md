---
title: "Parents, children and hierarchy"
---

> **Using Unity?** See [Carrying and re-parenting objects](../../unity/systems/reparenting-objects.md).

A `NetworkSystem` can be attached to another so the two move together and replicate as a unit.

## Set a parent on the server

`SystemManager.EnsureSetSystemParent` is the only way to change a started system's parent:

```csharp
bool isParentChanged = CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem);
```

Pass `null` to detach the system and return it to the root of its scene:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, parentNetworkSystem: null);
```

It only succeeds on the server; a client's call is refused and logged. You cannot spawn an object directly into a parent; call `EnsureSetSystemParent` after the spawn.

## Only dynamically spawned systems can be children

A scene object, or a system with no platform identity, cannot be a child. Any started system can be a parent. A parent is also refused when:

- it is the same system as the child,
- it is not started and registered,
- it belongs to a different `CoreManager`,
- it is in a different scene than the child (hierarchies cannot cross scenes), or
- attaching it would make the hierarchy circular or deeper than `SystemManager.MaximumParentDepth` (8).

## Handle a parent that has not arrived yet

A new observer receives an object together with its current parent. A later change reaches every peer that holds the object, which re-seats it in place rather than spawning it again.

On a receiver, `ParentId` can name a system that has not arrived yet:

```csharp
public uint ParentId { get; }
public bool IsParentResolved { get; }
public event ParentChangedHandler ParentChanged;
```

`IsParentResolved` is true once the system holds a live reference to the parent `ParentId` names. It is false for an unparented system and for one whose parent has not arrived. `ParentChanged` fires on the server as it reparents and on a client as it applies the change, and carries the Ids:

```csharp
void OnParentChanged(uint previousParentId, uint currentParentId)
{
    // ...
}
```

## Stopping a parent stops its children

Stopping a parented system stops its children too, deepest first. A child is never shown to a peer that cannot see its parent.
