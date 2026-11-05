---
title: "NetworkSystemObject component"
---

## NetworkSystemObject links a GameObject to its systems

Put one `NetworkSystemObject` on the root of each networked prefab or scene object. It links the GameObject to one or more `NetworkSystem` instances. An object normally links one system; it links several when a `NetworkSystemGroup` hosts more than one system on it (see [Several systems on one object](./grouped-systems.md)).

## Set it up in the inspector

| Section | Field | Purpose |
|---|---|---|
| Identity | **Scene Object Id**, or **Prefab Id** and **Prefab Bundle Id** | Read-only, stamped by the editor. A scene object shows its scene object id; a prefab shows its prefab id and bundle id. See [Prefab identity and the prefab collection](./prefab-ids-and-collections.md). |
| Predicted Spawning | **Predicted Spawn Policy** (default `None`) | What a client may do to this object before the server agrees: create it, remove it, both or neither. The server still decides. It is applied to each system as it links (`NetworkSystem.PredictedSpawnPolicy`). See [Client-predicted spawning in Unity](./predicted-spawning.md). |
| Prediction | **Predicted By Observers** | Observing clients predict this object as its controller does. See [Predicting a body with a validated behaviour](../physics/predicting-a-body-with-a-validated-behaviour.md). |
| Content Bundle | **Override Required Bundle** | Off, the content bundle a client must hold before this object may spawn for it is read from the prefab. On, **Required Bundle Id** is used instead. |
| Content Bundle | **Required Bundle Id** | The bundle to require when the override is on. `0` means the object needs no content, whichever bundle it ships in. |
| Controller Retention | **Override On Disconnect** | Off, the object uses the Unity System Manager's default for what happens when its controller disconnects. On, **On Controller Disconnect** decides it for this object. |
| Controller Retention | **On Controller Disconnect** (default `Retain`) | Control is surrendered when the controller disconnects either way; this decides only whether the object is held so a returning player can be handed it back. The value is applied when the object's group is rented, not read continuously. |
| Spawn Payload | **Payload** and **Auto Transform Payload** | One-time data sent with the spawn. See [Spawning and despawning objects](./spawning-objects.md). |

A duplicated prefab carries the same **Prefab Id** as its source. Rebuilding the prefab collection gives the copy a new id; see [Prefab identity and the prefab collection](./prefab-ids-and-collections.md).

## Read it from a script

| Member | Type | Meaning |
|---|---|---|
| `System` | `NetworkSystem` | The first system linked to this object, or `null`. If it leaves while others remain, the next-oldest takes its place. |
| `Systems` | `IReadOnlyCollection<NetworkSystem>` | Every linked system, in the order each linked. |
| `LinkedSystemCount` | `int` | How many systems are linked. |
| `TryGetFirstSystem(out NetworkSystem)` | `bool` | Resolves `System`. Use it for object-wide work, such as registering remote-call handlers. |
| `PrefabId` | `ushort` | The prefab identifier stamped by the prefab collection build, or zero when unset. |
| `PrefabBundleId` | `ushort` | The content bundle whose collection stamped this prefab. |
| `RequiredBundleId` | `ushort` | **Required Bundle Id** when **Override Required Bundle** is on, otherwise `PrefabBundleId`. |
| `SceneObjectId` | `uint` | This object's identifier within its scene, or zero when it is not a scene object. |
| `IsSceneObject` | `bool` | True when `SceneObjectId` is not zero. |
| `PredictedSpawnPolicy` | `Nucleus.Systems.PredictedSpawnPolicy` | The policy authored on the prefab. |

`NetworkSystemObject.TryGetLinked(NetworkSystem, out NetworkSystemObject)` goes the other way: it finds the marker linked to a system, or returns false when none is.

Remote-call handlers belong on a `NetworkSystem`, which implements `IRpcScope`, never on the marker. Resolve the system through `System`, `Systems` or `TryGetFirstSystem`.

## Subscribe to its events

- **`SystemLinked(NetworkSystem)`**: raised each time a system links.
- **`SystemUnlinked(NetworkSystem)`**: raised when a linked system is cleared on despawn.
- **`SystemsLinked(NetworkSystemObject)`**: raised once the object's whole set of systems has linked. An ungrouped object raises it on its first link; a grouped object raises it when its linked count reaches the group's member count. It is raised again each time a complete set is assembled, including after the group grows. A handler added after the set is complete is called at once.
- **`SystemsUnlinked(NetworkSystemObject)`**: raised once the last system unlinks.

## Despawn the object

`Despawn()` stops every system linked to this object on the server and replicates the despawn to observers. A call with no linked system does nothing. Use it instead of destroying the GameObject when the instance should go back to the prefab pool; destroying the GameObject also despawns it network-wide. See [Spawning and despawning objects](./spawning-objects.md).
