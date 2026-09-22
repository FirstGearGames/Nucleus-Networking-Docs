---
title: "Testing with two editors"
---

> **Driving the core API directly?** See [Running two peers in one process](./running-two-peers-in-one-process).

## One editor shows nothing

Every interesting piece of networked behavior is a difference between what two peers see: a spawn the server created and the client received, a value the client can't write because it doesn't hold permission, an object that falls out of one peer's interest but not the other's. A single play session only ever shows one side of that difference. To see anything worth testing, run a server and a client at the same time, in two separate Unity processes, and watch both screens.

## ParrelSync clones

The Unity integration project vendors [ParrelSync](https://github.com/VeriorPies/ParrelSync) at `Assets/ParrelSync`. A clone is a second Unity process pointed at a project folder whose name is the primary's with a `_clone` suffix — the checkout on disk has the primary (`Nucleus - Unity Integration`) alongside `Nucleus - Unity Integration_clone_0`, `_clone_1` and `_clone_2`.

A clone mirrors the primary's `Assets` folder rather than copying it. That's why the engine DLLs only need to be deployed into the primary project once: every open clone picks up the same files, and there's no separate deploy step per clone.

## Multiplayer Play Mode

Unity's built-in Multiplayer Play Mode (MPPM) is the alternative to a clone: instead of a second Unity process, it runs additional "virtual players" inside the same editor. Either approach gives you a second peer to press play on; which one you reach for is a matter of taste and machine resources, not a Nucleus concern.

## Which peer becomes which

Role resolution for every demo lives in one place: `DemoNetworkDriver.ResolveRole`, in `Nucleus.Integrations.Unity/Demos/Common/Scripts/DemoNetworkDriver.cs`.

```csharp
internal static RoleMode ResolveRole(RoleMode startingRole, bool isCloneProject, bool isMainEditor)
{
    if (startingRole is not RoleMode.Auto)
        return startingRole;

    if (isCloneProject)
        return RoleMode.Client;

    return isMainEditor ? RoleMode.Server : RoleMode.Client;
}
```

It's called with `Application.dataPath.Contains("_clone")` for `isCloneProject` and `Unity.Multiplayer.PlayMode.CurrentPlayer.IsMainEditor` for `isMainEditor`. A ParrelSync clone or an MPPM virtual player resolves to `RoleMode.Client`; a plain main editor falls back to `RoleMode.Server`. The driver's own inspector tooltip on the role field says exactly this:

> Auto: main editor is server, a `_clone` or virtual player is client. Force Server/Client for two independent editors.

This is demo code, not engine behavior — it exists so the sample scenes work without any setup. A real project decides its own role, typically through `UnityTransportManager`'s `Automatic Start Mode` field or by calling `StartServerAsync` / `StartClientAsync` / `StartHostAsync` explicitly.

## The trap: two main editors

`isMainEditor` is true for any plain editor instance, not just the "real" one — a second, independently-installed editor pointed at a plain copy of the project also reports as the main editor. Only the `_clone` path check tells two ParrelSync-related instances apart. Pair anything that isn't a clone-plus-primary (two separate checkouts, two machines) and `Auto` resolves both to `Server`; set the driver's role field to `Server` on one side and `Client` on the other instead.

## Starting a session

Press play in the server peer first, and give it a moment to start listening before pressing play in the client. Both peers connect over loopback, on the port configured on the scene's transport — there's nothing to configure outside the scene itself.

## The redeploy hazard

Dropping newly built DLLs into an editor that's currently in play mode forces Unity to reimport them, which triggers a domain reload mid-session. That tears down and rebuilds every managed object in the running scene, including the ones the network session was mid-flight with. Stop play mode in every open editor and clone before redeploying.
