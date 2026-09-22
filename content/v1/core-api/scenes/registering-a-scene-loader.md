---
title: "Registering a scene loader"
---

> **Using Unity?** See [UnitySceneLoader component](../../unity/scenes/unity-scene-loader).

The core engine carries a scene identifier and nothing else, no path, no build index, no asset reference. It has no notion of what a "scene" is on any given platform, so it ships no `ISceneLoader` implementation. Until one is registered, scene requests do nothing.

## The interface

```csharp
public interface ISceneLoader
{
    uint MaximumConcurrentScenes { get; }

    Task<bool> LoadSceneAsync(uint sceneHandle, ushort sceneId);

    Task<bool> UnloadSceneAsync(uint sceneHandle);
}
```

`LoadSceneAsync` loads one live instance of the scene identified by `sceneId`, keyed under `sceneHandle` for every scene object that registers into it. `UnloadSceneAsync` releases the instance at that handle. Both return a task resolving to `true` on success.

Both methods may await freely. The network loop never blocks on them, and whatever the task resumes with is marshalled back onto the loop itself, so an implementation can await a download, an asset load, or any engine operation without worrying about which thread it ends up on.

## Registering it

```csharp
sceneManager.SetSceneLoader(mySceneLoader);
```

One loader per `SceneManager`. There is no default and no fallback, register it before any scene load is requested.

## Concurrency limit

`MaximumConcurrentScenes` declares how many live scene instances this peer can hold at once. A loader that replaces the running world with each load can only ever hold one; a loader that adds a scene alongside what is already there can hold as many as it wants. Set it to `SceneManager.UnlimitedConcurrentScenes` (0) for no limit.

The engine enforces this limit itself, before the loader is ever consulted. A request that would exceed it never reaches `LoadSceneAsync`; it comes back as `SceneLoadOutcome.Refused` immediately.

## Mapping ids to content

The wire never carries a path or an asset reference, only the `ushort sceneId`. The mapping from that id to actual content (a scene asset, an address, a bundle) is entirely the loader's own. Nothing in the core engine constrains how that table is built or where it lives.

## Unity

The Unity integration ships two implementations of this interface, `NetworkSceneLoader` and `UnitySceneLoader`, so a Unity project does not need to write its own.
