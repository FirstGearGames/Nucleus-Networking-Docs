---
title: "The Nucleus Core Manager component"
components: "UnityCoreManager"
---

> **Driving the core API directly?** See [Creating a CoreManager](../../core-api/core/core-manager.md).

Every scene that uses Nucleus needs one `UnityCoreManager`. When the scene starts, it creates the session and adds any other Nucleus manager component the session needs.

## Add it from the Nucleus window

Choose **Tools > Nucleus**, select the **Setup** tab, and click **Create** next to **A UnityCoreManager is in the scene**. You can also add the component to a GameObject yourself.

## Change manager settings before you press Play

To change a manager's settings, add that manager component to the same GameObject, or to a child of it, and set its fields before you press Play. The tick rate on `UnityNetworkLoopManager` cannot change during play. The [Unity manager components](./unity-manager-components.md) page lists every manager.

## Reach the session from a script

The component's `CoreManager` property holds the session. A script anywhere in the scene can also reach it through `NucleusUnity.BoundCoreManager`. Every manager exists by the time your scripts' `Start` runs.

## Destroying it ends the session

When the GameObject is destroyed, including when you leave Play mode, the session shuts down.
