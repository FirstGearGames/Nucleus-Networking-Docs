---
title: "Code Stripping (Pro Feature)"
---

![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/toolbar-menu.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/code-stripping-enabled.png)
![](https://raw.githubusercontent.com/FirstGearGames/FishNet-Documentation/main/.gitbook/assets/ilspy-stripping.png)
FishNet's code stripping feature allows your server-only code to be automatically stripped from client builds and client-only code to be stripped from server builds.

## Why use code stripping?

It helps secure your game server by removing sensitive logic that players shouldn't see. This makes it harder for cheaters to figure out how the server works and keeps sensitive server data hidden.

## What gets stripped

FishNet Pro can remove server code from non-server builds and client code from server builds. The code it strips is code within RPCs, code marked with the `Server` or `Client` attributes, as well as server and client only callbacks such as `OnStartServer`/`OnStartClient`.

## How to use it

To use FishNet's code stripping you will firstly need to have FishNet Pro installed. You can find details for how to install it here: Upgrading to FishNet Pro.

Next, you can navigate to the FishNet Configuration menu through the Unity toolbar:

**(Tools → Fish-Networking → Configuration)**

On the Configuration page you will see the option to **"Strip Release Builds"**, enable it.

There is now the **"Stripping Type"** option that you can switch between `Redirect` and `Empty_Experimental`. `Redirect` will replace the methods and calls with a dummy method that doesn't contain any of the logic, while `Empty_Experimental` will keep the same method, but will strip its method body, leaving it empty. You can use either option you want to.

Now you will need your game to recompile its scripts, you can trigger this by changing something in your code. If your code is in a separate assembly, be sure to trigger that assembly to recompile as well. This is only needed after you change the FishNet stripping settings.

That's all you need to do, you can now build your game, and FishNet will automatically strip the code for you.

## Confirming it worked

It's always a good idea to check if the sensitive code was indeed stripped from the builds. For Unity Mono builds you can easily do so using a tool such as ILSpy.

You can download the above-mentioned tool or another of your choosing. Then you'll want to run it and load the chosen assembly in your built game's files. If you find your script, you should see how FishNet stripped its code according to the build.
