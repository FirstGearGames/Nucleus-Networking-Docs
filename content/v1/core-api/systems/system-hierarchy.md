---
title: "Parents, children and hierarchy"
---

> **Using Unity?** See [Carrying and re-parenting objects](../../unity/systems/reparenting-objects).

A NetworkSystem can be attached to another so the two move together and replicate as a unit. The link is server-only, the child follows a strict eligibility rule, and a receiver sees the identifier before it can see the object it names.

## Setting a parent

`SystemManager.EnsureSetSystemParent` is the only way a started system's parent changes:

```csharp
bool isParentChanged = CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem);
```

Passing `null` for the parent detaches the system and returns it to the root of its scene:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, parentNetworkSystem: null);
```

The call only succeeds on the server. A client calling it is refused and logged, and nothing else in the engine reparents a started system.

## Eligibility

Only a dynamically spawned `NetworkSystem` can be a child. A scene object's placement is authored and half its bind key, and a system with no platform identity has no engine object to seat anywhere, so both are rejected. Being a parent has no such restriction: any started system can hold children.

A proposed parent is also rejected when:

- it is the same system as the child,
- it is not started and registered,
- it belongs to a different `CoreManager`,
- it is in a different scene than the child, or
- attaching it would make the hierarchy circular or nest deeper than `SystemManager.MaximumParentDepth` (8).

The depth and cycle check walks up from the proposed parent toward the root, bounded by `MaximumParentDepth`, so it terminates even against a hierarchy an earlier bug already made circular.

## How the link travels

An object spawned already carrying a parent has that parent's Id in its spawn header, so a new observer learns the relationship as part of the spawn itself. A later change made with `EnsureSetSystemParent` travels separately: it serializes as a reparent entry to every peer that already holds the object, carrying the system's Id and its new `ParentId`. A peer that already has the object re-seats it in place rather than treating the change as a new spawn.

## The receiving side

On a receiving peer, `ParentId` can name a system that has not arrived yet, or that was written to the same tick after its child. Two members exist for that gap:

```csharp
public uint ParentId { get; }
public bool IsParentResolved { get; }
public event ParentChangedHandler ParentChanged;
```

`IsParentResolved` is true once the system holds a live reference to the parent `ParentId` names; it is false both for an unparented system and for one whose parent identifier has arrived but the parent itself has not been resolved yet. `ParentChanged` fires on both ends, the server as it reparents and a client as it applies the change, and carries the Ids rather than the systems:

```csharp
void OnParentChanged(uint previousParentId, uint currentParentId)
{
    // ...
}
```

## Despawn and interest

Stopping a parented system cascades to its children, deepest first, so a receiver is never handed a despawn for a parent while a child still names it. Interest respects the same link: a system withholds its own subtree from a peer it has been culled for, so a child is never revealed to a peer that has not been given its parent.

## Not supported yet

An object cannot be spawned directly into a parent; call `EnsureSetSystemParent` after the spawn instead. Hierarchies cannot cross scenes, a proposed parent in a different scene than the child is refused outright, so do not design around either.
