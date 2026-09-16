---
title: "Easy WebGL Hosting with PlayFlow"
description: "Simple tutorial showing how easy PlayFlow makes it to host a server for your WebGL game."
---

## How PlayFlow makes WebGL hosting easy

For seamless WebGL gaming experiences in web browsers, secure WebSocket connections are crucial, but configuring them can be complex. Often, developers end up managing certificates and networking issues, which can be time-consuming. **With PlayFlow**, however, you only need to enable a simple option to handle these concerns effortlessly.

## Before we begin...

This tutorial assumes you've read the [Getting Started with PlayFlow](getting-started-with-playflow.md) tutorial already. In the following steps we will convert our project to support WebGL.

---

### 1. Install Bayou

For FishNet connections on WebGL we will need to use a web supported transport. This tutorial will be using [Bayou](../../../../transports/bayou.md). Head over to the [Bayou GitHub repo](https://github.com/FirstGearGames/Bayou/releases/latest) and download the most recently released `.unitypackage` file, then import it into your project.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/bayou-latest-release.png)

### 2. Add Bayou to your Network Manager

Now that **Bayou** is imported, select your NetworkManager and add the component to it.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/bayou-added-to-networkmanager.png)

> [!INFO]
> If you have more than one transport on your NetworkManager, such as Tugboat, then you will need to add the TransportManager component and drag Bayou into its **Transport** field to set it as the active one.

### 3. Enable WSS

In the Bayou component, enable the **Use WSS** option. This will tell Bayou to use Web Socket Secure. The SSL Configuration options below do not need to be changed for this setup.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/bayou-wss-enabled.png)

### 4. Build your PlayFlow server

Open the PlayFlow Cloud Window from the Unity toolbar (**PlayFlow → PlayFlow Cloud**).

Click the **Upload Server** button to build and upload your Unity server.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-uploading-server.png)

### 5. Set the correct PlayFlow port protocol

Open the [PlayFlow dashboard](https://app.playflowcloud.com/) and navigate to the **Configuration** tab. Edit or add your port, choose the **TCP** protocol, and be sure to **Enable TLS**.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tcp-tls.png)

### 6. Start a PlayFlow server

Head over to the **Server** tab in PlayFlow and create your server instance.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-create-webgl-server.png)

### 7. Prepare your client build

Click on your server instance's **Details** to see the **Host** and **External Port**. Open Unity, select the Bayou component, and enter these into the **Client Address** and **Port** fields respectively.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-webgl-address-port.png)

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/bayou-webgl-fields-entered.png)

### 8. Build your WebGL client

In your Unity build profiles, switch to the **Web Platform** and build your game. Once done, zip the built files and upload to your chosen hosting site.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/zipped-webgl-files.png)

For this test we created a project on Itch.io and uploaded the client build to it.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/itch.io-uploaded-webgl-game.png)

---

## Success!

Just like that, we were able to create a server and have our clients in the web browser securely connect to it. If you want to check out more of their features, visit their documentation at [https://documentation.playflowcloud.com/](https://documentation.playflowcloud.com/)

You are also encouraged to join their [Discord server](https://discord.gg/P5w45Vx5Q8).
