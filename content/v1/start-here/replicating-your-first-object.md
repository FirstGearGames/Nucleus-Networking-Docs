---
title: "Add a player"
---

> **Using plain .NET?** See [Replicate a value](./replicating-your-first-system.md).

This page gives every player a capsule that they move with WASD. Everyone else sees it move.

## Make the player prefab

1. Choose **GameObject > 3D Object > Capsule** and name it Player.
2. Add the `NetworkSystemObject` component. It marks the object as networked.
3. Add the `NetworkTransform` component. It sends the object's position and rotation to everyone else.
4. Create a script named `PlayerMover` with the code below, and add it to Player.
5. Drag Player into the Project window to make it a prefab, then delete it from the scene.

```csharp
using Nucleus.Integrations.Unity.Systems;
using Nucleus.Systems;
using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerMover : NucleusBehaviour
{
    [SerializeField]
    private float _speed = 5f;

    private void Update()
    {
        // Only the player who controls this capsule moves it.
        if (!IsController(ControllerType.Client))
            return;

        Keyboard keyboard = Keyboard.current;

        if (keyboard == null)
            return;

        Vector3 direction = Vector3.zero;

        if (keyboard.wKey.isPressed)
            direction.z += 1f;
        if (keyboard.sKey.isPressed)
            direction.z -= 1f;
        if (keyboard.dKey.isPressed)
            direction.x += 1f;
        if (keyboard.aKey.isPressed)
            direction.x -= 1f;

        transform.position += direction.normalized * (_speed * Time.deltaTime);
    }
}
```

`NucleusBehaviour` is the base class for scripts on a networked object. `IsController(ControllerType.Client)` is true only on the computer of the player who controls this capsule, so each player moves only their own.

The script reads the keyboard through Unity's Input System package, which new Unity 6 projects include.

## Spawn a player for everyone who joins

1. Create an empty GameObject named Player Spawner.
2. Add the `NetworkPlayerSpawner` component.
3. Drag the Player prefab into its **Player Prefab** field.

The spawner creates one Player for each player who joins, and gives that player control of it.

## Register the prefab

Choose **Tools > Nucleus**, select the **Build** tab, and click **Rebuild** next to **Rebuild Network Prefab Collection**.

A prefab cannot be spawned over the network until you do this. Do it again whenever you add, remove or duplicate a networked prefab.

## Press Play to check it

Press Play. A capsule appears, and WASD moves it.
