---
title: "Getting Connected"
---

The first step to networking is connecting over the network. Learn about that process here!

## Step 1 — Creating the NetworkManager

The NetworkManager is a central component of FishNet that manages the networking lifecycle, including establishing connections, hosting sessions, and handling client-server communication. For convenience, FishNet has a ready-made NetworkManager prefab that you can use.

You can find the prefab located in the FishNet directory under `Demos/Prefabs/NetworkManager.prefab`. Drag and drop this NetworkManager prefab into your Unity scene.

> **Info:** If you imported FishNet from the git URL instead of the asset store or `.unitypackage` file, then the location of the FishNet directory will be `Packages/FishNet: Networking Evolved` instead of `Assets/FishNet`.

![Adding the NetworkManager Prefab](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-b497876c8d25b3efb3cd0fdb7070b5dccbafbf91%2Fadding-network-manager.png?alt=media)

## Step 2 — Configuring FishNet to Auto Start

The **NetworkHudCanvas** is a user interface provided by the example NetworkManager designed for quick testing of network connections. It displays buttons to start as a client and/or server. It also allows you to automatically start as a server, client, or host as soon as the NetworkManager loads in the game.

Expand the NetworkManager's fold-out icon to see its child game objects and select the **NetworkHudCanvas** game object. Find the **Network Hud Canvases** component on the object and set the **Auto Start Type** to **Host**.

This configuration will ensure that the application automatically starts as a host (a server and a client at the same time) when the scene is loaded.

![Setting the Auto Start Type](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-11f7d72d08c0562b98b4d851ac5b1838808c8208%2Fsetting-autostart-type.png?alt=media)

## Step 3 — Testing the Connection

Once everything is set up, press the **Play** button in Unity's Editor to launch your scene.

The two **Server** and **Client** buttons in the top left of the game window should turn blue to indicate that the server and client are both active.

> **Info:** If the buttons do not look like the example image then it just means your project is using Unity's new input system package; this is not a problem and you can simply check if the server and client are started by the button names being "Stop Server" and "Stop Client" respectively.

Additionally the console will log some network-related messages. Successful connection messages should appear, indicating that the host and client are running properly.

![Successful connection logs](https://1328095063-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MheH2hMo3djr9VSyxTE%2Fuploads%2Fgit-blob-cc0dd510fe164c01437c349d58aac2830fc82afa%2Fsuccessful-connection-logs.png?alt=media)

> **Tip:** You will see the following warning: "Player prefab is empty and cannot be spawned for connection 0." This is fine and will be dealt with in the next section.

By following these steps, you should now have a functional network setup in your Unity project using FishNet. This guide provides the foundation for more complex networking workflows, such as syncing objects and managing connections.
