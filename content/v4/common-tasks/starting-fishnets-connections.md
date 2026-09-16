---
title: "Starting FishNet's Connections"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-network-manager.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-scene.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-canvas-connection-manager.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-host-button.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-input-field.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/starting-connections-example.gif)

A guide on starting the FishNet server and client connections yourself.

This guide will show you how you can start the FishNet server and client yourself through code instead of relying only on the example NetworkHudCanvas or default autostart option.

## Step 1 — Install FishNet

Before we begin, don't forget to install FishNet if you haven't already. You can follow this guide if needed: [Installing Fish-Networking](/docs/v4/getting-started/installing-fish-networking).

## Step 2 — Create a NetworkManager

Create a new game object in your scene and give it a nice name such as `NetworkManager`.

Add the **NetworkManager** component to it.

Finally, add an **ObserverManager** component and in the **Default Conditions** field, add a new element and select the **SceneCondition**.

## Step 3 — Setup Basic UI

To get started, let's add a basic user interface which we can use to start the FishNet server, client, and allow the user to enter an IP Address to connect to.

Add three buttons to your game, label them **Start Host**, **Start Server**, and **Start Client**. Now add an input field for the address the client will attempt to connect to.

## Step 4 — Create a ConnectionManager Script

Create the following script and add it to your **Canvas** game object.

```csharp
using FishNet.Managing;
using UnityEngine;

public class ConnectionManager : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;

    public void StartHost()
    {
        StartServer();
        StartClient();
    }

    public void StartServer()
    {
        _networkManager.ServerManager.StartConnection();
    }

    public void StartClient()
    {
        _networkManager.ClientManager.StartConnection();
    }

    public void SetIPAddress(string text)
    {
        _networkManager.TransportManager.Transport.SetClientAddress(text);
    }
}
```

One thing to observe is that this script does not inherit from `NetworkBehaviour`. This is because this script will be active before the network is started and after it has stopped.

## Step 5 — Assign the NetworkManager

Our `ConnectionManager` needs a reference to the NetworkManager component — assign that in the editor now.

## Step 6 — Hook-Up the UI to the Code

Select your UI components and attach their **OnClick** events to the relevant methods in our `ConnectionManager`.

For the **IP Address Input Field**, hook up the **On Value Changed** event to the `ConnectionManager.SetIPAddress` method we created.

## Step 7 — Test It Out!

With that all done you should be able to run the game and use the UI we created to start the FishNet server and/or client.

> **Tip:** Try extending these buttons to also include stopping the server and clients. You can do those actions directly from the `ServerManager` and `ClientManager` components as well.
