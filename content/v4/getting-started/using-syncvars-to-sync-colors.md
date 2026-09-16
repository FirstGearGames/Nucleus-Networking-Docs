---
title: "Using SyncVars to Sync Colors"
---

Synchronizing color with synchronized variables!

We've got quite a few things synchronized now, but how might you go about synchronizing a specific variable in one of your scripts? **SyncVars** are one answer! A SyncVar is a FishNet generic type that can be used within NetworkBehaviours that automatically synchronize their value from the server to all clients.

Let's liven up the colors in our game and synchronize them with SyncVars.

## Step 1 — Creating a Script to Sync Color

Create a new script called `SyncMaterialColor`. This will be used to synchronize the Material color of our `MeshRenderer`s.

```csharp
using FishNet.Object;
using FishNet.Object.Synchronizing;
using UnityEngine;

[RequireComponent(typeof(MeshRenderer))]
public class SyncMaterialColor : NetworkBehaviour
{
    public readonly SyncVar<Color> Color = new SyncVar<Color>();

    private void Awake()
    {
        Color.OnChange += OnColorChanged;
    }

    private void OnColorChanged(Color previous, Color next, bool asServer)
    {
        GetComponent<MeshRenderer>().material.color = Color.Value;
    }
}
```

This simple script has a `Color` variable of the type `SyncVar<Color>`. It needs to be set to `readonly`, but don't worry, we can still get and set its `Value`.

> **Info:** Setting your SyncVar as `readonly` will cause it to be hidden from the Unity Inspector. You can read about a workaround for this in the SyncVar documentation.

In `Awake` we subscribe to the SyncVar's `OnChange` event. This event is very useful as it will be invoked as soon as the SyncVar changes, even on a client when the server changes it and it's synced.

`OnColorChanged` is our method that we subscribed to the `OnChange` event. This method simply gets the `MeshRenderer` and sets its material color to the SyncVar's `Color` Value, thus updating the visuals to match on all devices.

> **Tip:** You may want to read more about SyncVars and the other available SyncTypes that FishNet has, such as SyncLists. You can find those pages in the [Features](/docs/v4/features) section.

## Step 2 — Add the Script Component

Add your newly created `SyncMaterialColor` script to your **Cube Prefab**. The script won't currently do anything unless we change the Color SyncVar in it, so let's do that next.

## Step 3 — Give the Cubes Random Colors

Let's give the cubes some color as soon as we instantiate them.

Reopen the `PlayerCubeCreator.cs` script and make the following addition after the call to `Instantiate` and before the call to `Spawn`:

```csharp
obj.GetComponent<SyncMaterialColor>().Color.Value = Random.ColorHSV();
```

Here is the complete updated `SpawnCube` method:

```csharp
[ServerRpc]
private void SpawnCube()
{
    NetworkObject obj = Instantiate(CubePrefab, transform.position, Quaternion.identity);
    obj.GetComponent<SyncMaterialColor>().Color.Value = Random.ColorHSV();
    Spawn(obj); // NetworkBehaviour shortcut for ServerManager.Spawn(obj);
}
```

This line of code gets the `SyncMaterialColor` component and sets the SyncVar Value to a random color as soon as it's instantiated. Once `Spawn` is called on the next line, FishNet will spawn this object for all clients with the color SyncVar state synced.

## Step 4 — Test the Synchronized Cubes

Now all you need to do is run your game again and see if the cubes spawn with a random color and if that color is synchronized across the network.

![Cubes spawning with random synced colors](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-c9d2dd5ef18ca779caf5d1a87858cc86a503439c%2Fcube-with-sync-color.png?alt=media)

![Synchronized cube colors across clients](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-7ebabefb3d8ee774a19f202b1c43369ad5e102cd%2Fsynced-cube-colors.gif?alt=media)
