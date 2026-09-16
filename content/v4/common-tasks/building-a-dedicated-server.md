---
title: "Building a Dedicated Server"
cover: "https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/dedicated-server-tutorial-cover.png"
---

Instructions for how to build a dedicated FishNet server.

FishNet supports running your project as a dedicated server, meaning Unity runs without rendering graphics and focuses purely on network logic. This is the recommended way to host multiplayer games at scale. You can deploy this build to a server hosting service, your own physical servers, or even give it to your players to allow them to host their own servers.

> **Tip:** Learn more about Unity's Dedicated Server Build Profiles [here](https://docs.unity3d.com/Manual/dedicated-server-build-profiles.html).

## Required Unity Modules

Before building your server, ensure you have the correct Unity modules installed. You will need the **Dedicated Server Build Support** module for your server's operating system (usually Linux, but can be Windows or macOS too).

**To install through the Unity Hub:**

1. Open the Unity Hub.
2. Go to the **Installs** tab.
3. Find your desired Unity version, click **⚙ Manage**, then **Add Modules**.
4. Tick the relevant build targets and click **Continue**.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/linux-dedicated-server-modules.png)

**To install through the Unity Editor:**

1. Go to **File → Build Profiles**.
2. Select your server's target platform (e.g., **Linux Server** or **Windows Server**).
3. If the module is not installed, Unity will prompt you to install it.
4. Click **Install with Unity Hub** as necessary.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/build-profiles-install-windows-server.png)

## Ensuring FishNet's Server Starts

With the default settings, FishNet detects when the game is built as a dedicated server and will start the FishNet server as soon as the NetworkManager is loaded.

You can change this by adding the **ServerManager** component to your NetworkManager and adjusting the **Start on Headless** option. If you disable this functionality you may want to implement it yourself:

```csharp
using FishNet.Managing;
using UnityEngine;

[RequireComponent(typeof(NetworkManager))]
public class NetworkServerStarter : MonoBehaviour
{
    private void Start()
    {
#if UNITY_SERVER
        GetComponent<NetworkManager>().ServerManager.StartConnection();
#endif
    }
}
```

## Configuring the Transport

Set up your chosen transport's settings for your dedicated server. The default transport **Tugboat** should in most cases have the **Reuse Address** option enabled.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/playflow-tutorial-tugboat-reuse-address.png)

You may also want to set your **Port** and **Server Bind Address**. Here's how to set these dynamically from command line arguments:

```csharp
using UnityEngine;
using FishNet.Managing;
using System.Diagnostics;

[RequireComponent(typeof(NetworkManager))]
public class NetworkCommandLineArgs : MonoBehaviour
{
    private NetworkManager _networkManager;

    private void Start()
    {
        _networkManager = GetComponent<NetworkManager>();

        ushort? port = GetPortFromCommandLine();
        if (port.HasValue)
        {
            _networkManager.TransportManager.Transport.SetPort(port.Value);
            _networkManager.Log($"Port set to {port} via command line.");
        }
        else
        {
            _networkManager.Log("No valid port found in command line args. Using default.");
        }

        StartDedicatedServer();
    }

    [Conditional("UNITY_SERVER")]
    private void StartDedicatedServer()
    {
        _networkManager.ServerManager.StartConnection();
    }

    private ushort? GetPortFromCommandLine()
    {
        string[] args = System.Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length; i++)
        {
            if ((args[i] == "-port") && i + 1 < args.Length)
            {
                if (ushort.TryParse(args[i + 1], out ushort port))
                    return port;
            }
        }
        return null;
    }
}
```

This code looks for command arguments in this format: `-port <number>`. For example, running `game.exe -port 7777` will set the transport to use port 7777.

## Configuring the Server's Logging

### FishNet's Logging Level

The NetworkManager has a **Logging** field which can be used to select a **Level Logging Configuration** asset to customize FishNet logging settings. Create one via **Assets → Create → FishNet → Logging → Level Logging Configuration**.

Set the **Headless Logging** option to **"Common"** to see regular debug logs, including connection events such as clients joining and leaving and the server starting.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/level-logging-configuration.png)

### Shader Errors

When you run your server you may notice errors related to shaders — this is normal as Unity is running without graphics. Enable full shader stripping:

Go to **Edit → Project Settings → Player → Other Settings**, and under **Optimization**, enable **"Dedicated Server Optimizations"**.

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/dedicated-server-optimizations.png)

## Excluding Files from the Build

With server builds you will often want to exclude assets that aren't necessary on the server, such as audio files and textures. Recommended tools:

- [Exclude From Build](https://assetstore.unity.com/packages/tools/utilities/exclude-from-build-48002)
- [File Excluder](https://assetstore.unity.com/packages/tools/utilities/file-excluder-268529)
- [BuildExcluder](https://github.com/JohannesDeml/UnityBuildExcluder)

## Excluding Code from the Server

Use Assembly Definitions and choose to exclude the dedicated server platforms. You can also exclude specific code using the `!UNITY_SERVER` [preprocessor directive](https://docs.unity3d.com/Manual/platform-dependent-compilation.html).

## Excluding Code from the Client

Use Assembly Definitions or the `UNITY_SERVER` preprocessor directive — this removes the code from non-dedicated server builds.

If you have **FishNet Pro**, you can make use of its built-in code stripping to strip server-specific code from client-only builds. This includes code inside methods marked with `ServerRpc` or `[Server]` attributes, as well as server-only callbacks such as `OnStartServer`. Access this option in the **FishNet Configuration** menu through the Unity Toolbar.

> **Info:** Be sure to let the code recompile after changing the FishNet Code Stripping option.

## Creating a Server Build

1. Go to **File → Build Profiles** and select your target server platform.
2. Include your game scenes carefully. Ensure the NetworkManager is present in the starting scene, a scene loaded via code, or instantiated at runtime.
3. Click **Build** and choose an output folder.

Once it's done you can upload it to your server or server hosting service and then launch your game servers.
