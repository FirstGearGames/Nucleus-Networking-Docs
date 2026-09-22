---
title: "NetworkSystemObject component"
---

## What it is

`NetworkSystemObject` is a `MonoBehaviour` and the single point of correlation between a GameObject and one or more `NetworkSystem` instances. It is `[DisallowMultipleComponent]`: exactly one marker per GameObject, on the root of a networked prefab or scene object.

An object normally links to one system. Several systems link to the same marker when a `NetworkSystemGroup` hosts more than one system on that GameObject; the first to link becomes `System`, and the rest are reachable through `Systems`.

## Inspector fields

### Required Bundle Override

- **Override Required Bundle** (`_requiredBundleOverrideEnabled`) — when off, the content bundle a client must hold before this object may spawn for it is read from the prefab. When on, `Required Bundle Id` is used instead.
- **Required Bundle Id** (`_requiredBundleId`) — the bundle to require when the override is on. An explicit `0` means "this object needs no content, whatever shard it ships in," which the toggle distinguishes from never having configured an override at all.

### Controller Retention Override

- **Override On Disconnect** (`_controllerRetentionOverrideEnabled`) — when off, the object takes its controller-retention behavior from the Unity System Manager's default. When on, `On Controller Disconnect` decides it for this object instead.
- **On Controller Disconnect** (`_controllerRetentionPolicy`) — `ControllerRetentionPolicy`, defaulting to `Retain`. Control is surrendered when the controller disconnects either way; this only decides whether the object is held so a returning player can be handed it back. The override is pushed onto the object's `NetworkSystemGroup.ControllerRetentionPolicyOverride` when the group is rented, not read continuously.

### Predicted Spawn Policy

`_predictedSpawnPolicy`, a `PredictedSpawnPolicy`, defaulting to `None`. It is authored on the prefab rather than set in code so every peer reads the same answer with nothing going on the wire for it. It is applied to each system as it links to this marker (`NetworkSystem.PredictedSpawnPolicy`).

## Stamped identity fields

Three fields are stamped by editor tooling and shown read-only in the inspector, never edited by hand: a scene object's `Scene Object Id`, or a prefab's `Prefab Id` and `Prefab Bundle Id` pair. The inspector shows one or the other depending on `IsSceneObject`, never all three at once.

## Runtime read surface

| Member | Type | Meaning |
|---|---|---|
| `System` | `NetworkSystem` | The first system linked to this object, or `null`. |
| `Systems` | `IReadOnlyCollection<NetworkSystem>` | Every system currently linked to this object. |
| `LinkedSystemCount` | `int` | The number of systems currently linked. |
| `TryGetFirstSystem(out NetworkSystem)` | `bool` | Resolves `System`; the canonical member to scope object-wide work against, such as an `IRpcScope` handler registration. |
| `PrefabId` | `ushort` | The prefab identifier assigned by the prefab collection build, or zero when unset. |
| `PrefabBundleId` | `ushort` | The content bundle whose collection stamped this prefab. |
| `RequiredBundleId` | `ushort` | The override when `_requiredBundleOverrideEnabled` is set, otherwise `PrefabBundleId`. |
| `SceneObjectId` | `uint` | This object's identifier within its scene, or zero when it is not a scene object. |
| `IsSceneObject` | `bool` | True when `SceneObjectId != 0`. |
| `PredictedSpawnPolicy` | `Nucleus.Systems.PredictedSpawnPolicy` | What a client may do to this object ahead of the server agreeing, as authored on the prefab. |

## Events

- **`SystemLinked(NetworkSystem)`** — raised once each time a system links to this marker.
- **`SystemUnlinked(NetworkSystem)`** — raised when a linked system is cleared on despawn.
- **`SystemsLinked(NetworkSystemObject)`** — raised once the object's whole set of members has linked: an ungrouped object fires on its first link, a grouped object fires when its linked count reaches the group's replicated member count. It re-fires each time a completed set is assembled, including after the group is later grown by a further spawn. A handler added after the object is already complete is invoked immediately on subscription, so a late subscriber is not missed.
- **`SystemsUnlinked(NetworkSystemObject)`** — raised once the object's last member unlinks.

## Despawn and reverse lookup

`Despawn()` stops every system linked to this object on the server, replicating the despawn to observers; a call with no linked system is a no-op. It is the pooling counterpart to destroying the GameObject, which despawns network-wide through `OnDestroy`.

`NetworkSystemObject.TryGetLinked(NetworkSystem, out NetworkSystemObject)` is the reverse of `System`: given a `NetworkSystem` handed to game code by the engine, it resolves the marker linked to it, or returns false if none is linked.

## RPC scope

The marker links to one or more `NetworkSystem`s, but it is the `NetworkSystem` itself, not `NetworkSystemObject`, that implements `IRpcScope`. Register remote-call handlers against a system resolved through `System`, `Systems`, or `TryGetFirstSystem`, never against the marker.
