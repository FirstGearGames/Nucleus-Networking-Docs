---
title: "Testing with two editors"
---

> **Driving the core API directly?** See [Running two peers in one process](./running-two-peers-in-one-process.md).

## One editor shows nothing

Every interesting piece of networked behavior is a difference between what two peers see: a spawn the server created and the client received, a value the client can't write because it doesn't hold permission, an object that falls out of one peer's interest but not the other's. A single play session only ever shows one side of that difference. To see anything worth testing, run a server and a client at the same time, in two separate Unity processes, and watch both screens.

## ParrelSync clones

A [ParrelSync](https://github.com/VeriorPies/ParrelSync) clone is a second Unity process pointed at a project folder whose name is the primary's with a `_clone` suffix.

A clone mirrors the primary's `Assets` folder rather than copying it. That's why the engine DLLs only need to be deployed into the primary project once: every open clone picks up the same files, and there's no separate deploy step per clone.

## Which peer becomes which

Every demo scene decides its role the same way. The demo driver's role field defaults to `Auto`, and on `Auto` a ParrelSync clone or a player build starts as the client, while the main editor starts as the server. The field's tooltip says the same:

> Auto: main editor is server, a `_clone` project or a build is client. Force Server/Client for two independent editors.

This is demo code, not engine behavior. It exists so the sample scenes work without any setup. A real project decides its own role, typically through `UnityTransportManager`'s `Automatic Start Mode` field or by calling `StartServerAsync` / `StartClientAsync` / `StartHostAsync` explicitly.

Setting both editors to start as host also works, on purpose. `StartHostAsync` starts the client half whether or not the server half bound its port, so the first editor to press play takes the port and hosts, and the second fails to bind and its client half joins the first as an ordinary client. The second editor needs no separate client setup.

## The trap: two main editors

Any editor that is not a clone counts as the main editor, not just the "real" one. A second, independently installed editor pointed at a plain copy of the project counts too. Only the `_clone` path check tells two ParrelSync-related instances apart. Pair anything that isn't a clone-plus-primary (two separate checkouts, two machines) and `Auto` resolves both to `Server`; set the driver's role field to `Server` on one side and `Client` on the other instead.

## Starting a session

Press play in the server peer first, and give it a moment to start listening before pressing play in the client. Both peers connect over loopback, on the port configured on the scene's transport — there's nothing to configure outside the scene itself.

## The redeploy hazard

Dropping newly built DLLs into an editor that's currently in play mode forces Unity to reimport them, which triggers a domain reload mid-session. That tears down and rebuilds every managed object in the running scene, including the ones the network session was mid-flight with. Stop play mode in every open editor and clone before redeploying.
