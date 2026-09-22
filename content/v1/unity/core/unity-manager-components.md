---
title: "Manager components reference"
---

## UnityManager, the base

Every manager component on the manager GameObject derives from `UnityManager`. It gives each component two things:

- `UnityCoreManager` — the `UnityCoreManager` component that owns the session's `CoreManager`.
- `ManagersInstantiated(UnityCoreManager)` — a virtual method called once, after the `CoreManager` and every one of its managers exist. Override it, call `base.ManagersInstantiated(unityCoreManager)` first, then bind your core manager reference and push any inspector fields into it.

Binding happens in this callback rather than in `Awake` or `OnEnable` because Unity gives no ordering guarantee between components on the same GameObject. `ManagersInstantiated` runs only after the whole manager graph is built, so no component can read a core manager that hasn't been constructed yet regardless of script execution order.

## Components that front a core manager

Each of these exposes the `Nucleus*` core manager it drives as a public property, set inside its own `ManagersInstantiated` override:

| Component | Core manager property |
|---|---|
| `UnityNetworkLoopManager` | `NucleusNetworkLoopManager` (`Nucleus.Managers.NetworkLoop.NetworkLoopManager`) |
| `UnityTransportManager` | `NucleusTransportManager` (`Nucleus.Managers.Transports.TransportManager`) |
| `UnityServerManager` | `NucleusServerManager` (`Nucleus.Managers.Server.ServerManager`) |
| `UnityClientManager` | `NucleusClientManager` (`Nucleus.Managers.Client.ClientManager`) |
| `UnitySystemManager` | `NucleusSystemManager` (`Nucleus.Managers.Systems.SystemManager`) |
| `UnityInterestManager` | `NucleusInterestManager` (`Nucleus.Managers.Interest.InterestManager`) |
| `UnitySceneManager` | `NucleusSceneManager` (`Nucleus.Managers.Scenes.SceneManager`) |

## UnityPhysicsManager

`UnityPhysicsManager` does not front a core manager the way the components above do — there is no core `PhysicsManager` and no `Nucleus*` property on it. It is the inspector seat for process-global physics settings, and feeds `PhysicsSimulationCoordinator` directly: `ExecutionMode` (a `PhysicsExecutionMode`) and a toggle that matches Unity's fixed delta time to the network tick rate. See the physics pages for what `ExecutionMode` controls and how the fixed-delta-time match works.

## Components with no inspector fields

`UnityServerManager`, `UnityClientManager`, `UnityPacketManager`, and `UnityMessageManager` carry no serialized fields. Each still exists to bind its core manager — `ServerManager`, `ClientManager`, `PacketManager`, `MessageManager` — into `UnityCoreManager`'s manager graph and expose it as a `Nucleus*` property, so the manager GameObject is a complete, discoverable front for every core manager even where there's nothing yet to configure from the Inspector.

## Tuning covered elsewhere

Some components own inspector fields that are documented on their own pages rather than repeated here:

- **UnitySystemManager** — redundancy, state interpolation, host migration, and controller retention settings.
- **UnityInterestManager** — evaluation cadence, host interest, and interest condition settings.
- **UnitySceneManager** — join placement, automatic scene requests, and load timeout settings.

## Reaching a manager from a script

Three ways to get from your own script to a core manager, depending on what reference you already hold:

- **The component's `Nucleus*` property**, when you have a reference to the manager component, e.g. `unitySystemManager.NucleusSystemManager`.
- **`UnityCoreManager.CoreManager`**, when you have a reference to the `UnityCoreManager` but not the specific component, e.g. `unityCoreManager.CoreManager.InterestManager`.
- **`NucleusUnity.BoundCoreManager`**, when you have no reference at all. It's the `CoreManager` the Unity integration bound at startup.

## Runtime changes don't travel

Every inspector field covered here is pushed into its core manager once, inside `ManagersInstantiated`, when the manager graph is built. Editing a field in the Inspector after startup changes the serialized value on the component but does not push it into the core manager again — the core manager already has its own copy. To change a setting at runtime, set it directly on the `Nucleus*` property instead.
