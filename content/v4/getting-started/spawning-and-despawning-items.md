---
title: "Spawning and Despawning Items"
---

Learn about spawning and despawning by having your players throw cubes around!

Now that we have players moving around, let's learn how to spawn and despawn NetworkObjects.

While you can `Instantiate` and `Destroy` regular Game Objects, Network Objects need to be **Spawned** and **Despawned** — this tells FishNet to synchronize the action over the network. FishNet stores all network object prefabs in a collection called the **Spawnable Prefabs**. You can see this and customize it on the NetworkManager.

## Step 1 — Creating the Item Network Object Prefab

Create a **Cube** in the scene hierarchy and add a **NetworkObject** component to it. Optionally decrease its scale by half so it doesn't look too large. Then drag it into the project window to turn it into a prefab; you can destroy the original game object in the scene hierarchy now.

![Adding NetworkObject to the cube](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-20be8f9e8631ea6f6793d9271191fb92dfa5640f%2Fadded-network-object-to-cube.png?alt=media)

## Step 2 — Creating a Script to Spawn the Cube

Now create a script called `PlayerCubeCreator` and add it to your **Player Prefab**. This script is going to be responsible for spawning our new cube item across the network.

```csharp
using FishNet.Object;
using UnityEngine;

public class PlayerCubeCreator : NetworkBehaviour
{
    public NetworkObject CubePrefab;

    private void Update()
    {
        // Only the local player object should perform these actions.
        if (!IsOwner) return;

        if (Input.GetButtonDown("Fire1"))
            SpawnCube();
    }

    // We are using a ServerRpc here because the Server needs to do all network object spawning.
    [ServerRpc]
    private void SpawnCube()
    {
        NetworkObject obj = Instantiate(CubePrefab, transform.position, Quaternion.identity);
        Spawn(obj); // NetworkBehaviour shortcut for ServerManager.Spawn(obj);
    }
}
```

> **Info:** This may be a great time to read the page about RPCs, such as the `ServerRpc` we use here.

Because this script contains a `ServerRpc`, it will also need to be a `NetworkBehaviour`. The `Update` method listens for the user to press the Fire1/Attack button (typically the left mouse button) and then calls `SpawnCube`.

**Understanding `SpawnCube`:**

The `[ServerRpc]` attribute means this method is intended to be called by a client, but it will execute only on the server. The client sends a message to the server, requesting this method to be run.

`Spawn(obj)` is the most critical line for networked objects. Calling `Spawn` on the NetworkObject tells FishNet's `ServerManager` to "spawn" this object over the network — the server will now instruct all currently connected clients (and any clients that connect later) to instantiate their own replica of this object.

> **Info:** You can read the more in-depth page about [Spawning](/docs/v4/features/networked-gameobjects-and-scripts) here.

## Step 3 — Assigning the Prefab to Your Script

Select your **Player Prefab** and assign your Cube Prefab to the **Cube Prefab** field in your newly created Player Cube Creator script.

![PlayerCubeCreator with the cube prefab assigned](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-043055368e4af440e0b6e55db50960cc988b4c21%2Fplayer-cube-creator-set.png?alt=media)

> **Info:** You may have noticed that an **Empty Network Behaviour** component was automatically added to your game objects with a NetworkObject component. This happens because FishNet requires every NetworkObject to also have a NetworkBehaviour on it, and it will automatically add an empty one if it doesn't detect any. You can safely remove this empty component as you have added other NetworkBehaviour components, but it's not a problem either way.

## Step 4 — Test If the Spawning Works

Launch a couple instances of your game and see if you can run around and spawn cube items by pressing the Fire1/Attack button. The cubes should be visible on all devices connected to each other.

![Testing cube spawning across two instances](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-25d515b1ae7d64727100aedf9e20210177a1cd41%2Ftest-cube-spawning.gif?alt=media)

## Step 5 — Add Some Physics

Static cubes are boring! Let's add a **Rigidbody** component to the Cube Prefab to enable basic physics interactions with them.

![Adding Rigidbody to the cube prefab](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-5a1f65c11cffde179b88fa03b758dae9cbafbdb2%2Frigidbody-added-to-cube.png?alt=media)

Now the cubes should roll around and collide with the ground. Also add a **Rigidbody** to the Player and set it to **Is Kinematic**.

![Adding Rigidbody to the player with Is Kinematic enabled](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-cfd5c85fe8667b1e3111019ac14d77b81f834271%2Fplayer-with-rigidbody.png?alt=media)

## Step 6 — Test If the Physics Works

If you launch the game now, the cubes should have basic physics working.

![Players spawning physics cubes](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-fa7968e9c71c1e8647f96d173985460f9bd88c75%2Fplayers-spawning-physics-cubes.gif?alt=media)

You may notice the cubes' positions don't always sync up after they are moved around — that's because we haven't done any positional syncing besides the initial position syncing that FishNet automatically did when we called `Spawn`.

> **Info:** Networked Rigidbodies are a complex topic, better suited to a different guide. For a really basic setup, you can add a **NetworkTransform** to your Cube Prefab and set its **Component Configuration** to **Rigidbody**.

## Step 7 — Script to Despawn Cubes on a Timer

Now that we can Spawn cubes successfully, let's Despawn them after a few seconds so that we don't end up with too many objects at once.

Create a new script called `DespawnAfterTime`:

```csharp
using FishNet.Object;
using System.Collections;
using UnityEngine;

public class DespawnAfterTime : NetworkBehaviour
{
    public float SecondsBeforeDespawn = 3f;

    public override void OnStartServer()
    {
        StartCoroutine(DespawnAfterSeconds());
    }

    private IEnumerator DespawnAfterSeconds()
    {
        yield return new WaitForSeconds(SecondsBeforeDespawn);
        Despawn(); // NetworkBehaviour shortcut for ServerManager.Despawn(gameObject);
    }
}
```

This script uses the `OnStartServer` NetworkBehaviour override method to start a Coroutine which will Despawn the object. `OnStartServer` will run on the server when the object is initialized with the network.

`Despawn` needs to be called on the server, and it will destroy the game object locally as well as on all clients automatically for you.

## Step 8 — Assigning the Script and Testing

Open your **Cube Prefab** and add the `DespawnAfterTime` script to the object.

Launch the game again and observe the objects being Despawned successfully on the server and all clients after a few seconds.

![Cubes despawning after a few seconds](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-b9a8c72fcb04440d653e7cf04ffc9eb61835d197%2Fcubes-despawning.gif?alt=media)
