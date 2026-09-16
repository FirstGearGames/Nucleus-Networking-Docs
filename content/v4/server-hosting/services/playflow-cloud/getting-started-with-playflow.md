---
title: "Getting Started with PlayFlow"
description: "Step-by-step tutorial for getting up and running with PlayFlow Cloud."
---

{% embed url="https://www.youtube.com/watch?v=TyvBHUlYP64" %}

---

This guide assumes you have some or all of your game already written using FishNet and are now ready to use PlayFlow to implement a dedicated server. You can also use PlayFlow throughout the development process as its one-click deployment makes it easy to setup a temporary server for testing.

## Before we begin...

### 1. Starting project

If you don't have a project already setup but want to follow this tutorial, you can use the Getting Started FishNet tutorial project. The files for it can be downloaded from the [FishNet Getting Started GitHub repository](https://github.com/maxkratt/fish-networking-getting-started/releases/download/using-syncvars-to-sync-colors/using-syncvars-to-sync-colors.unitypackage).

### 2. Install the PlayFlow SDK

Now that we're ready to start, let's install [PlayFlow Cloud](https://www.playflowcloud.com/). You can directly import it with the following git URL:

```
https://github.com/PlayFlowCloud/PlayFlow-Multiplayer-Unity-SDK.git
```

Simply add this through the Unity Package Manager and you'll be ready to continue!

> [!INFO]
> If you need more detailed instructions for this step, check out PlayFlow's own [Installation Guide](https://documentation.playflowcloud.com/guides/installation).

### 3. Add the necessary Unity modules

The next thing we need to do is ensure our Unity installation has the correct modules for building a server. Install the **Linux Build Support** modules for your Unity version in the Unity Hub.

> [!INFO]
> Exact details on the required modules depending on your Unity version can be found in PlayFlow's [Unity Modules Setup guide](https://documentation.playflowcloud.com/guides/unity-modules).

### 4. Add Tugboat

Select the NetworkManager in your project and add the Tugboat component if it isn't already there (if you are using a different transport, that is also fine).

Enable the **Reuse Address** checkbox, this will be needed for our server to work correctly.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-tugboat-reuse-address.png)

The other two fields we'll be paying attention to are the _Port_ and _Client Address_ ones. For now you can leave the default settings — we'll remember the port number for later and we'll use the _Client Address_ field in our client build to input the URL of our hosted server.

### 5. Manage Auto Start

We will want FishNet to automatically start as a server in the server build we make. FishNet will actually do this by default with the **Start On Headless** option on the ServerManager. If you disabled this, be sure to manage starting the server itself, or simply re-enable it.

If we have set the NetworkHudCanvas _Auto Start Type_ to something other than **Disabled**, then we will want to disable it now, since we want our server to only behave as a server.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/setting-autostart-type.png)

Once that's all done we can move on to using PlayFlow Cloud!

---

## Deploying your game with PlayFlow

### 1. Create your PlayFlow account

Now that PlayFlow is installed, let's go to the website and setup our dashboard.

Go to the [PlayFlow Cloud website](https://app.playflowcloud.com/) and sign-up using your email, or log in with your GitHub or Google account. If asked, confirm your email address to complete the setup.

### 2. Create a game studio

You'll now be prompted to create a Game Studio. Game Studios make it easy to organize your game projects and work smoothly with your team.

Enter a name for your studio and select either the **Hobby** or **Pro** plan — you can read more about the plan types [here](https://documentation.playflowcloud.com/fundamentals/plan-instance-types). For this tutorial we will be using the **Hobby** plan, but don't worry, you can always change the plan and even the name after it's created.

Once you've done that, click **Create Studio** and you'll be good to continue.

### 3. Create a new project

Now that you've created your first Studio you'll be prompted to choose it and then we can move forward with creating a new project.

Click the **Create New Project** button and enter the details of your project:

- **Project Name:** Give your project any fitting name you'd like.
- **Game Engine:** Select Unity as the Game Engine.
- **Game Type:** Choose the game type that fits your project best.

Click **Create Project** to proceed.

### 4. Explore the dashboard

With your new project created and selected, you can check out the PlayFlow dashboard for it. PlayFlow has a lot of powerful features and makes it very easy to view logs, metrics, server details, and more. The PlayFlow dashboard can also be used to directly upload your game's server builds and manage server instances.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-dashboard.png)

### 5. Link the PlayFlow SDK to your project

Now let's link our Unity Project to the PlayFlow one we've just created.

1. Open the **Overview** page in the PlayFlow dashboard.
2. Find the **API Keys** section and click the **View API Keys** button. Then copy the **PlayFlow API Key** to your clipboard.
3. Go to the Unity Editor and open the PlayFlow window from the Toolbar at **PlayFlow → PlayFlow Cloud**.
4. Inside the _Token_ field, paste the **PlayFlow API Key** you copied.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-sdk-window.png)

### 6. Build and upload the server

Specify the scene that the server should start in with the **Server Scene** field. You can set it manually via the dropdown or enable **Build Settings' Scene List** to use that instead.

> [!INFO]
> Don't forget to add your scenes to Unity's build settings scene list!

When you're happy with the settings, press the **Upload Server** button to have PlayFlow automatically build and upload a headless Linux server build of your game.

### 7. Setup the PlayFlow port

Open the PlayFlow dashboard and head to the **Configuration** tab → **Network Ports** section. Click **Add Your First Port** and fill in the fields:

- **Port Name:** e.g. `getting_started_udp`
- **Port Number:** The port from your Transport's _Port_ field. Tugboat default is `7770`.
- **Protocol:** Tugboat uses UDP.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-add-new-port.png)

Click **Add Port** to finish.

### 8. Create the server

Head over to the **Servers** tab and click **Create Your First Server**.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-start-server.png)

Customize the settings, set a name, and press **Create Server**. You should now see the server in the Servers tab.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-launching-servers.png)

### 9. Connect to the server

Click on **Details** to see the server details. Under **Details → Network**, copy the _Host_ and _External Port_ fields.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-server-details.png)

In the Unity Editor, select your transport component:

- Enter the IP Address from the **Host** field into the Transport's _Client Address_ field.
- Enter the **Port** into the Transport's _Port_ field.

### 10. Test the game

Run the game or build and run it and connect as a client. Your game should connect to the PlayFlow server and work correctly!

---

## Take the Next Steps!

Well done! You've now learned how to setup and deploy your server using PlayFlow. If you want to check out more of their features, visit their documentation at [https://documentation.playflowcloud.com/](https://documentation.playflowcloud.com/)

You are also encouraged to join their [Discord server](https://discord.gg/P5w45Vx5Q8).
