---
title: "Manager components reference"
components: "UnityManager, UnitySystemManager, UnityClientManager, UnityServerManager, UnityPacketManager, UnityMessageManager"
---

Each manager component on the Nucleus GameObject sets up one core manager. For which manager owns what, see [The manager map](./manager-map.md).

## Set fields before you press Play

Each inspector field is copied into its core manager once, when the session starts. Editing a field during play changes the component but not the running session. To change a setting at runtime, set it on the component's `Nucleus*` property instead.

## Each component exposes its core manager

| Component | Core manager property |
|---|---|
| `UnityNetworkLoopManager` | `NucleusNetworkLoopManager` (`Nucleus.Managers.NetworkLoop.NetworkLoopManager`) |
| `UnityTransportManager` | `NucleusTransportManager` (`Nucleus.Managers.Transports.TransportManager`) |
| `UnityServerManager` | `NucleusServerManager` (`Nucleus.Managers.Server.ServerManager`) |
| `UnityClientManager` | `NucleusClientManager` (`Nucleus.Managers.Client.ClientManager`) |
| `UnitySystemManager` | `NucleusSystemManager` (`Nucleus.Managers.Systems.SystemManager`) |
| `UnityInterestManager` | `NucleusInterestManager` (`Nucleus.Managers.Interest.InterestManager`) |
| `UnitySceneManager` | `NucleusSceneManager` (`Nucleus.Managers.Scenes.SceneManager`) |
| `UnityPacketManager` | `NucleusPacketManager` |
| `UnityMessageManager` | `NucleusMessageManager` |

`UnityPacketManager` and `UnityMessageManager` have no inspector fields. `UnityClientManager` has one, **Maximum Framerate**: the most frames per second while this peer runs as a client, from 1 to 1000. On a host the higher of it and the server's limit applies, and Unity ignores it while vertical sync is on. The settings on `UnitySystemManager` (redundancy, state interpolation, partial state apply, host migration, controller retention), `UnityInterestManager` (evaluation cadence, host interest, interest conditions) and `UnitySceneManager` (join placement, automatic scene requests, load timeout) are covered on their own pages.

## Configure UnityServerManager

The **Client Limits** section is covered in [Securing a server in Unity](../diagnostics/securing-a-server-in-unity.md).

In Pro, the **Object Pacing** section limits how many kilobytes (1 kB is 1,024 bytes) of whole objects any one client is sent per tick: new objects, and objects sent again whole after packet loss. Ordinary updates to objects a client already holds are not limited. What does not fit is sent on the ticks after, so a join, a scene load or newly unlocked content arrives over several ticks instead of one.

| Field | Default | Sets |
|---|---|---|
| **Object Pacing Enabled** | On | `ServerManager.ObjectPacingEnabled`. Off sends every whole object on the tick it is owed. |
| **Maximum Object Kilobytes Per Tick** | `50` (`ServerManager.DefaultMaximumObjectKilobytesPerTick`), range 1 to 255 | `ServerManager.MaximumObjectKilobytesPerTick`. Hidden while pacing is off. Raise it for a fast LAN or a world of many small objects; lower it for slow links. |

A Free build has neither field and sends every whole object on the tick it is owed. See [Object pacing](../../core-api/core/object-pacing.md).

## Configure UnityPhysicsManager

`UnityPhysicsManager` fronts no core manager. It holds `ExecutionMode` (a `PhysicsExecutionMode`) and a toggle that matches Unity's fixed delta time to the network tick rate. See [Physics execution modes](../physics/physics-execution-modes.md).

## Write your own manager component

Derive from `UnityManager` and override `ManagersInstantiated(UnityCoreManager)`. It runs once, after the `CoreManager` and all its managers exist. Call `base.ManagersInstantiated(unityCoreManager)` first, then bind your core manager reference and push your inspector fields into it. The `UnityCoreManager` property holds the component that owns the session.
