---
title: "Client-predicted spawning in Unity"
---

> **Driving the core API directly?** See [Predicted spawn and despawn requests](../../core-api/systems/predicted-spawn-requests.md).

Predicted spawning is a Pro feature. It lets a client create a prefab instance the instant it decides to, instead of waiting a round trip for the server to spawn it. The server still decides whether the object survives: it can confirm the client's guess or reject it, and the client finds out which.

## Marking the prefab

A `NetworkSystemObject` carries a **Predicted Spawn Policy** field: what a client may do to this object ahead of the server agreeing to it. The values are flags and can combine:

- `None` — the server alone creates and removes the object. This is the default.
- `Spawn` — a client may create the object at once and ask the server for it afterwards.
- `Despawn` — a client may remove the object at once and ask the server to remove it afterwards. Independent of `Spawn`: an object the server created can still be despawned predictively.
- `SpawnAndDespawn` — both of the above.
- `AllowUndeclaredComposition` — permits a predicted spawn whose component composition no call site in this build declares. Every composition a build can produce is normally named at some call site, so refusing an undeclared one is the safe default; this flag opts an object out of that check.

The policy is authored on the prefab, not passed in code, because it is never replicated. Every peer reads its own copy of the same prefab, so every peer answers the same question the same way without a bit of it going on the wire. That matters most on the server: it judges a predicted request against its own copy of the object, never against what the asking client claims.

## Asking for one

The common case is renting and asking in one step, through the normal pool rent. For an object whose opening state matters — the shot's origin and velocity, for example — rent it unstarted, write that state, then ask:

```csharp
GameObject projectileObject = Instantiate(_projectilePrefab, _muzzle.position, Quaternion.LookRotation(direction));
NetworkSystemObject marker = projectileObject.GetComponent<NetworkSystemObject>();

// Rented unstarted, so the shot can be written into the object before the request that carries it is sent.
if (!NetworkSystemObjectPool.TryRent<NetworkSystem, PredictedProjectileComponent>(marker, out NetworkSystem projectileSystem, canStartSystem: false))
{
    Destroy(projectileObject);
    return;
}

if (projectileSystem.TryGetComponent(out PredictedProjectileComponent projectileComponent))
{
    projectileComponent.Origin.Value = _muzzle.position.ToNative();
    projectileComponent.Velocity.Value = (direction * _projectileSpeed).ToNative();
}

if (NetworkSystemObjectPool.EnsureStartPredicted(marker, projectileSystem, out PredictedSpawnRefusal predictedSpawnRefusal))
{
    // Started and sent. Wait for PredictedSpawnConfirmed or PredictedSpawnRejected.
    return;
}

// Refused locally, before anything was sent to the server.
Destroy(projectileObject);
```

`EnsureStartPredicted` sends the request carrying a snapshot of the object taken as it is called, so anything the server needs to know about the object's birth has to be written before this runs. A request travels only once `predictedNetworkSystem` was rented with `canStartSystem: false` (or a caller otherwise holds an unstarted, grouped system) and `networkSystemObject.PredictedSpawnPolicy` includes `Spawn`.

A `false` return with a `PredictedSpawnRefusal` is this client's own framework declining before anything was sent — for example, its lease of group identifiers from the server has run dry. It is not the server's answer; nothing reached the server yet, and the object was never created.

## Watching the outcome

The server's answer arrives later, on the system the marker linked:

- `PredictedSpawnConfirmed` — raised when the server's snapshot for this object arrives, meaning the server agrees the object exists. It fires before the snapshot's own state is applied, so a handler still reads the values the client predicted.
- `PredictedSpawnRejected(PredictedSpawnRejectReason reason)` — raised when the server refuses the object, immediately before the local copy is torn down. Subscribe here to play whatever stands in for the thing that did not happen.
- `IsPredictedSpawnOrigin` — true on the client that created this object ahead of the server. It stays true after confirmation; it answers *which* peer predicted the object, not whether the prediction is still outstanding.
- `IsPredictedSpawnPending` — true while a predicted spawn is still waiting on the server.

```csharp
projectileSystem.PredictedSpawnConfirmed += OnShotConfirmed;
projectileSystem.PredictedSpawnRejected += reason => OnShotRejected(projectileObject, reason);
```

### When the server never answers

The request is sent once, and the client's upstream redundancy (`ClientRedundancy`) resends it on the ticks after, so a single lost packet does not lose it. If no answer arrives at all, the client gives up and despawns its local copy, raising `PredictedSpawnRejected` with `NotPermitted` first, as for an ordinary refusal. It waits two round trips, but never less than half a second and never more than three seconds, so on a bad link an object nobody agreed to does not stay on screen for long.

An answer can still arrive after the client gave up: the server admitted the spawn, but its confirmation was lost until after the timeout. The client then receives the server's object as an ordinary spawn, with the server's values, so both peers still end up holding the same object.

## Predicted despawn

The same system exposes the mirror image for removal, gated by the `Despawn` flag:

- `IsPredictedDespawnPending`: true between a client asking the server to remove the object and hearing back. The object is not despawned locally while this is set. It is parked instead: the GameObject is deactivated, so its renderers and colliders leave the world and its behaviours stop running, and the client can no longer change it (member writes from any script are ignored and it sends no client state or remote calls). It stays linked to a system that keeps receiving the server's state.
- `PredictedDespawnPending`: raised when the client's removal request goes out, after the GameObject has been parked.
- `PredictedDespawnRejected(PredictedDespawnRejectReason reason)`: raised when the server refuses the removal, after the GameObject has been reactivated. Its system kept receiving the server's values while it was parked, so it reappears where the server has it. This is the same instance throughout.

Ask with `coreManager.SystemManager.EnsureStopPredictedSystem(networkSystemObject.System, out PredictedSpawnRefusal refusal)`. The request travels with your client's state for that tick, so the server removes the object when it processes that tick, and the GameObject is then returned to the prefab pool like any despawned object. If the request is lost on the way, the client brings the GameObject back after at most three seconds and raises `PredictedDespawnRejected` with `NotPermitted`.

**Never destroy a networked GameObject on a client.** Asking is the only way a client removes one: a destroyed object cannot be brought back if the server refuses, and the stop its destruction triggers is refused on a client with an error, leaving the system registered with nothing linked to it.

## What a refused prediction looks like

A rejected spawn is visible for a moment and then gone: the object existed locally from the frame it was created, and it disappears a round trip later when `PredictedSpawnRejected` fires. Left unhandled, that reads as an object popping out of existence for no reason.

Handle the rejection to make it legible instead of jarring: a small poof, a sound, a HUD counter ticking up, whatever suits the object. The demo project's predicted-projectile gun does this for a fire-rate limit — every shot appears immediately, and a shot the server rejects for firing too fast destroys itself with a log line explaining why, rather than just vanishing.

## Authority side

Confirming or rejecting a predicted spawn, granting the identifier lease it rides on, and choosing the refusal reason are all decided on the server. See [Predicted spawn and despawn requests](../../core-api/systems/predicted-spawn-requests.md) for the validators, the lease, and the full set of refusal reasons.
