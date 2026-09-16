---
title: "Testing with Multiple Editors"
cover: "https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/multiple-editors-tutorial-cover.png"
---
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/mppm-package-manager.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/mppm-enable-player.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/mppm-customizing-clone.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/parrelsync-clones-manager.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/mppm-connected-players.png)

A tutorial for running multiple Unity Editor windows for testing multiplayer.

During your multiplayer game development, you may find it useful to run multiple Unity editors to test out your project locally. This can be especially helpful if you want to use the Unity Inspector or Scene Hierarchy to analyze your game at runtime.

This tutorial will go over two solutions: Unity's own **Multiplayer Play Mode** and the community extension **ParrelSync**.

## Multiplayer Play Mode vs ParrelSync

| | ParrelSync | Multiplayer Play Mode |
|---|---|---|
| **Author** | Community (VeriorPies) | Unity |
| **Compatibility** | Works with most Unity versions | Unity 6 and later |
| **Editor Limit** | No Limit | 4 Editor Clones |
| **Limitations** | Changes should be made on main editor | Clone instances are stripped down versions of the Unity editor with limited functionality |
| **Development** | Stable, but inactive | Actively developed |

If you are using a Unity version older than Unity 6, you will have to use ParrelSync. Otherwise you can choose either option, or even both.

## Multiplayer Play Mode (MPPM)

The Multiplayer Play Mode package is a newer, official Unity solution for local and remote multiplayer testing. It allows you to simulate multiple players (up to four) directly within a single editor instance.

### Step 1 — Install MPPM

Open the **Package Manager** in Unity (Window → Package Manager). Select **"Unity Registry"** in the dropdown, find **Multiplayer Play Mode** in the packages listing, and click **Install**.

Or alternatively, click the **+** dropdown button, select **"Install package by name"**, and enter:

```
com.unity.multiplayer.playmode
```

### Step 2 — Create Your Clones

Open the MPPM window (**Window → Multiplayer → Multiplayer Play Mode**) and click the checkbox next to one of the four Virtual Player options. After the clone creates the necessary files, it will open a new editor window.

### Step 3 — Customize Your Clone Window

Now that your clone window has opened, you can choose which Unity tabs you want to show in it, such as the scene hierarchy, inspector, and console.

That's all you need to do! Now as soon as you start your main project, the clones will all enter play mode as well.

> **Info:** If the options are disabled, try changing them at run-time instead. You can learn more from the [official documentation](https://docs.unity3d.com/Packages/com.unity.multiplayer.playmode@2.0/manual/index.html).

## ParrelSync

ParrelSync is a popular, open-source Unity extension that creates multiple clones of your project, allowing you to run multiple editor windows that reference the same core assets.

### Step 1 — Install ParrelSync

The recommended method is to use the Unity Package Manager. Open the **Package Manager** (Window → Package Manager), click the **+** dropdown, select **"Install package from git URL"**, and enter:

```
https://github.com/VeriorPies/ParrelSync.git?path=/ParrelSync
```

> **Warning:** Ensure you have the [Git client](https://git-scm.com/downloads) (minimum version 2.14.0) installed on your system and added to the PATH system environment variable.

Or alternatively, download the latest `.unitypackage` file from the [releases](https://github.com/VeriorPies/ParrelSync/releases) page and import it via **Assets → Import Package → Custom Package**.

### Step 2 — Create and Test Your Clones

From the menu bar, open the **ParrelSync Clones Manager** (ParrelSync → Clones Manager). From the Clones Manager window, click **Create new clone**. This will create a new folder next to your original project and copy the necessary files. After the clone is created, select **Open in New Editor** to launch the cloned project in a new Unity window.

You can now press **Play** in both the original and the cloned editor windows to test your multiplayer game with two separate "players."

> **Warning:** It's important to only make changes to your project from the **original editor instance**, not the cloned one, to avoid potential asset conflicts. ParrelSync disables asset modification in clones by default.

## Final Comments

With either of those options set up, you can now easily test your game with multiple editors without needing to rebuild each time.
