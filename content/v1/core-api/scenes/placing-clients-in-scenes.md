---
title: "Placing clients in scenes"
---

> **Using Unity?** See [UnitySceneManager component](../../unity/scenes/unity-scene-manager.md).

Placing a client in a scene instance is what entitles it to see the objects inside. `SceneManager` drives every load and unload; the client never decides on its own.

## Loading a connection into a scene

`RequestSceneLoad(Connection connection, uint sceneHandle, SceneReplaceMode sceneReplaceMode = SceneReplaceMode.None, uint systemId = NetworkSystem.UnsetId)` asks one client to load a live scene instance. It is deduped per connection and scene: a scene the client already holds, or has already reported it cannot load, is not asked for again. It returns `true` only when a request was actually sent.

```csharp
coreManager.SceneManager.RequestSceneLoad(connection, sceneHandle);
```

There is also an overload for several clients at once:

```csharp
uint requestedCount = coreManager.SceneManager.RequestSceneLoad(connections, sceneHandle, SceneReplaceMode.None);
```

`RequestSceneLoad(IReadOnlyList<Connection> connections, uint sceneHandle, SceneReplaceMode sceneReplaceMode = SceneReplaceMode.None)` places each client independently: one refused by a validator, already in the scene, or holding a recorded failure does not stop the rest. It returns how many clients a request was actually sent to, which tells you when the placement did less than you asked.

## Removing a connection from a scene

`RequestSceneUnload(Connection connection, uint sceneHandle)` asks a client to release a scene instance it holds, or is on its way into. The scene a client booted into (`NetworkSystem.UnsetSceneHandle`) cannot be released this way; every peer is considered to be in it and none can report leaving it.

The client stops being served that scene's objects immediately, not when it confirms the release. `RequestSceneUnload` marks the client as leaving and drops it as an observer of that scene's systems before the unload message even goes out, so the interest gate withholds anything new for that scene right away, and existing observers are torn down as part of the call rather than left standing until the client answers.

## Replacing what a connection holds

`SceneReplaceMode` controls what a load does to the scenes a client already holds:

- **`None`** (the default) - keeps everything the client holds and adds this scene to it.
- **`AllScenes`** - releases every server-opened scene the client holds or is loading, then loads this one. The target is validated before anything is released, so a refusal leaves the client where it was.
- **`AllScenesAfterLoad`** - loads this scene first, and only releases the client's other scenes once it confirms this one and acknowledges the state that went out with the confirmation. This is what to use when an object needs to move with the client rather than be rebuilt: releasing first would destroy the client's copy of everything in the scene it's leaving before the move can ride across.

The replace form exists because the removal half is easy to forget: passing `SceneReplaceMode.None` and manually calling `RequestSceneUnload` for every other scene the client holds means finding all of them yourself and getting the ordering right. `AllScenes` and `AllScenesAfterLoad` fold that bookkeeping into the load call itself.

## Where a newly authenticated client lands

`SceneManager.JoinPlacement` (type `JoinScenePlacement`) decides what a client is placed into the moment it authenticates, before the game asks for anything:

- **`EveryOpenScene`** (the default) - every live scene instance the server has open, whatever it was opened for. This overrides `SceneScope`, so a `SceneScope.Connections` arena still gets every new client while this is set.
- **`GlobalScenes`** - every `SceneScope.Global` instance, and nothing else. This is the answer once a world starts instancing: shared scenes opened `Global` still place everyone, but `Connections` instances place nobody.
- **`None`** - nothing. The game places every client itself, entirely through `RequestSceneLoad`.

## Reading occupancy

`Connection.IsSceneLoaded(uint sceneHandle)` answers the question for one client: it returns `true` for `NetworkSystem.UnsetSceneHandle` (the scene every peer booted into) and otherwise reports whether that client has confirmed holding the scene.

`SceneManager.CollectConnectionsInScene(uint sceneHandle, List<Connection> connections)` answers it for a whole scene, adding every client that has confirmed the load to the supplied list. A client that has been asked and hasn't answered yet is not counted, and neither is one whose load failed. Asked about `NetworkSystem.UnsetSceneHandle` it adds every connected client.

## Load requests that go unanswered

`SceneManager.LoadRequestTimeoutSeconds` (default 180, three minutes) bounds how long the server waits for a client to answer a load request. The request itself rides the reliable channel, so it always arrives; the timeout is for a client whose loader never finishes - a scene stuck fetching, a hung load, a client that stopped answering.

Setting it to zero or less turns the timeout off and the server waits indefinitely. When it expires, the request is cancelled and latched as a failure exactly as a client-reported failure is, and an answer that arrives afterward is discarded rather than acted on.

## Placing a client from a blocked spawn

`SceneManager.AutomaticRequestOnBlockedSpawnEnabled` defaults to `false`. When `true`, a client would be placed in a scene the moment a spawn is withheld for want of it. It's off by default here, unlike the equivalent flag on the bundle manager (which defaults to `true`), because being in a scene is what *entitles* a client to its objects in the first place - inferring placement from a withheld spawn would pull every connected client into every open scene. Leave placement to a deliberate `RequestSceneLoad` call unless every client genuinely belongs in every scene you open.
