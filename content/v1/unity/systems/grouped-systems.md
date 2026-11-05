---
title: "Several systems on one object"
---

> **Driving the core API directly?** See [System groups](../../core-api/systems/system-groups.md).

## Split an object so its parts replicate separately

One `NetworkSystemObject` can link several `NetworkSystem` instances. Each replicates on its own terms: interest can stop one, such as the transform, for a distant observer, while another whose changes matter at any range keeps replicating. The GameObject stays until every system has left it, so it does not flicker while its parts come and go.

All systems on one marker share one `GroupId`, and a receiver hosts them all on a single GameObject instead of instantiating the prefab again.

## Require a second system from a second script

Each script on the object declares its own need with `NetworkSystemObjectPool.RequireSystem` in its own `Awake`. `NetworkAnimator`, for example, does this:

```csharp
NetworkSystemObjectPool.RequireSystem<NetworkSystem, UnityAnimatorComponent>(this, OnSystemAcquired, OnSystemReleased);
```

Each requirement is served once, from a system the marker already links or from a fresh rent, whether the script's `Awake` runs before or after that system links. You never retry or guard against a double rent.

`TryRent<TSystem, TComponent0>` is different: each call rents and links another system, so calling it twice for the same need gives you two systems. Use it only when a driver wants its system back at once, at a moment of its own choosing.

## Run object-wide work once every system has linked

`SystemsLinked` fires once the marker's whole set is linked, and at once for a handler added after that. Register remote-call handlers or other object-wide work there:

```csharp
void Awake()
{
    GetComponent<NetworkSystemObject>().SystemsLinked += OnSystemsLinked;
}

void OnSystemsLinked(NetworkSystemObject networkSystemObject)
{
    if (networkSystemObject.TryGetFirstSystem(out NetworkSystem primary))
    {
        // Every system the group carries is present now. Register remote-call
        // handlers or other object-wide work against the primary system here.
    }
}
```

[NetworkSystemObject component](./network-system-object.md) lists `Systems`, `LinkedSystemCount`, `System` and the other events.

## Despawn one system or all of them

- `NetworkSystemObject.Despawn()` stops every linked system, so they leave together.
- `SystemManager.EnsureStopSystem` stops only that one system. The others stay linked and the GameObject stays.

On a receiver, the GameObject is reclaimed only when its last system leaves: a scene object is destroyed, and a dynamic prefab goes back to the configured `INetworkPrefabPool`. A reused instance gets a fresh `GroupId` on its next spawn.

When interest stops a system for one peer but keeps the object, the GameObject is kept, and the spawn that arrives when the peer re-enters interest links onto the same GameObject.
