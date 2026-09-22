---
title: "Pooling spawned objects"
---

## The default cost

Every dynamic spawn instantiates a GameObject, and every despawn destroys one. For a busy spawn loop - projectiles, hit effects, anything that comes and goes at rate - that is a GC allocation and a destroy call per instance, on top of whatever the object's own `Awake` does. The integration lets you swap that behavior out without touching the spawn code that triggers it.

## The swap point: INetworkPrefabPool

`INetworkPrefabPool` is the interface the integration calls into on every dynamic spawn and despawn:

```csharp
GameObject Rent(GameObject prefabGameObject, ushort prefabBundleId, ushort prefabLocalId, Vector3 position, Quaternion rotation, Vector3 scale);

void Return(GameObject pooledGameObject, ushort prefabBundleId, ushort prefabLocalId);
```

`Rent` is called when a dynamic spawn needs an instance, `Return` when a despawn releases one. `prefabBundleId` and `prefabLocalId` are the prefab's wire identity - the same identity a `NetworkSystemObject` exposes as `PrefabBundleId` and `PrefabId` - and they key the pool: instances of different prefabs are never interchangeable.

The rent contract takes the pose, not just the prefab. `Rent` must apply `position`, `rotation` and `scale` before the instance runs any of its own code, because the integration already knows where a received spawn belongs before it asks for the instance. A script reading its transform from `Awake` or `OnEnable` needs to see that pose, not the prefab's authored one (which for most networked prefabs is the origin).

## DefaultNetworkPrefabPool vs NetworkPrefabPool

`DefaultNetworkPrefabPool` is the baseline: `Rent` instantiates at the given pose, `Return` destroys. No pooling happens; this is what the integration uses until you assign something else.

`NetworkPrefabPool` recycles instead. A returned instance is deactivated and parked under a shared, inactive pool root, keyed by prefab identity. A later `Rent` for that identity reactivates the longest-parked instance instead of instantiating a new one; only when nothing is eligible does it fall back to instantiating. It exposes three members for watching and tuning that behavior:

- `InstantiatedCount` - how many instances this pool has had to instantiate because nothing was parked. This is the cold-miss count.
- `ReusedCount` - how many rents were satisfied by reactivating a parked instance instead.
- `ReturnCooldownSeconds` - how long a returned instance must sit parked before a rent may reuse it. Zero reuses immediately; a positive value keeps just-returned instances visible and settled for a beat before they come back.

Reactivating a parked instance does not re-run `Awake`. A script that needs to re-establish per-life state on reuse should do it through `NetworkSystemObject.SystemLinked` / `SystemUnlinked`, not `Awake`.

## Installing a pool

Assign `NucleusUnity.PrefabPool`:

```csharp
NucleusUnity.PrefabPool = new NetworkPrefabPool { ReturnCooldownSeconds = 1f };
```

Assigning `null` restores the default (`DefaultNetworkPrefabPool`). The assignment takes effect whether the integration has been initialized yet or not, and applies for as long as it's set - a game that wants the default back later just assigns `null` again.

## What survives a pooled life, and what doesn't

A GameObject recycled by `NetworkPrefabPool` is not a fresh object as far as `NetworkSystemObject` is concerned. Its `SystemLinked` and `SystemUnlinked` subscriptions, and any standing `NetworkSystemRequest`s scripts on it made, are held across pooled lives and cleared only on true destruction (`OnDestroy`), never on a despawn that returns the object to the pool. That's deliberate: a recycled instance never runs a second `Awake`, so a co-located script that declared what it needs once keeps that declaration, and the next `Rent`'s link serves it again without re-declaring anything.

What does not survive a recycle is the `NetworkSystem` itself. The marker (`NetworkSystemObject`) is the stable GameObject-side identity across pooled lives; the `NetworkSystem` is what despawns and is pooled underneath, and it's also the RPC scope. When it's returned, its RPC handlers go with it - a script that registered a handler against that system needs to re-register against whatever system the next `Rent` links in, through `SystemLinked` rather than assuming the old registration still applies.

## Reading the plateau

`InstantiatedCount` climbs only on a cold miss - a rent with nothing eligible parked - so it settles at your peak concurrent instance count and stops growing once the pool has been through that many outstanding at once. `ReusedCount` keeps climbing after that, since every further rent is satisfied from the parked queue instead.

`ReturnCooldownSeconds` changes where that peak lands, not whether reuse happens. A longer cooldown holds returned instances out of circulation for longer, so a spawn burst arriving inside that window finds fewer eligible parked instances and instantiates more - pushing `InstantiatedCount`'s plateau higher. Zero lets a returned instance be reused on the very next rent, which minimizes the plateau at the cost of a just-despawned instance reappearing immediately if you wanted a beat of visible downtime instead.

## Two pools, one page

This page covers the GameObject pool - `INetworkPrefabPool`, the thing that decides whether a spawn gets a fresh `Instantiate` or a recycled instance. Underneath it, the `NetworkSystem` each GameObject links to is drawn from its own, separate pool on the engine side, keyed off the same despawn-return path described above. That pool has no Unity surface and no inspector assignment; see the API reference for `NetworkSystem` pooling for how it's tuned.
