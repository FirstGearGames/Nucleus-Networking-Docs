---
title: "If nothing replicates"
---

If the second editor connects but does not show your objects, check these in order.

## 1. The session must be running in both editors

During Play, open **Tools > Nucleus** and select the **Traffic** tab. If it shows **Start** buttons instead of **Stop** buttons, the session never started. Set **Start On Play** to **Auto** in the Setup tab, or start the session from your own code with `StartHostAsync`, `StartServerAsync` or `StartClientAsync` on `UnityTransportManager`.

## 2. The code generator must be running

If the generator does not run, nothing replicates and no error appears. Check the label as described in [Install Nucleus in Unity](./installing-the-unity-integration.md).

## 3. The prefab must be registered

If the client's Console shows this error, the client does not know the prefab:

```
No networked prefab is registered for identity [...]; spawned NetworkSystem Id [...] cannot be instantiated.
```

In the Nucleus window's **Build** tab, click **Rebuild** next to **Rebuild Network Prefab Collection**. Then click **Validate** next to **Validate Network Prefabs**, which logs any other problem with your prefabs.

## 4. Your script must check the right role

Code that only runs when `IsController(ControllerType.Client)` is true does nothing on the server, and code that only runs on the server does nothing on a client. On a host, both the server and the client are running, which can hide a check that is wrong.

## 5. An object placed in a scene needs a networked scene

An object you place in a scene, rather than spawn, only appears on a client once the server has opened that scene through Nucleus and placed the client in it. See [Networked scenes in Unity](../unity/scenes/networked-scenes-in-unity.md).

## 6. Interest rules must let the client see the object

Check the **World Rules** list on `UnityInterestManager` and the **Rules** list on the object's `NetworkInterestObject`, if it has one. Each rule can hide an object from a client. See [What area of interest is](../unity/interest/area-of-interest.md).
