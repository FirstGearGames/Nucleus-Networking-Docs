---
title: "Instantiating a Local Camera"
---

Using a Camera Prefab to instantiate your local player's camera.

With this method of camera management we will instantiate a camera from a prefab we create and assign it to our local player object when it spawns in.

## Step 1 — Creating a Camera Prefab

Drag the **Main Camera** in the scene into your Project Window to create a prefab out of it. You can now delete the Main Camera from the Scene Hierarchy.

## Step 2 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be where we instantiate and position the Camera object.

## Step 3 — Writing a PlayerCamera Script

Add the following `PlayerCamera` script to the Player Prefab. We will use it to instantiate our Camera Prefab once our player spawns in.

```csharp
using FishNet.Object;
using UnityEngine;

// This script will be a NetworkBehaviour so that we can use the OnStartClient override.
public class PlayerCamera : NetworkBehaviour
{
    [SerializeField] private Camera _cameraPrefab;
    [SerializeField] private Transform _cameraHolder;

    // This method will run on the client once this object is spawned.
    public override void OnStartClient()
    {
        // Since this will run on all clients that this object spawns for
        // we need to only instantiate the camera for the object we own.
        if (IsOwner)
            Instantiate(_cameraPrefab, _cameraHolder.position, _cameraHolder.rotation, _cameraHolder);
    }
}
```

This script uses the `OnStartClient` override method from `NetworkBehaviour` to instantiate the camera prefab for our local player.

## Step 4 — Assign Your References

Select the **Player Camera** component in your Player Prefab and add the Camera Prefab to the **Camera Prefab** field. Also select the CameraHolder game object in the **Camera Holder** field.

## Step 5 — Test in Game

With all that set, you should be able to run the game and see how the camera is created for only your local player.
