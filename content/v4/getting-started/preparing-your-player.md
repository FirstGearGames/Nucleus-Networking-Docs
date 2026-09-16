---
title: "Preparing Your Player"
---

Spawn an object over the network to represent each client's player.

For many games you will want to have a player object for each client. This guide will walk you through the process step by step.

> **Tip:** Before You Begin — ensure that you're not in Play Mode in the Unity Editor. Making changes during Play Mode will not persist after exiting.

## Step 1 — Create a Player Game Object

In the Unity Scene Hierarchy, create a new 3D object of type **Capsule**. Select the capsule in the Hierarchy and rename it to `Player`. In the Inspector, click on **Add Component** and search for **NetworkObject**. Add the NetworkObject component to the capsule.

> **Info:** The NetworkObject component is required for linking a game object over the network. It enables the object to synchronize its state across clients and the server.

![Adding NetworkObject to the player capsule](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-2f1f0dab238bb6f3bc9bb4d7103d5f50fb5a5d5f%2Fadd-networkobject-to-player.png?alt=media)

## Step 2 — Setup the Player Object for Spawning

Drag the player game object into the project window to turn it into a prefab, then delete the game object from the scene.

![Creating the Player prefab](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-89d481627bf5f55597a1fa1ce1d83b4788f6077d%2Fcreate-player-prefab.png?alt=media)

Select the **NetworkManager** in the scene and assign your new Player prefab into the **Player Prefab** field on the **PlayerSpawner** component.

![Assigning the player prefab in the spawner](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-ea31f256bba3afdea3bf43aa61eda3954112aeea%2Fassign-playerprefab-in-spawner.png?alt=media)

## Step 3 — Add Spawn Points

Create two empty Game Objects in the scene to act as spawn points. Position them where you'd like players to spawn on the map. Add these Game Objects as Transform references to the PlayerSpawner component in the **Spawns** list field.

![Adding spawn points to the PlayerSpawner](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-1b26022f8d26337bd8da76de3f1b9afc4f890df2%2Fadd-spawn-points.png?alt=media)

> **Info:** The PlayerSpawner uses these transforms to determine spawn locations, choosing them in order from top to bottom for each subsequent player and beginning again after reaching the final spawn point. If no spawn points are specified, the spawner defaults to using the prefab's transform properties for placement.

## Step 4 — Test the Player Spawning

Save the scene and press the **Play** button in the Unity Editor. As soon as the server and client start you should see a capsule spawning as the player object at the location of the first spawn point.

To see another player spawn you can build and run the game, which will then automatically connect as a client to the editor. You should then see a second player capsule spawn for the second player at the second spawn point.

Alternatively, you can launch a second Unity Editor instance by using Unity's [Multiplayer Play Mode](https://docs.unity3d.com/Packages/com.unity.multiplayer.playmode@2.0/manual/index.html) package or a third party package such as [ParrelSync](https://github.com/VeriorPies/ParrelSync). Find out more about these options and how to use them here: [Testing with Multiple Editors](/docs/v4/common-tasks/testing-with-multiple-editors).

> **Info:** Don't worry if you encounter an error in a second game window stating: "Server failed to start. This usually occurs when the specified port is unavailable, be it closed or already in use." This occurs because multiple game instances are attempting to start as a server on the same machine using the same port. Only the first instance will successfully start as a server and the rest will instead start as clients only, thus this error is safe to ignore for local testing.
