---
title: "Pooling spawned objects"
---

## Install a pool to reuse spawned objects

By default every dynamic spawn instantiates a GameObject and every despawn destroys one. For objects that come and go often, such as projectiles or hit effects, assign `NetworkPrefabPool` to recycle them instead:

```csharp
NucleusUnity.PrefabPool = new NetworkPrefabPool { ReturnCooldownSeconds = 1f };
```

The assignment works before or after the integration starts, and lasts until you change it. Assign `null` to go back to `DefaultNetworkPrefabPool`, which instantiates on rent and destroys on return.

## Watch and tune NetworkPrefabPool

`NetworkPrefabPool` deactivates a returned instance and keeps it under an inactive pool root, keyed by prefab identity. A later rent for the same prefab reactivates the longest-parked instance, and instantiates only when none is eligible.

- `InstantiatedCount`: how many instances the pool has had to instantiate because nothing was parked. It settles at your peak number of instances alive at once.
- `ReusedCount`: how many rents reused a parked instance. It keeps climbing after `InstantiatedCount` settles.
- `ReturnCooldownSeconds`: how long a returned instance stays parked before it may be reused. `0` reuses it on the next rent and keeps the peak lowest. A longer cooldown keeps more instances out of use, so a burst instantiates more and `InstantiatedCount` settles higher.

## Reset per-life state through SystemLinked, not Awake

A reused instance does not run `Awake` again. What carries over between lives:

- Its `NetworkSystemObject` keeps its `SystemLinked` and `SystemUnlinked` subscriptions and the `RequireSystem` declarations its scripts made. They clear only when the GameObject is destroyed, so the next life is served without declaring anything again.
- The `NetworkSystem` does not carry over. It despawns with the old life, and so do the remote-call handlers registered on it. Register them again against the next system through `SystemLinked`.

Reset per-life state in `SystemLinked` and `SystemUnlinked`, or in `OnSystemLinked` and `OnSystemUnlinked` on a `NucleusBehaviour`.

## Write your own pool

Implement `INetworkPrefabPool`. Nucleus calls `Rent` when a dynamic spawn needs an instance and `Return` when a despawn releases one:

```csharp
GameObject Rent(GameObject prefabGameObject, ushort prefabBundleId, ushort prefabLocalId, Vector3 position, Quaternion rotation, Vector3 scale);

void Return(GameObject pooledGameObject, ushort prefabBundleId, ushort prefabLocalId);
```

- `prefabBundleId` and `prefabLocalId` are the prefab's identity, the same values a `NetworkSystemObject` exposes as `PrefabBundleId` and `PrefabId`. Key your pool on them: instances of different prefabs are never interchangeable.
- `Rent` must apply `position`, `rotation` and `scale` before the instance runs any of its own code, so a script reading its transform in `Awake` or `OnEnable` sees the spawn pose rather than the prefab's.
