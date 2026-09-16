---
title: "Using the Scene Camera"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/main-camera-in-scene.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/camera-holder-setup.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/assigned-camera-holder-to-player.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/player-camera-demonstration.gif)

Using the camera in the scene for your local player.

With this method our local player will take control of the Main Camera it finds in the scene.

## Step 1 — The Main Camera Tag

Before we start we need to ensure our camera object in the scene is tagged as **"Main Camera"**.

## Step 2 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be where we parent and position the Camera object.

## Step 3 — Writing a PlayerCamera Script

Add the following `PlayerCamera` script to the Player Prefab.

```csharp
using FishNet.Connection;
using FishNet.Object;
using UnityEngine;

// This script will be a NetworkBehaviour so that we can use the OnOwnershipClient override.
public class PlayerCamera : NetworkBehaviour
{
    [SerializeField] private Transform _cameraHolder;

    public override void OnOwnershipClient(NetworkConnection prevOwner)
    {
        if (Camera.main == null) return;

        if (IsOwner)
        {
            Camera.main.transform.SetPositionAndRotation(_cameraHolder.position, _cameraHolder.rotation);
            Camera.main.transform.SetParent(_cameraHolder);
        }
    }
}
```

This script uses the `OnOwnershipClient` override method to take control of the camera as soon as the local client gets ownership of the player object.

## Step 4 — Assign Your References

Select the **Player Camera** component in your Player Prefab and select the CameraHolder game object in the **Camera Holder** field.

## Step 5 — Test in Game

With all that set, you should be able to run the game and see how the camera from the scene is controlled by only your local player.
