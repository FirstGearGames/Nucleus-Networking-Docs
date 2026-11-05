---
title: "Client-predicted spawning in Unity"
---

> **Driving the core API directly?** See [Predicted spawn and despawn requests](../../core-api/systems/predicted-spawn-requests.md).

Predicted spawning is a Pro feature. A client creates a prefab instance the moment it decides to, instead of waiting a round trip for the server. The server still decides whether the object survives, and the client finds out which. The server's side, including its validators and every refusal reason, is on [Predicted spawn and despawn requests](../../core-api/systems/predicted-spawn-requests.md).

## Mark the prefab

Set **Predicted Spawn Policy** on the prefab's `NetworkSystemObject`. The values are flags and can combine:

- `None` (default): only the server creates and removes the object.
- `Spawn`: a client may create the object at once and ask the server afterwards.
- `Despawn`: a client may remove the object at once and ask the server afterwards, even an object the server created.
- `SpawnAndDespawn`: both of the above.
- `AllowUndeclaredComposition`: permits a predicted spawn whose component composition no call site in this build declares. Without it, such a spawn is refused.

Every peer reads the policy from its own copy of the prefab; it is never sent. The server judges a request against its own copy, never against what the client claims.

## Ask for a predicted spawn

In the common case, the normal pool rent rents the object and asks in one step. When the object's opening values matter, ask in three steps:

1. Rent the object's system unstarted (`canStartSystem: false`).
2. Write everything the server needs to know about the object's birth, such as a shot's origin and velocity.
3. Call `NetworkSystemObjectPool.EnsureStartPredicted`. It sends a snapshot of the object as it is at that moment.

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

A request is sent only when the system is unstarted and grouped, as a `canStartSystem: false` rent gives you, and the policy includes `Spawn`. A `false` return with a `PredictedSpawnRefusal` means this client declined before sending anything, for example because its lease of group identifiers from the server has run out. It is not the server's answer.

## Watch the outcome

The server's answer arrives on the system the marker linked:

- `PredictedSpawnConfirmed`: raised when the server's snapshot for the object arrives. It fires before that snapshot is applied, so a handler still reads the values the client predicted.
- `PredictedSpawnRejected(PredictedSpawnRejectReason reason)`: raised when the server refuses the object, just before the local copy is torn down.
- `IsPredictedSpawnOrigin`: true on the client that created the object. It stays true after confirmation.
- `IsPredictedSpawnPending`: true while the spawn is still waiting on the server.

```csharp
projectileSystem.PredictedSpawnConfirmed += OnShotConfirmed;
projectileSystem.PredictedSpawnRejected += reason => OnShotRejected(projectileObject, reason);
```

A rejected object appears and then vanishes a round trip later. Handle `PredictedSpawnRejected` with a small effect, a sound or a HUD message so it does not just pop out of existence. The demo project's predicted-projectile gun destroys a shot rejected for firing too fast with a log line explaining why.

If no answer arrives, the client despawns its copy and raises `PredictedSpawnRejected` with `NotPermitted`. It waits two round trips, but never less than half a second or more than three seconds. A lost request is resent on the following ticks, so one lost packet does not lose it. If the server did admit the spawn and its answer arrives after the client gave up, the client receives the server's object as an ordinary spawn, so both peers still hold the same object.

## Predict a despawn

With the `Despawn` flag, ask with `coreManager.SystemManager.EnsureStopPredictedSystem(networkSystemObject.System, out PredictedSpawnRefusal refusal)`.

- `PredictedDespawnPending` is raised when the request goes out. The object is parked, not despawned: the GameObject is deactivated, so its renderers and colliders leave the world and its behaviours stop. Member writes from any script are ignored, and it sends no client state or remote calls. It keeps receiving the server's state.
- `IsPredictedDespawnPending` is true until the server answers.
- If the server agrees, it removes the object on the tick the request rode with, and the GameObject returns to the prefab pool like any despawned object.
- `PredictedDespawnRejected(PredictedDespawnRejectReason reason)` is raised when the server refuses, after the same GameObject is reactivated where the server has it.
- If the request is lost, the client brings the GameObject back after at most three seconds and raises `PredictedDespawnRejected` with `NotPermitted`.

**Never destroy a networked GameObject on a client.** A destroyed object cannot come back if the server refuses, and the stop its destruction triggers is refused on a client with an error, leaving the system registered with nothing linked to it.
