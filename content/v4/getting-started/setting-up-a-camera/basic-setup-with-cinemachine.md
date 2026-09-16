---
title: "Basic Setup with Cinemachine"
---

Managing a Cinemachine Camera in multiplayer.

This guide will show you one way you can set up your player camera for multiplayer when you are using the Cinemachine package.

## Step 1 — Installing Cinemachine

If you haven't done so already, install [Cinemachine](https://docs.unity3d.com/Packages/com.unity.cinemachine@2.9/manual/index.html) through the [Unity Package Manager](https://docs.unity3d.com/Manual/upm-ui.html).

## Step 2 — Adding the Cinemachine Brain

Add the **Cinemachine Brain** component to the **Main Camera** game object in the scene.

## Step 3 — Giving the Player a Camera Holder

Create an empty Game Object on your **Player Prefab** and position it where you'd like. This will be our container for the Cinemachine Camera.

## Step 4 — Adding the Cinemachine Camera

Add the **Cinemachine Camera** component to the newly created **CameraHolder** game object.

## Step 5 — Writing a PlayerCamera Script

Add the following `PlayerCamera` script to the Player Prefab.

```csharp
using FishNet.Object;
using Unity.Cinemachine;
using UnityEngine;

// This script will be a NetworkBehaviour so that we can use the OnStartClient override.
public class PlayerCamera : NetworkBehaviour
{
    [SerializeField] private CinemachineCamera _cinemachineCamera;

    public override void OnStartClient()
    {
        _cinemachineCamera.enabled = IsOwner;
    }
}
```

This script uses the `OnStartClient` override method to enable or disable the Cinemachine Camera component on the player objects depending on if they are our local player or not.

## Step 6 — Assign Your References

Select the **Player Camera** component in your Player Prefab and drag the **Camera Holder** game object into the **Cinemachine Camera** field.

## Step 7 — Test in Game

With all that set, you should be able to run the game and see how the camera is controlled by only your local player.
