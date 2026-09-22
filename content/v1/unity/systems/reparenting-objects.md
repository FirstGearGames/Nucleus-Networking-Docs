---
title: "Carrying and re-parenting objects"
---

> **Driving the core API directly?** See [Parents, children and hierarchy](../../core-api/systems/system-hierarchy).

## The call

One authority-only call parents one networked object to another:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem);
```

Pass `null` as the parent to detach the object and return it to the root of its scene:

```csharp
CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, parentNetworkSystem: null);
```

Both arguments are `NetworkSystem` references, not GameObjects. `EnsureSetSystemParent` returns `true` when the parent actually changed, `false` if the caller is not the authority, either system is not started, or the pair fails one of the eligibility checks described below. Only the authority may call it.

## What re-parenting does on each peer

Nothing in your code moves the child's GameObject. As the replicated parent identifier lands on each peer, the Unity integration re-seats the linked GameObject under the new parent's transform (or, on detach, back under its scene root). This runs identically on the authority and on every client, including the frame the authority itself makes the call, so you never write `transform.SetParent` yourself. The authority additionally refreshes the object's interest as part of the same call, since interest is only ever computed there.

## Why carrying is free

Whether the ride costs anything to replicate depends on the transform's space, set per object on `NetworkTransform`'s `Transform Space` field:

- **Local** (the default): the object replicates the offset it holds inside its parent. Once parented, that offset stops changing while the ride continues, so a carried child costs nothing to send for as long as it rides — only the carrier's own transform is written per tick.
- **World**: the object replicates the pose it holds in the scene. A re-parent moves nothing and the child keeps paying full pose replication while it rides, regardless of what it's attached to.

A re-parent under Local space carries the child's *local* values through rather than holding its world pose still, so the child lands wherever its old world pose happens to read as once it's measured inside the new parent. If you want it to land at a specific spot — a deck slot, a socket — set its world position and rotation explicitly right after the call, the same way you'd place any other object:

```csharp
if (!CoreManager.SystemManager.EnsureSetSystemParent(crateSystem, carrierSystem))
    return;

crate.transform.SetPositionAndRotation(carrierTransform.TransformPoint(slotPosition), carrierTransform.rotation);
```

The same applies in reverse on detach: read the world pose before calling `EnsureSetSystemParent` with a `null` parent, then write it back afterward, or the object will jump to wherever its local offset reads as from the scene root.

## Reading the parent link from a script

`NetworkSystem` exposes the link for code that needs to react to it rather than drive it:

- `ParentId` — the authority's `Id` for the current parent, or unset when there is none.
- `HasParent` — true whenever `ParentId` is set, whether or not the parent object has arrived on this peer yet.
- `Parent` — the resolved `NetworkSystem` reference, or `null` when unparented *or* when the parent hasn't resolved locally yet.
- `IsParentResolved` — true only once `Parent` is non-null.
- `ParentChanged` — an event of type `NetworkSystem.ParentChangedHandler(uint previousParentId, uint currentParentId)`, raised on the authority as it makes the change and on each client as it applies the replicated one.

`ParentId` can be set before `Parent` resolves: the identifier arrives with the spawn or the re-parent entry, but the live reference is only wired up once every read for that tick has landed. Code that reacts to a parent change should read `ParentId`/`HasParent` rather than assume `Parent` is already populated in the same callback:

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

## Limits to design around

- **Only a dynamically spawned prefab can be a child.** A scene object's placement is authored, and a pure-code system has no engine object to re-seat, so neither is eligible as a child. Either kind of system can still be a parent.
- **Hierarchies nest at most 8 deep**, counted from a root. This bound also caps the despawn and interest walks that follow the parent link.
- **Despawning a parent cascades to its children.** Stopping a system stops every started descendant beneath it, deepest first, so a peer is never left holding a child whose parent is already gone. Objects not parented to the one being despawned are untouched.

For the full model — the resolved-versus-arrived distinction, the acyclic and same-scene checks the authority enforces, and how the child's Id, controller and access survive the move — see [Parents, children and hierarchy](../../core-api/systems/system-hierarchy).
