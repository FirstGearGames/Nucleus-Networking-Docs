---
title: "Scene events and observers"
---

## SceneManager raises seven events

| Event | Delegate | Raised on | When |
|---|---|---|---|
| `SceneLoadRequested` | `SceneLoadRequestedHandler(uint sceneHandle, ushort sceneId, bool isLoadRequested)` | client | The server asks the client to load or release a scene, before the loader is called. |
| `SceneLoadStateChanged` | `SceneLoadStateChangedHandler(Connection connection, uint sceneHandle, bool isLoaded)` | server | A client's answer changes which scenes it holds. |
| `SceneLoaded` | `SceneLoadedHandler(uint sceneHandle, ushort sceneId)` | client | The client's `ISceneLoader` finishes a load the server asked for, after the outcome is reported. Not raised for the server's own copy, a host included: await `OpenSceneAsync` there, which returns the handle, or `NetworkSystem.UnsetSceneHandle` if the scene could not load. |
| `SceneUnloaded` | `SceneUnloadedHandler(uint sceneHandle, ushort sceneId)` | client | The client's `ISceneLoader` finishes a release the server asked for, after the report is sent. Not raised when the server closes its own copy: await `CloseSceneAsync` there. |
| `SceneLoadFailed` | `SceneLoadFailedHandler(uint sceneHandle, ushort sceneId)` | local peer | This peer's own load fails, after the failure is reported. Also raised on the server when `OpenSceneAsync` could not load the server's own copy. |
| `ClientSceneLoadFailed` | `ClientSceneLoadFailedHandler(Connection connection, uint sceneHandle)` | server | A client reports it could not load a scene, after the pending request is cancelled. |
| `SceneLoadProgressed` | `SceneLoadProgressedHandler(uint sceneHandle, ushort sceneId, float progress)` | local peer | This peer's own load advances, for a loading screen. Progress is never sent. |

```csharp
sceneManager.SceneLoadRequested += (sceneHandle, sceneId, isLoadRequested) =>
{
    // Show a loading screen, then load or release sceneId.
};

sceneManager.ClientSceneLoadFailed += (connection, sceneHandle) =>
{
    // Decide what happens to a client that could not fetch the scene.
};
```

`SceneLoadStateChanged` fires only when what a client holds actually changes, after interest has been updated.

## Watch with an ISceneObserver

`ISceneObserver` receives the same occurrences as three of the events, without an event subscription per manager:

```csharp
public interface ISceneObserver
{
    void OnSceneRequested(Connection connection, uint sceneHandle, bool isLoadRequested);
    void OnSceneLoadStateChanged(Connection connection, uint sceneHandle, bool isLoaded);
    void OnSceneLoadFailed(Connection connection, uint sceneHandle);
}
```

Register any number with `sceneManager.RegisterSceneObserver(observer)` and remove one with `TryUnregisterSceneObserver`. Registering the same observer twice is ignored; registering null logs an error. The events and the observer callbacks both fire for each occurrence.

## Report from your own loading code

A registered `ISceneLoader` reports for you. If your game loads scenes itself, call these on the client:

- `NotifySceneLoaded(uint sceneHandle, uint systemId = NetworkSystem.UnsetId)`: the client now holds the instance.
- `NotifySceneUnloaded(uint sceneHandle)`: the client released the instance.
- `NotifySceneLoadFailed(uint sceneHandle, uint systemId = NetworkSystem.UnsetId)`: the client could not load the instance.
- `NotifySceneLoadProgress(uint sceneHandle, ushort sceneId, float progress)`: local progress only. Nothing is sent.

The three report methods are safe to call from any thread. Each is sent only in answer to a request the server made, so a load the server never asked for stays local.

## Clear a stuck client

A reported failure is remembered, so the server stops asking a client that cannot fetch the content. Once the cause is fixed, clear it:

```csharp
bool cleared = sceneManager.TryClearSceneLoadFailure(connection, sceneHandle);
```

`connection.HasSceneLoadFailed(sceneHandle)` tells you whether a failure is recorded.

## A client reports one of four outcomes

`SceneLoadOutcome` for a scene the client was asked to load or release:

- **Loaded**: the client holds the instance and can be sent its objects.
- **Released**: the client released the instance.
- **Failed**: the load did not work. The content would not fetch, the scene would not resolve, or the load threw.
- **Refused**: the client's loader is already at `ISceneLoader.MaximumConcurrentScenes`. The loader was never called.

`Failed` and `Refused` both raise `ClientSceneLoadFailed` and `ISceneObserver.OnSceneLoadFailed`, and neither raises `SceneLoadStateChanged`. Only `Failed` triggers carry-failure handling for objects being carried into the scene (see [Moving and carrying objects between scenes](./moving-objects-between-scenes.md)). Fix a refusal by moving the client with `SceneReplaceMode.AllScenes` instead of adding the scene.

## Two violations catch a client acting on its own

- **UnsolicitedSceneReportViolation**: a client reports loading a scene it was never asked to load, or releasing one it was never asked to release. Carries `SceneHandle` and `IsLoadReported` (true for a claimed load, false for a claimed release).
- **UnexpectedSceneRequestViolation**: a client sends a scene load request, a message that only travels server to client. Carries `SceneHandle` and `IsLoadRequested`.

Both default to a kick.
