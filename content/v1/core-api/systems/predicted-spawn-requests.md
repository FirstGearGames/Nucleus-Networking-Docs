---
title: "Predicted spawn and despawn requests"
---

> **Using Unity?** See [Client-predicted spawning in Unity](../../unity/systems/predicted-spawning.md).

Predicted spawning lets a client create or remove an object at once, without waiting a round trip for the server to agree. It is a Pro feature.

## Turn it on for an object type

Nothing is predictable until both of these are true:

1. The object's `NetworkSystem.PredictedSpawnPolicy` is not `None` (the default). Use `Spawn`, `Despawn` or `SpawnAndDespawn`, optionally combined with `AllowUndeclaredComposition`.
2. The server has set `SystemManager.PredictedSpawnValidator` (for spawns) or `SystemManager.PredictedDespawnValidator` (for despawns). While either is `null`, every request of that kind is refused. Setting `PredictedSpawnValidator` also starts serving identifier leases to every authenticated client, now and later.

`PredictedSpawnPolicy` is not replicated; each peer reads its own copy. A prefab's policy is authored on the prefab, so it is the same everywhere. For a code-only object it is whatever that peer's code set. The server judges a despawn by its own copy, not the client's.

`AllowUndeclaredComposition` lets a client describe an object whose component composition no call site in this build declares. Without it, such a request is refused, because that is what a client fabricating its own systems looks like.

## Ask from the client

```csharp
public bool EnsureStartPredictedSystem(NetworkSystem networkSystem, uint platformId, ushort prefabBundleId, uint sceneHandle, out PredictedSpawnRefusal predictedSpawnRefusal);

public bool EnsureStopPredictedSystem(NetworkSystem networkSystem, out PredictedSpawnRefusal predictedSpawnRefusal);
```

Both are on `SystemManager`. Both return `false` when the client's own framework refuses before anything is created, removed or sent (a host, an empty lease, a policy that does not allow it), report why in `predictedSpawnRefusal`, and raise `SystemManager.PredictedSpawnRefused`. This is separate from the server refusing a request it received.

### Spawn

`EnsureStartPredictedSystem` creates the object locally and sends the server a request describing it.

- Set the object's opening values **before** the call. The request captures the components during the call; later writes reach the server only if the object also replicates them.
- `platformId` is the prefab's identifier within its bundle, or `NetworkSystem.UnsetPlatformId` for an object with no prefab.
- `prefabBundleId` is the content bundle the prefab was registered from.
- `sceneHandle` is the live scene instance, or `NetworkSystem.UnsetSceneHandle`.

### Despawn

`EnsureStopPredictedSystem` is the only way a client removes a networked object. A client cannot stop a replicated system, and destroying its engine object leaves nothing to bring back on a refusal.

The call parks the object rather than removing it:

- `NetworkSystem.IsPredictedDespawnPending` becomes true and `PredictedDespawnPending` fires.
- `INetworkSystemSpawnHandler.OnPredictedDespawnPendingChanged(networkSystem, isPredictedDespawnPending)` is called with `true`, and with `false` if the server refuses. Its default body is empty; the Unity integration deactivates the GameObject.
- The system stays started and the server's state still applies, but the client cannot change it: member writes are ignored, `TrySendRpc` returns false, no client state is sent, and it is not simulated.

The server removes the object on the tick the client asked, so everything the client did before the call ran with the object present. If the server refuses, the object comes back, the pending flag clears, and `PredictedDespawnRejected` fires on the same instance.

### When the server never answers

A single lost packet does not lose a request. If no answer arrives within two round trips (at least half a second, at most three seconds), the client gives up:

- A spawn is torn down, after `PredictedSpawnRejected` fires with `NotPermitted`.
- A despawn is undone, and `PredictedDespawnRejected` fires with `NotPermitted`.

If the server did admit a spawn but its answer arrived after the timeout, the client receives the server's object as an ordinary spawn, so both peers still hold the same object.

## Judge requests on the server

A spawn request is judged by a delegate:

```csharp
public delegate PredictedSpawnDecision PredictedSpawnValidatorHandler(in PredictedSpawnRequestContext predictedSpawnRequestContext);
```

`PredictedSpawnRequestContext` describes the request without building anything: `Connection`, `SystemType` (resolved against this build's own registry), `Components` (a `PredictedSpawnComponents` view of the declared composition), `SystemId`, `GroupId`, `PlatformId`, `SceneHandle`, `PrefabBundleId`, `SystemBundleId`, `SystemLocalId`, `IsDeclaredComposition` and `HasPrefab`.

Return a `PredictedSpawnDecision`:

```csharp
public static PredictedSpawnDecision Permit(bool isRequesterController = false);
public static PredictedSpawnDecision Refuse();
```

`Permit(true)` gives the requesting client control of the object. The default is off, since the common predicted spawn is a projectile nobody controls.

A despawn request is judged the same way:

```csharp
public delegate PredictedDespawnDecision PredictedDespawnValidatorHandler(in PredictedDespawnRequestContext predictedDespawnRequestContext);
```

`PredictedDespawnRequestContext` carries `Connection` and `System`, the server's own live object. Return `PredictedDespawnDecision.Permit()` or `Refuse()`.

### Inspect opening values before deciding

Turn on `PredictedSpawnStateInspectionEnabled` to have the server build the object with its opening state before the validator runs. `PredictedSpawnRequestContext.PredictedSystem` is then that object, so the validator can check real values such as a projectile's speed or a spawn position. It is off by default. A permitted spawn starts the instance that was inspected, so only a refused request costs an extra build.

## Size the identifier lease

A client spends identifiers the server leased to it ahead of time. These are on `SystemManager`:

| Member | Meaning |
|---|---|
| `PredictedSpawnLeaseSize` | How many objects a client can predict in a burst before waiting on the server. Default 8. |
| `PredictedSpawnSystemIdsPerSpawn` | How many `NetworkSystem` identifiers each leased spawn carries, so the most systems one predicted object can have. Default 8. An object needing more is refused as `PredictedSpawnRefusal.LeaseExhausted`. |
| `PredictedSpawnSystemLeaseSize` | Read-only: `PredictedSpawnLeaseSize * PredictedSpawnSystemIdsPerSpawn`. |
| `PredictedSpawnsPerSecond` | The sustained rate a client earns replacement spawns, or zero for no limit beyond the top-up cadence. Default 30. |
| `PredictedSpawnLeaseCount` | On a client, how many more objects it can predict now. Zero on the server. |
| `PredictedSpawnSystemLeaseCount` | On a client, how many more `NetworkSystem` identifiers it holds. Zero on the server. |

- The lease size counts objects: a grouped prefab of five systems draws one, like a single system. Raise it for a weapon that fires in bursts. Raise `PredictedSpawnSystemIdsPerSpawn` for a prefab built from more systems.
- Spent spawns are replaced at most every 0.3 seconds, or once per round trip on a slower link. That alone allows about 26 spawns a second at the default lease of 8. `PredictedSpawnsPerSecond` holds a larger lease to a sustained rate; at the default of 30 it starts limiting once the lease is above about 9, so raising the lease raises the burst, not the rate. Lower it for objects that are expensive to build.
- An empty lease refuses locally with `PredictedSpawnRefusal.LeaseExhausted`, without contacting the server.

## Handle the outcome on the client

`NetworkSystem` raises these on the predicting client:

- `PredictedSpawnConfirmed`: the server agrees the object exists. Raised before the server's state is applied.
- `PredictedSpawnRejected(PredictedSpawnRejectReason)`: the server refused the object. Raised just before the local copy is torn down.
- `PredictedDespawnPending`: the client asked to remove this object and is waiting.
- `PredictedDespawnRejected(PredictedDespawnRejectReason)`: the server refused the removal; the object comes back where the server has it.

| Enum | Values |
|---|---|
| `PredictedSpawnRejectReason` | `NotPermitted` (the validator refused), `UnleasedId`, `UnknownType`, `SceneNotEntered`, `GroupMismatch`, `Malformed`, `NotPermittedByPolicy`, `UndeclaredComposition` |
| `PredictedDespawnRejectReason` | `NotPermitted`, `NotPermittedByPolicy`, `UnknownSystem`, `NotObserved` |

`NetworkSystem.PredictedSpawnConfirmMode` sets what happens to the predicted state on confirmation:

- `ApplyAuthoritativeState` (default): the server's values apply in full, so the object lands where the server built it, and any difference shows.
- `KeepPredictedState`: the server's member values are discarded and the object keeps the path the client simulated, taking only identity, controller and placement. Use it for an object that must not visibly jump, such as a projectile the player is watching.
