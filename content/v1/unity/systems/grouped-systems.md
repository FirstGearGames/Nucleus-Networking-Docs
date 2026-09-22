---
title: "Several systems on one object"
---

> **Driving the core API directly?** See [System groups](../../core-api/systems/system-groups)

## Why split one object into several systems

`NetworkSystemObject` is a marker: it links a GameObject to one or more `NetworkSystem` instances, not to exactly one. Splitting an object's networked state across several systems lets each one replicate on its own terms. Interest can stop one member for a distant observer — its transform, say — while another member on the same GameObject, one whose changes matter at any range, keeps replicating. The marker only reclaims the GameObject once every member has left it, so the object itself does not flicker in and out while its parts come and go independently.

## How it looks on the marker

`NetworkSystemObject` tracks every system linked to it:

- `Systems` — every linked system, in the order each one linked.
- `LinkedSystemCount` — how many are currently linked.
- `System` — the first-linked system, promoted to the next-oldest member if it leaves while others remain.
- `TryGetFirstSystem(out NetworkSystem networkSystem)` — the same first-linked system, as a bool-returning lookup.

`SystemsLinked` fires once the marker's whole set is assembled: an ungrouped object is a batch of one and fires on its first link, while a grouped object fires when its linked count reaches the group's replicated member count. A handler that subscribes after the set is already complete is invoked immediately rather than waiting for a completion that already happened, so a script that shows up late still runs.

```csharp
void Awake()
{
    GetComponent<NetworkSystemObject>().SystemsLinked += OnSystemsLinked;
}

void OnSystemsLinked(NetworkSystemObject networkSystemObject)
{
    if (networkSystemObject.TryGetFirstSystem(out NetworkSystem primary))
    {
        // Every member the group carries is present now — register remote-call
        // handlers or other object-wide work against the primary system here.
    }
}
```

## Renting a second system from a second script

`NetworkSystemObjectPool.RequireSystem<TSystem, TComponent0>(this, acquiredHandler, releasedHandler)` is what a component on a marker calls to declare its need, rather than renting directly: it resolves what to rent from the marker's situation and is timing-tolerant, so it works whether the script's Awake runs before or after the marker links a matching member. `NetworkAnimator`, for example, declares its own requirement this way:

```csharp
NetworkSystemObjectPool.RequireSystem<NetworkSystem, UnityAnimatorComponent>(this, OnSystemAcquired, OnSystemReleased);
```

A second script on the same GameObject calls `RequireSystem` for its own composition in its own `Awake`, exactly the same way. Each script's requirement is served once: `RequireSystem` records it and resolves it from whatever the marker already links or from a fresh rent, so the script never retries or guards against a double rent itself. The raw, context-aware `Rent<TSystem, TComponent0>` that `RequireSystem` calls into is the one-shot version, meant for a driver that wants its system back synchronously at a moment of its own choosing; calling it a second time against an already-linked marker is refused.

## How the spawn side ties them together

On the authority, `NetworkSystemObject.EnsureGroup` lazily rents a `NetworkSystemGroup` the first time a dynamic prefab's system is rented, and every later rent against that marker adds to the same group, so every member shares one non-unset `GroupId`.

`UnitySystemSpawnHandler.OnDynamicSystemSpawned` is what ties that GroupId back to a single GameObject on a receiver. It keeps a map of the marker hosting each active group, keyed by `GroupId`. The first member of a group to arrive finds nothing registered, so it instantiates the prefab and registers its marker against the group. A later member arriving with the same GroupId finds that marker already registered and links onto it instead of instantiating a second prefab.

## Despawn behaviour

`NetworkSystemObject.Despawn()` stops every system currently linked to the marker, so a grouped object's members leave together rather than one at a time. On a receiver, each member's despawn arrives and is unlinked in turn; `UnitySystemSpawnHandler.OnSystemDespawned` checks `LinkedSystemCount` after each unlink and only reclaims the GameObject once it reaches zero. Until the last member leaves, the object holds together.

Reclaiming means one of two things: a scene object is destroyed outright, since it is one fixed instance rather than a poolable prefab; a dynamic prefab is returned to the configured `INetworkPrefabPool` for reuse by a later spawn. Either way, the marker's `_systemGroup` is returned to its own pool once `LinkedSystemCount` reaches zero, so a reused instance rents a fresh group on its next spawn rather than inheriting the old GroupId.

An interest stop that keeps the object visible for one peer, rather than despawning it, is handled separately: the handler retains the GameObject keyed by the leaving system's Id instead of reclaiming it, so the spawn that arrives when that peer re-enters interest links onto the same GameObject rather than instantiating a second one.
