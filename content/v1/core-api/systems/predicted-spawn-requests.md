---
title: "Predicted spawn and despawn requests"
---

> **Using Unity?** See [Client-predicted spawning in Unity](../../unity/systems/predicted-spawning).

Predicted spawning lets a client create or remove an object immediately, ahead of the authority agreeing, instead of waiting a round trip to find out whether it may. It is a Pro feature.

## Deny by default

Nothing is predictable until two things are both true:

- The object's type declares a `PredictedSpawnPolicy` other than `None` — `Spawn`, `Despawn`, `SpawnAndDespawn`, or `AllowUndeclaredComposition` layered on top of one of those. The policy lives on `NetworkSystem.PredictedSpawnPolicy` and defaults to `None`, so an object nobody has authored an opinion for predicts nothing.
- The authority has registered a `SystemManager.PredictedSpawnValidator` (for spawns) or `SystemManager.PredictedDespawnValidator` (for despawns). Every predicted spawn is refused while `PredictedSpawnValidator` is `null`, and every predicted despawn is refused while `PredictedDespawnValidator` is `null`.

Setting `PredictedSpawnValidator` is also what turns on lease serving: a session that never registers one can never admit a predicted spawn, so there's no point leasing identifiers to its clients. Registering a validator serves the lease to every client already authenticated and to everyone who authenticates afterwards.

`PredictedSpawnPolicy` is not replicated. Each peer reads its own copy — for a prefab, that's authored on the prefab and so the same everywhere; for a pure-code object, it's whatever that peer's own code set. The authority judging a predicted despawn reads its own object's policy rather than trusting the asking client's account of it.

`AllowUndeclaredComposition` is a separate concern from `Spawn`/`Despawn`: it permits a client to describe an object whose component composition no call site in this build declares. Without it, an undeclared composition is refused outright, because it's the shape of a client fabricating systems and components of its own.

## Asking

On a client, `SystemManager` exposes two methods:

```csharp
public bool EnsureStartPredictedSystem(NetworkSystem networkSystem, uint platformId, ushort prefabBundleId, uint sceneHandle, out PredictedSpawnRefusal predictedSpawnRefusal);

public bool EnsureStopPredictedSystem(NetworkSystem networkSystem, out PredictedSpawnRefusal predictedSpawnRefusal);
```

`EnsureStartPredictedSystem` creates the object locally right away and sends the authority a request describing it. Set the object's opening state before calling it, not after — the request carries a snapshot of the object's components taken during the call, and anything written afterward only reaches the authority if the object is also replicating it. `platformId` is the prefab's identifier within its shard (or `NetworkSystem.UnsetPlatformId` for an object with no engine prefab behind it), `prefabBundleId` is the content shard the prefab was registered from, and `sceneHandle` is the live scene instance the object belongs to (or `NetworkSystem.UnsetSceneHandle`).

`EnsureStopPredictedSystem` doesn't remove anything. It marks the object as going away — `NetworkSystem.IsPredictedDespawnPending` becomes true and `PredictedDespawnPending` fires — and sends the authority a request. The object stays started, routed and replicating in the meantime; inbound state still applies to it. If the authority agrees, its ordinary despawn arrives and removes the object through the same path any despawn uses. If it refuses, the pending flag clears and `PredictedDespawnRejected` fires on the same instance, which never went anywhere.

Both methods return `false` on a local refusal and report why through the `out PredictedSpawnRefusal` parameter, which is also raised as `SystemManager.PredictedSpawnRefused`. This is refusal by the client's own framework, before anything was created, removed, or sent — a host predicting nothing, an empty lease, a policy that doesn't admit what was asked, and so on. It's distinct from the authority refusing a request that actually reached it.

## Judging

On the authority, a spawn request is judged by a delegate:

```csharp
public delegate PredictedSpawnDecision PredictedSpawnValidatorHandler(in PredictedSpawnRequestContext predictedSpawnRequestContext);
```

`PredictedSpawnRequestContext` carries the whole of what the client is asking for, without anything having been constructed to produce it: `Connection`, `SystemType` (resolved against this build's own registry, not trusted from the wire), `Components` (a `PredictedSpawnComponents` view over the declared composition), `SystemId`, `GroupId`, `PlatformId`, `SceneHandle`, `PrefabBundleId`, `SystemBundleId`, `SystemLocalId`, `IsDeclaredComposition`, and `HasPrefab`. When `PredictedSpawnStateInspectionEnabled` is on, `PredictedSystem` is the actual object built with its opening state already applied, so the validator can judge real values instead of only shape.

The validator returns a `PredictedSpawnDecision`:

```csharp
public static PredictedSpawnDecision Permit(bool isRequesterController = false);
public static PredictedSpawnDecision Refuse();
```

`Permit` optionally hands the requesting client control of the object once it's built; the default is off, since the common predicted spawn is a projectile the authority simulates and nobody controls. Refusal is the default, including when no validator is registered at all.

A despawn request is judged the same shape, with less to check because the authority already holds the object:

```csharp
public delegate PredictedDespawnDecision PredictedDespawnValidatorHandler(in PredictedDespawnRequestContext predictedDespawnRequestContext);
```

`PredictedDespawnRequestContext` carries `Connection` and `System` — the authority's own live copy of the object, readable directly rather than described. The validator returns a `PredictedDespawnDecision` via `Permit()` or `Refuse()`, refusing by default.

## The lease

A client can't spend an identifier it doesn't already have, so the authority leases it a batch ahead of time. Four settings on `SystemManager` control the lease, and two report its current state.

| Member | What it controls |
|---|---|
| `PredictedSpawnLeaseSize` | How many spawns a client is kept holding — the burst it can predict in one round trip before waiting on the authority. Default 8. |
| `PredictedSpawnSystemIdsPerSpawn` | How many `NetworkSystem` identifiers each leased spawn carries — the most systems one predicted object can be built from. Default 8. An object needing more is refused as `PredictedSpawnRefusal.LeaseExhausted`. |
| `PredictedSpawnSystemLeaseSize` | `PredictedSpawnLeaseSize * PredictedSpawnSystemIdsPerSpawn` — the total system identifiers a client is kept holding. Read-only; it's the product, not a separate knob. |
| `PredictedSpawnsPerSecond` | How fast a client earns replacement identifiers, in spawns per second, or zero to replace them as fast as they're spent. Default 30. |
| `PredictedSpawnLeaseCount` | On a client, how many more objects it can predict right now. Zero on the authority. |
| `PredictedSpawnSystemLeaseCount` | On a client, how many more `NetworkSystem` identifiers it's holding. Zero on the authority. |

`PredictedSpawnLeaseSize` and `PredictedSpawnSystemIdsPerSpawn` count different things and it's easy to conflate them: the lease size is a quota on *objects* (one grouped prefab of five systems still draws one, the same as a single ungrouped system), while the per-spawn identifier count is the *supply* each of those objects draws from. Raise the lease size for a weapon that fires in real bursts; raise the per-spawn count for a prefab built from more systems.

`PredictedSpawnsPerSecond` is what stops the lease size alone from setting the real ceiling. Without pacing, a replacement served the instant a spawn is admitted makes the effective limit one lease per round trip — which hands the best-connected client the highest ceiling, since a 20ms link earns replacements far faster than a 200ms one for the same lease. The rate is what actually bounds a client, with the lease size only as the burst on top of it. It's counted per identifier rather than per object: a grouped prefab of three systems draws three against the rate, whatever the game calls one spawn.

A lease that's run dry answers `PredictedSpawnRefusal.LeaseExhausted` locally, without a request ever reaching the authority.

## Outcomes and events

On the predicting client, `NetworkSystem` raises:

- `PredictedSpawnConfirmed` — the authority's snapshot arrived, meaning it agrees the object exists. Raised before the snapshot's own state is applied.
- `PredictedSpawnRejected(PredictedSpawnRejectReason)` — the authority refused the object, raised immediately before the local copy is torn down.
- `PredictedDespawnPending` — the client has asked the authority to remove this object and is waiting.
- `PredictedDespawnRejected(PredictedDespawnRejectReason)` — the authority refused the removal. The object was never removed, so it just carries on.

`PredictedSpawnRejectReason` has eight values: `NotPermitted` (the ordinary refusal — the validator said no), `UnleasedId`, `UnknownType`, `SceneNotEntered`, `GroupMismatch`, `Malformed`, `NotPermittedByPolicy`, and `UndeclaredComposition`. `PredictedDespawnRejectReason` has four: `NotPermitted`, `NotPermittedByPolicy`, `UnknownSystem`, `NotObserved`.

On the client's `SystemManager`, `PredictedSpawnRefused` fires for a refusal the local framework made on its own, before anything reached the authority — see Asking above.

What happens to a predicted object's simulated state once the authority confirms it is controlled by `NetworkSystem.PredictedSpawnConfirmMode`:

- `ApplyAuthoritativeState` (default) — the confirming snapshot applies in full, so the object lands exactly where the authority built it. Any divergence between what the client predicted and what the authority built is shown, not hidden.
- `KeepPredictedState` — the snapshot is still read, but its member values are discarded; the object keeps the path the client already simulated, adopting only identity, controller and placement from the confirmation. Use this for an object whose local path must not visibly jump, typically a projectile the player is already watching.

## Inspecting state before deciding

`PredictedSpawnStateInspectionEnabled` builds the predicted object and reads its opening state before the validator runs, so the validator can judge actual values — a projectile's speed, a spawn position — rather than only the object's declared shape and type. It's off by default, because most validators don't need it: a composition and a prefab identity answer most questions.

The cost lands only on a refused request. With inspection on, the instance built for the look is the same one started if the validator permits the spawn, so the approved path pays nothing extra; only a refusal pays for a construction it didn't end up using.
