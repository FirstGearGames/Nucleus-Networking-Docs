---
title: "Registering a scene loader"
---

> **Using Unity?** See [UnitySceneLoader component](../../unity/scenes/unity-scene-loader.md).

Nucleus carries only a scene id, never a path, build index or asset reference, and the core engine ships no `ISceneLoader`. Until you register one, scene requests do nothing. The Unity integration ships two, `NetworkSceneLoader` and `UnitySceneLoader`.

## Implement ISceneLoader

```csharp
public interface ISceneLoader
{
    uint MaximumConcurrentScenes { get; }

    Task<bool> LoadSceneAsync(uint sceneHandle, ushort sceneId);

    Task<bool> UnloadSceneAsync(uint sceneHandle);
}
```

- `LoadSceneAsync` loads one live instance of the scene `sceneId`, keyed under `sceneHandle`. Return `true` on success.
- `UnloadSceneAsync` releases the instance at `sceneHandle`. Return `true` on success.

Both may await anything, such as a download or an asset load, and may finish on any thread. The network loop never blocks on them.

How a scene id maps to content (a scene asset, an address, a bundle) is up to your loader.

## Register it before any scene load

```csharp
sceneManager.SetSceneLoader(mySceneLoader);
```

Each `SceneManager` has one loader. There is no default and no fallback.

## Limit how many scenes a peer holds

`MaximumConcurrentScenes` is how many live scene instances this peer can hold at once. A loader that replaces the running world on each load can hold one; one that adds scenes alongside each other can hold any number. `SceneManager.UnlimitedConcurrentScenes` (0) means no limit.

A request over the limit never reaches `LoadSceneAsync`. It comes back as `SceneLoadOutcome.Refused` at once.
