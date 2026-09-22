---
title: "Scene events and observers"
---

## Events on SceneManager

`SceneManager` raises seven events. Each has its own delegate.

| Event | Delegate | Raised on | When |
|---|---|---|---|
| `SceneLoadRequested` | `SceneLoadRequestedHandler(uint sceneHandle, ushort sceneId, bool isLoadRequested)` | client | The server asks the client to load or release a scene, before the loader is consulted. |
| `SceneLoadStateChanged` | `SceneLoadStateChangedHandler(Connection connection, uint sceneHandle, bool isLoaded)` | server | A client's answer changes which scenes it holds. |
| `SceneLoaded` | `SceneLoadedHandler(uint sceneHandle, ushort sceneId)` | whichever peer did the loading | This peer's own scene load finishes, after the outcome has been reported to the server. Raised on a server loading its own copy too. |
| `SceneUnloaded` | `SceneUnloadedHandler(uint sceneHandle, ushort sceneId)` | whichever peer did the unloading | This peer's own scene release finishes, after the report is sent. |
| `SceneLoadFailed` | `SceneLoadFailedHandler(uint sceneHandle, ushort sceneId)` | local peer | This peer's own load fails, after the failure has been reported to the server. |
| `ClientSceneLoadFailed` | `ClientSceneLoadFailedHandler(Connection connection, uint sceneHandle)` | server | A client reports it could not load a scene, after the pending request has been cancelled. |
| `SceneLoadProgressed` | `SceneLoadProgressedHandler(uint sceneHandle, ushort sceneId, float progress)` | local peer | This peer's own load advances, for a loading screen. Purely local; progress never reaches the wire. |

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

`SceneLoadStateChanged` fires only on a genuine change to what a client holds, and only once the record and interest re-resolution have already happened.

## ISceneObserver: the read-only alternative

`ISceneObserver` covers the same ground as three of the events, for code that wants to watch without adding its own event subscription per manager instance:

```csharp
public interface ISceneObserver
{
    void OnSceneRequested(Connection connection, uint sceneHandle, bool isLoadRequested);
    void OnSceneLoadStateChanged(Connection connection, uint sceneHandle, bool isLoaded);
    void OnSceneLoadFailed(Connection connection, uint sceneHandle);
}
```

Register any number of observers with `sceneManager.RegisterSceneObserver(observer)`, and remove one with `UnregisterSceneObserver`. Both the events above and the matching `ISceneObserver` callback are raised for the same occurrence, so use whichever form suits the call site. Registering the same observer twice is ignored; registering null is logged as an error.

## Reporting from a loader that is not the shipped one

A registered `ISceneLoader` reports automatically. A game driving its own loading calls these instead:

- `NotifySceneLoaded(uint sceneHandle, uint systemId = NetworkSystem.UnsetId)` — this client now holds the scene instance.
- `NotifySceneUnloaded(uint sceneHandle)` — this client has released a scene instance.
- `NotifySceneLoadFailed(uint sceneHandle, uint systemId = NetworkSystem.UnsetId)` — this client could not load a scene instance.
- `NotifySceneLoadProgress(uint sceneHandle, ushort sceneId, float progress)` — reports progress through a load, purely local. Nothing is sent; the server learns only whether the scene did or did not load, never how far along it got.

All three report methods are safe to call from any thread, and each is only sent in answer to a request the server actually made — a self-driven load the server never asked for loads locally and stays silent.

## Clearing a stuck client

A reported failure latches, so the server stops asking a client that cannot fetch the content. Re-arm it once whatever blocked the load has been addressed:

```csharp
bool cleared = sceneManager.ClearSceneLoadFailure(connection, sceneHandle);
```

Check whether a client is currently latched with `connection.HasSceneLoadFailed(sceneHandle)`.

## SceneLoadOutcome

A client reports one of four outcomes for a scene instance it was asked to load or release:

- **Loaded** — the client now holds the instance and can be served the objects inside it.
- **Released** — the client has released the instance it was asked to release.
- **Failed** — the client could not load the instance: content would not fetch, the scene would not resolve, or the load threw.
- **Refused** — the client's `ISceneLoader` is already at the limit set by `ISceneLoader.MaximumConcurrentScenes`; the loader was never consulted.

`Refused` and `Failed` both surface through `ClientSceneLoadFailed` and `ISceneObserver.OnSceneLoadFailed`, and neither raises `SceneLoadStateChanged` — the client holds nothing it did not hold before, so nothing about what it holds changed. Only `Failed` runs scene-carry-failure resolution for objects being carried into that scene; a refusal says only that the loader will not hold another scene at once, which the game fixes by moving the client with `SceneReplaceMode.AllScenes` rather than adding to what it holds, so nothing about the object itself is wrong.

## Violations

A client that answers about a scene it was never asked about did not merely send a stray message — it is trying to place or remove itself from scenes on its own, which is how it would serve itself content it was never admitted to. The server drives every load and release itself, so these settle as violations rather than ordinary reports.

- **UnsolicitedSceneReportViolation** — a client reports loading a scene it was never asked to load, or releasing one it was never asked to release. Carries `SceneHandle` and `IsLoadReported` (true for a claimed load, false for a claimed release).
- **UnexpectedSceneRequestViolation** — a client sends a scene load request, the message that only ever travels server to client. Carries `SceneHandle` and `IsLoadRequested`.

Both default to a kick.
