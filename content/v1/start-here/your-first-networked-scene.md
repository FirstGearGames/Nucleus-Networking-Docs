---
title: "Set up a networked scene"
---

> **Using plain .NET?** See [Your first .NET host](./your-first-dotnet-host.md).

Every scene that uses Nucleus needs one `UnityCoreManager`. The Nucleus window adds it for you.

## Add the core manager

1. Open your scene and save it.
2. Choose **Tools > Nucleus** and select the **Setup** tab.
3. Next to **A UnityCoreManager is in the scene**, click **Create**. This adds a GameObject named Nucleus that holds everything a session needs.
4. Click the button on every other row that shows a warning, until every row shows a tick.

## Choose how the session starts

1. In the **Session** section of the Setup tab, set **Start On Play** to **Auto**.
2. Leave **Tick Rate** at 30.

The first editor to press Play becomes the host, which runs a server and a client together so you can play too. A second editor finds the host already running and joins it as a client.

**Tick Rate** is how many times per second Nucleus sends updates, and 30 suits most games.

## Press Play to check it

1. Press Play.
2. Select the **Traffic** tab of the Nucleus window.

**Expected result:** The tab shows **Stop Server** and **Stop Client** buttons, which means both halves of the host are running.

The session uses port 7777 on this computer. To play across computers, see [Synapse Transport component](../unity/transports/synapse-transport-component.md).
