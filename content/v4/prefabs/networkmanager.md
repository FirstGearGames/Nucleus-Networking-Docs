---
title: "NetworkManager"
---


The NetworkManager prefab contains a basic [NetworkManager](../components/managers/network-manager.md) with a [NetworkHudCanvas](networkhudcanvas.md) to provide you with a quick setup for using FishNet in your game.

You can simply add this object into your scene and use the **Server** and **Client** buttons in play mode to start FishNet as a server, client, or both. You can also setup the [autostart options ](#user-content-fn-1)[^1]on the NetworkHudCanvas child object.

The components this object contains are the NetworkManager, [ObserverManager ](../components/managers/observermanager/)(with a [Scene Observer Condition](../scriptableobjects/observerconditions/scenecondition.md)), and the PlayerSpawner.

[^1]: Autostart options allow FishNet to begin as a client, server, both, or none as soon as the object is loaded in the game.
