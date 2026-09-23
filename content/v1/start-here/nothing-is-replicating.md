---
title: "Nothing Is Replicating: A First-Run Checklist"
---

Scene compiles, both peers connect, and the second peer sees nothing: no spawned object, no scene content, no state. Work through these five checks in order — a first-run setup gap accounts for almost every case.

## 1. Prefab not registered

A dynamically spawned object is instantiated on a client from `NetworkPrefabRegistry`, keyed by the prefab's `(bundleId, localId)` wire identity. If the prefab was never registered under that identity, the spawn arrives and has nothing to instantiate:

```
No networked prefab is registered for identity [{bundleId}, {localId}]; spawned NetworkSystem Id [{id}] cannot be instantiated. Content shards must load and register before spawns arrive.
```

That log line is your confirmation. Causes: the prefab isn't in a `NetworkPrefabCollection` that has been built, its `NetworkSystemObject.PrefabId` is unset (rebuild the collection so it gets stamped), or its content shard/asset bundle hasn't loaded and called `RegisterAll` yet on the receiving peer.

## 2. Scene not networked

An object placed directly in a scene (`NetworkSystemObject.IsSceneObject` true, correlated by `SceneObjectId`) only binds once that scene is a live networked scene instance with a `sceneHandle` — not merely a scene Unity has loaded. The server opens the instance, and a client is placed in it through `SceneManager.RequestSceneLoad(connection, sceneHandle, ...)`. Load the scene with plain Unity APIs instead of going through Nucleus's scene system, or leave the scene out of the project's `NetworkSceneManifest`, and the scene's objects never get a handle to bind against.

## 3. No interest rule is admitting the object

By default every started `NetworkSystem` is registered to every authenticated client and nothing is filtered — but `UnityInterestManager` ships one interest rule on by default: `AuthoredSceneInterestCondition`, the scene gate. It withholds an object from a player until that player holds the same scene instance the object lives in. If the second peer hasn't been placed in that scene (see #2), the object is fully spawned on the server and still invisible to that client.

Check the **World Rules** list on `UnityInterestManager`, and the **Rules** list on the object's own `NetworkInterestObject`. Either can only restrict who receives the object, never expand it.

## 4. Wrong role branch

Spawn and write calls gated on the wrong role silently do nothing. `NetworkSystem` exposes `IsServerStarted`, `IsClientStarted`, `IsHostStarted`, and `IsController(ControllerType)` for exactly this; a spawn written inside a block guarded by the wrong one of these never runs on the peer that needed to run it. On a host, `IsServerStarted` and `IsClientStarted` are both true at once, which is the case most likely to hide a role mistake in testing.

## 5. Transport never started

`UnityTransportManager` connects nothing on its own unless **Automatic Start Mode** is set to `Server`, `Client`, or `Host` — its default is `None`. If you start the connection from code instead, confirm you actually called one of:

```csharp
await unityTransportManager.StartServerAsync();
await unityTransportManager.StartClientAsync();
await unityTransportManager.StartHostAsync();
```

`TransportManager.IsServerStarted` / `IsClientStarted` only go true once a connection reaches `LocalConnectionState.Connected` (the client side also needs to be authenticated) — a transport added but never connected leaves every system with nothing to send to.

## A host's own client is not proof of anything

If you're testing with a host and a second client, don't diagnose from what the host's own client half receives. A host's loopback packets — what the server side sent to itself — are discarded without ever being applied: in a Release build the discard happens before a single bit is read, so the header itself is never parsed; a Debug build reads the header first and discards after, for diagnostics, except for `PacketType.Raw`, which is exempt in Debug and compiled out of the enum entirely in Release. Either way, what the host's client half needs was already handed to it in-process at the point the server sent it, so this discard is expected and costs nothing. Seeing no traffic parsed on a host's own loopback is not evidence that serialization was skipped; check the second, genuinely remote peer instead.
