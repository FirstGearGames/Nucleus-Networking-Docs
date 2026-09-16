---
title: "Overview"
---

## Instantiating a Local Camera

Using a Camera Prefab to instantiate your local player's camera.

With this method of camera management we will instantiate a camera from a prefab we create and assign it to our local player object when it spawns in.

### Step 1 — Creating a Camera Prefab

Drag the **Main Camera** in the scene into your Project Window to create a prefab out of it. You can now delete the Main Camera from the Scene Hierarchy.

### Step 2 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be where we instantiate and position the Camera object.

### Step 3 — Writing a PlayerCamera Script

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

### Step 4 — Assign Your References

Select the **Player Camera** component in your Player Prefab and add the Camera Prefab to the **Camera Prefab** field. Also select the CameraHolder game object in the **Camera Holder** field.

### Step 5 — Test in Game

With all that set, you should be able to run the game and see how the camera is created for only your local player.

---

## Using the Scene Camera

Using the camera in the scene for your local player.

With this method our local player will take control of the Main Camera it finds in the scene.

### Step 1 — The Main Camera Tag

Before we start we need to ensure our camera object in the scene is tagged as **"Main Camera"**.

### Step 2 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be where we parent and position the Camera object.

### Step 3 — Writing a PlayerCamera Script

Add the following `PlayerCamera` script to the Player Prefab.

```csharp
using FishNet.Connection;
using FishNet.Object;
using UnityEngine;

// This script will be a NetworkBehaviour so that we can use the OnOwnershipClient override.
public class PlayerCamera : NetworkBehaviour
{
    [SerializeField] private Transform _cameraHolder;

    // This method is called on the client after gaining or losing ownership of the object.
    // We could have used OnStartClient instead, but using OnOwnershipClient
    // means this will work for a player object we don't initially own but are given ownership to later.
    public override void OnOwnershipClient(NetworkConnection prevOwner)
    {
        if (Camera.main == null) return;

        // If we are the new owner, take control of the camera by parenting it
        // and moving it to our camera holder.
        if (IsOwner)
        {
            Camera.main.transform.SetPositionAndRotation(_cameraHolder.position, _cameraHolder.rotation);
            Camera.main.transform.SetParent(_cameraHolder);
        }
    }
}
```

This script uses the `OnOwnershipClient` override method to take control of the camera as soon as the local client gets ownership of the player object.

### Step 4 — Assign Your References

Select the **Player Camera** component in your Player Prefab and select the CameraHolder game object in the **Camera Holder** field.

### Step 5 — Test in Game

With all that set, you should be able to run the game and see how the camera from the scene is controlled by only your local player.

---

## Basic Setup with Cinemachine

Managing a Cinemachine Camera in multiplayer.

This guide will show you one way you can set up your player camera for multiplayer when you are using the Cinemachine package.

### Step 1 — Installing Cinemachine

If you haven't done so already, install [Cinemachine](https://docs.unity3d.com/Packages/com.unity.cinemachine@2.9/manual/index.html) through the [Unity Package Manager](https://docs.unity3d.com/Manual/upm-ui.html).

### Step 2 — Adding the Cinemachine Brain

Add the **Cinemachine Brain** component to the **Main Camera** game object in the scene.

### Step 3 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be our container for the Cinemachine Camera.

### Step 4 — Adding the Cinemachine Camera

Add the **Cinemachine Camera** component to the newly created **CameraHolder** game object.

### Step 5 — Writing a PlayerCamera Script

Add the following `PlayerCamera` script to the Player Prefab.

```csharp
using FishNet.Object;
using Unity.Cinemachine;
using UnityEngine;

// This script will be a NetworkBehaviour so that we can use the OnStartClient override.
public class PlayerCamera : NetworkBehaviour
{
    [SerializeField] private CinemachineCamera _cinemachineCamera;

    // This method is called on the client after the object is spawned in.
    public override void OnStartClient()
    {
        // Simply enable our local cinemachine camera on the object if we are the owner.
        _cinemachineCamera.enabled = IsOwner;
    }
}
```

This script uses the `OnStartClient` override method to enable or disable the Cinemachine Camera component on the player objects depending on if they are our local player or not.

### Step 6 — Assign Your References

Select the **Player Camera** component in your Player Prefab and drag the **Camera Holder** game object into the **Cinemachine Camera** field.

### Step 7 — Test in Game

With all that set, you should be able to run the game and see how the camera is controlled by only your local player.
