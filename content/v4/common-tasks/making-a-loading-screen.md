---
title: "Making a Loading Screen"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/loading-screen-ui.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/loading-screen-network-manager.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/loading-screen-demonstration.webp)

A tutorial for creating a loading screen when using FishNet's Scene Management instead of Unity's default one.

You may be used to making loading screens when using Unity's regular scene loading, but how can you do it for networked scenes? A good and simple solution is to use FishNet's **Scene Processor** to add (or override) functionality during when FishNet loads scenes.

## Step 1 — Creating a Loading Screen UI

Start by adding a canvas with an image and some text to cover the screen and let the user know that the game is currently loading.

We will disable and enable this object when needed, and to prevent it getting destroyed, we will mark it as [`DontDestroyOnLoad`](https://docs.unity3d.com/ScriptReference/Object.DontDestroyOnLoad.html).

## Step 2 — Adding a Simple Loading Screen Script

Write the following script and place it on our **Loading Screen** object.

This script acts as a singleton — we will only have one loading screen in our game. We add a static reference to it and register it with the NetworkManager in `Start`, or destroy it if an instance is already registered. We will hide the loading screen after this, so it doesn't block our game before we want it to.

```csharp
using FishNet;
using UnityEngine;

public class LoadingScreen : MonoBehaviour
{
    private void Start()
    {
        if (InstanceFinder.NetworkManager.HasInstance<LoadingScreen>())
        {
            Destroy(gameObject);
            return;
        }

        InstanceFinder.NetworkManager.RegisterInstance(this);
        DontDestroyOnLoad(gameObject);
        HideLoadingScreen();
    }

    public static void ShowLoadingScreen()
    {
        if (InstanceFinder.NetworkManager.TryGetInstance(out LoadingScreen loadingScreen))
            loadingScreen.gameObject.SetActive(true);
    }

    public static void HideLoadingScreen()
    {
        if (InstanceFinder.NetworkManager.TryGetInstance(out LoadingScreen loadingScreen))
            loadingScreen.gameObject.SetActive(false);
    }
}
```

We also give it public static methods to show and hide the loading screen. We can call these whenever we want to, and we will call them from our scene processor.

> **Info:** This example script uses FishNet's instance registering to handle the singleton reference, but you can use your own or any other instead if you prefer.

## Step 3 — Creating a Custom Scene Processor

Now create a script that will inherit from FishNet's `DefaultSceneProcessor` and add our extra functionality when loading a scene. Simply override the `LoadStart` and `LoadEnd` methods, call the base method to retain the default functionality, and then tell our loading screen to be shown and hidden.

```csharp
using FishNet.Managing.Scened;

public class LoadingScreenSceneProcessor : DefaultSceneProcessor
{
    public override void LoadStart(LoadQueueData queueData)
    {
        base.LoadStart(queueData);
        LoadingScreen.ShowLoadingScreen();
    }

    public override void LoadEnd(LoadQueueData queueData)
    {
        base.LoadEnd(queueData);
        LoadingScreen.HideLoadingScreen();
    }
}
```

## Step 4 — Add the Scene Processor to the NetworkManager

Add the `LoadingScreenSceneProcessor` script to your **NetworkManager** game object. Also add the **SceneManager** component if it isn't there already. The SceneManager has a **Scene Processor** field — drag your `LoadingScreenSceneProcessor` component into it.

## Step 5 — Success!

With that all set up, your loading screen should work whenever FishNet loads new scenes.
