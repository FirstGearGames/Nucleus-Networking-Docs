## General

A good example of stacking scenes is having dungeon instances on a single server. If two clients went into the same dungeon, each client will load their own copy of that dungeon and have individual GameObjects and state for those scenes. The server however has two instances of that scene loaded at once. The server having those two instances of the same scene loaded is called "Scene Stacking". Stacked scenes typically have different clients observing each instance of the scene.

## Stacking Scenes

### Loading into a New Stacked Scene

To stack scenes you must set `AllowStacking` to `true` in your `SceneLoadData`'s `Options`. To create a new instance of a stacked scene the `SceneLookupData` must be populated by using the scene name.

> **Note:** Global scenes cannot be stacked!

```csharp
// Select connections to load into new stacked scene.
NetworkConnection[] conns = new NetworkConnection[] { connA, connB };

// You must use the scene name to stack scenes!
SceneLoadData sld = new SceneLoadData("DungeonScene");

// Set AllowStacking option to true.
sld.Options.AllowStacking = true;

// Decide if you want separate physics for the scene.
sld.Options.LocalPhysics = LocalPhysicsMode.Physics3D;

// Load the scene via connections; you cannot stack global scenes.
base.SceneManager.LoadConnectionScenes(conns, sld);
```

### Loading into an Existing Stacked Scene

If you were to load two connections into a scene by scene reference or handle they will be added to the same scene, regardless of whether `AllowStacking` is `true` or not. This is identical to the examples given in the Loading Scenes guide on how to load into existing scenes.

## Separating Physics

You may want to separate physics while stacking scenes. This ensures that the stacked scenes' physics do not interact with each other. Set the `LocalPhysics` option in the `SceneLoadData`.

- `LocalPhysicsMode.None` — Default option. Scene physics will collide with other scenes in this state.
- `LocalPhysicsMode.Physics2D` — A local 2D physics scene will be created and owned by the scene.
- `LocalPhysicsMode.Physics3D` — A local 3D physics scene will be created and owned by the scene.

If you are using separate physics scenes and want to also simulate physics within them you must do so manually. Below is a script you can place in your stacked physics scenes to simulate physics alongside the default physics scenes.

```csharp
using FishNet.Object;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Synchronizes scene physics if not the default physics scene.
/// </summary>
public class PhysicsSceneSync : NetworkBehaviour
{
    [SerializeField] private bool _synchronizePhysics2D;
    [SerializeField] private bool _synchronizePhysics;

    private static HashSet<int> _synchronizedScenes = new HashSet<int>();

    public override void OnStartNetwork()
    {
        int sceneHandle = gameObject.scene.handle;
        if (_synchronizedScenes.Contains(sceneHandle))
            return;

        _synchronizePhysics = (gameObject.scene.GetPhysicsScene() != Physics.defaultPhysicsScene);
        _synchronizePhysics2D = (gameObject.scene.GetPhysicsScene2D() != Physics2D.defaultPhysicsScene);

        if (_synchronizePhysics || _synchronizePhysics2D)
        {
            _synchronizedScenes.Add(sceneHandle);
            base.TimeManager.OnPrePhysicsSimulation += TimeManager_OnPrePhysicsSimulation;
        }
    }

    public override void OnStopNetwork()
    {
        if (_synchronizePhysics || _synchronizePhysics2D)
        {
            _synchronizedScenes.Remove(gameObject.scene.handle);
            base.TimeManager.OnPrePhysicsSimulation -= TimeManager_OnPrePhysicsSimulation;
        }
    }

    private void TimeManager_OnPrePhysicsSimulation(float delta)
    {
        if (_synchronizePhysics)
            gameObject.scene.GetPhysicsScene().Simulate(delta);

        if (_synchronizePhysics2D)
            gameObject.scene.GetPhysicsScene2D().Simulate(delta);
    }
}
```
