---
title: "Placing clients in scenes"
---

> **Using Unity?** See [UnitySceneManager component](../../unity/scenes/unity-scene-manager.md).

A client sees the objects in a scene instance only once it is placed in it. Only the server places clients.

## Load a client into a scene

`TryRequestSceneLoad(Connection connection, uint sceneHandle, SceneReplaceMode sceneReplaceMode = SceneReplaceMode.None, uint systemId = NetworkSystem.UnsetId)` asks one client to load a scene instance. It returns `true` only when a request was sent: a scene the client already holds, or has already reported it cannot load, is not asked for again.

```csharp
coreManager.SceneManager.TryRequestSceneLoad(connection, sceneHandle);
```

To place several clients, use `TryRequestSceneLoad(IReadOnlyList<Connection> connections, uint sceneHandle, SceneReplaceMode sceneReplaceMode = SceneReplaceMode.None)`. Each client is placed on its own, so one refused by a validator, already in the scene, or holding a recorded failure does not stop the rest. It returns how many requests were sent, which tells you when it did less than you asked.

```csharp
uint requestedCount = coreManager.SceneManager.TryRequestSceneLoad(connections, sceneHandle, SceneReplaceMode.None);
```

## Remove a client from a scene

`RequestSceneUnload(Connection connection, uint sceneHandle)` asks a client to release a scene instance it holds or is loading. The client stops receiving that scene's objects at once, not when it confirms.

The boot scene (`NetworkSystem.UnsetSceneHandle`) cannot be released this way.

## Replace what a client holds

`SceneReplaceMode` sets what a load does to the scenes a client already holds:

- `None` (default): keeps everything and adds this scene.
- `AllScenes`: releases every server-opened scene the client holds or is loading, then loads this one. The target is validated first, so a refusal leaves the client where it was.
- `AllScenesAfterLoad`: loads this scene first, and releases the others only once the client confirms it and acknowledges the state sent with that confirmation. Use it when an object must move with the client: releasing first would destroy the client's copy of the old scene before the move reaches it.

Use `AllScenes` or `AllScenesAfterLoad` rather than finding and unloading every other scene yourself.

## Choose where a new client lands

`SceneManager.JoinPlacement` (a `JoinScenePlacement`) decides what a client is placed into when it authenticates:

- `EveryOpenScene` (default): every open instance, whatever its scope. A `SceneScope.Connections` arena still gets every new client.
- `GlobalScenes`: only `SceneScope.Global` instances. Use this once your world uses private instances.
- `None`: nothing. The game places every client with `TryRequestSceneLoad`.

## Check who is in a scene

- `Connection.IsSceneLoaded(uint sceneHandle)`: whether one client has confirmed holding the scene. Always `true` for `NetworkSystem.UnsetSceneHandle`.
- `SceneManager.CollectConnectionsInScene(uint sceneHandle, List<Connection> connections)`: adds every client that has confirmed the load to the list. Clients still loading, or whose load failed, are not added. For `NetworkSystem.UnsetSceneHandle` it adds every connected client.

## Time out unanswered loads

`SceneManager.LoadRequestTimeoutSeconds` (default 180) is how long the server waits for a client to answer a load request. It catches a loader that never finishes: a stuck fetch, a hung load, or a client that stopped answering. Zero or less waits forever.

When it expires, the request is cancelled and recorded as a failure, the same as a failure the client reports. A late answer is ignored.

## Leave automatic placement off

`SceneManager.AutomaticRequestOnBlockedSpawnEnabled` (default `false`): when `true`, a client is asked into a scene as soon as a spawn is withheld because the client is not in it. That pulls every client into every open scene, so leave it off unless every client belongs in every scene, and place clients with `TryRequestSceneLoad`. The bundle manager's flag of the same name defaults to `true`.
