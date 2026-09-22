---
title: "Networked scenes in Unity"
---

> **Driving the core API directly?** See [Opening and closing scene instances](../../core-api/scenes/opening-scene-instances).

## Add the manager and loader

Put a `UnitySceneManager` on the same object as your `UnityCoreManager` (or anywhere it can find one). It drives the core `SceneManager` for you: on `ManagersInstantiated` it copies its `Join Placement`, `Automatic Request On Blocked Spawn Enabled` and `Scene Load Timeout Seconds` fields onto the core manager, then makes sure some scene loader exists.

That last step, `EnsureSceneLoader`, only fires when `Scene Loader Enabled` is on and no `NetworkSceneLoader` is found anywhere in the loaded scenes (inactive objects count). If it finds none, it adds a `UnitySceneLoader` component to its own GameObject and sets its `LocalPhysicsEnabled` from `Automatic Stacked Scene Simulation Enabled`. If a loader already exists, `UnitySceneManager` leaves it alone.

A `UnitySceneLoader` registers itself: `NetworkSceneLoader.Initialize(CoreManager)` runs from `Awake` whenever its `Automatic Registration Enabled` toggle is on, which is the default. Turn that off only if you construct or register the loader yourself, later, with your own call to `Initialize`. Either way, `UnitySceneManager` never binds the loader to the manager itself - registration is the loader's own job.

For a first pass, leave both defaults on: add `UnitySceneManager`, let it add a `UnitySceneLoader`, and move on.

## Give the scene a wire id

Add your second scene to Build Settings. Then run **Nucleus > Rebuild Network Scene Manifest** from the menu - this is what stamps every scene in Build Settings with an id in the project's `NetworkSceneManifest` and is what `UnitySceneLoader` resolves ids against. In practice you rarely have to run it by hand: `NetworkSceneManifestAutoRebuild` hooks Unity's build scene list and rebuilds the manifest whenever it changes, so the menu command is a fallback for when that hasn't happened yet.

`UnitySceneLoader` has a `Scene Manifest` field, but its tooltip says it plainly: leave it empty. An empty field resolves to the project's own manifest automatically, and assigning one only makes sense if your project deliberately keeps more than one manifest. For a single-manifest project, don't touch this field at all.

## Open an instance from a script

The manager exposes the core scene manager it drives as `NucleusSceneManager` on the `UnitySceneManager` component:

```csharp
ushort sceneId; // the id the manifest gave your scene
if (unitySceneManager.NucleusSceneManager.TryOpenScene(sceneId, SceneScope.Connections, out uint sceneHandle))
{
    unitySceneManager.NucleusSceneManager.RequestSceneLoad(connection, sceneHandle);
}
```

`TryOpenScene` only opens the instance on the authority - it records the handle and, for `SceneScope.Connections`, places nobody. Nothing loads on a client until you ask for it with `RequestSceneLoad(connection, sceneHandle)`, which is the step that actually tells that connection to load the scene.

Skip `RequestSceneLoad` and nothing goes wrong loudly: the instance exists on the authority, but no client was ever told to load it, so the scene simply never appears on the other end. There's no error for it, because from the engine's side you never asked.

## Join placement only covers new joins

`SceneScope.Global` places every currently connected client the moment you open the instance, and places each later client as it authenticates. But that placement path runs from `OnClientAuthenticated` only - it fires for a client at the moment it joins, not for scenes opened afterwards. `Join Placement` (`UnitySceneManager`'s field, `JoinPlacement` on the core manager) governs that same join-time moment: which of the open scenes a freshly authenticated client is dropped into.

None of this reaches a client that's already connected when you open a new scene, even a `Global` one - that placement already happened, or didn't need to, before this scene existed. Any scene opened after clients have joined needs its own explicit `RequestSceneLoad` per connection you want in it, `SceneScope.Global` included.

## Where the two halves live

The inspector fields you just set - `Scene Loader Enabled`, `Join Placement`, `Automatic Request On Blocked Spawn Enabled`, `Scene Load Timeout Seconds`, `Automatic Stacked Scene Simulation Enabled`, and the loader's `Scene Manifest` and `Local Physics Enabled` - are documented on the `UnitySceneManager` reference page. The calls you made from script - `TryOpenScene`, `RequestSceneLoad`, and the rest of the core `SceneManager` API - are documented on the scene API pages under Core API.
