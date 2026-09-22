---
title: "The manager map"
---

## The eleven managers

`CoreManager` owns eleven managers as public fields, constructed once and held for the life of the session. Each one is documented in full on its own pages elsewhere; this page only says which manager owns which concern and how to reach it.

| Manager | Owns |
|---|---|
| `NetworkLoopManager` | The tick loop: tick rate and the steps that drive a tick forward. |
| `TransportManager` | The transports a session sends and receives over. |
| `ServerManager` | Server-side session state. |
| `ClientManager` | Client-side session state. |
| `SystemManager` | Networked systems: spawning, ownership, and their lifecycle. |
| `InterestManager` | What each peer is allowed to see. |
| `SceneManager` | Scene load, stacking, and per-scene state. |
| `PacketManager` | Packet framing and dispatch. |
| `MessageManager` | Messages sent between peers. |
| `RpcManager` | Remote procedure calls. |
| `ViolationManager` | Detecting and acting on protocol violations. |

## The two Pro-only managers

`BundleManager` and `WorldPersistenceManager` are not part of the base `CoreManager`. They are added by Pro partial classes - `CoreManager.Bundles.Pro.cs` and `CoreManager.Persistence.Pro.cs` - each of which declares the field and fills in a partial hook (`AddBundleManager`, `AddWorldPersistenceManager`) that the base constructor calls unconditionally. In a Free build neither partial exists, the hooks compile away to nothing, and `CoreManager` simply has no `BundleManager` or `WorldPersistenceManager` field at all - not null, absent.

`BundleManager` owns content delivered from outside the build (Addressables, a patcher, a CDN). `WorldPersistenceManager` owns writing a world to disk and building it back.

## Reaching a manager

**From C#**, every manager is a public field directly on `CoreManager`: `coreManager.TransportManager`, `coreManager.SystemManager`, and so on, including the two Pro fields when they're present.

**From Unity**, nine of the eleven have a matching `Unity*Manager` component with a `Nucleus*Manager` property that returns the same instance:

| Component | Property |
|---|---|
| `UnityNetworkLoopManager` | `NucleusNetworkLoopManager` |
| `UnityTransportManager` | `NucleusTransportManager` |
| `UnityServerManager` | `NucleusServerManager` |
| `UnityClientManager` | `NucleusClientManager` |
| `UnitySystemManager` | `NucleusSystemManager` |
| `UnityInterestManager` | `NucleusInterestManager` |
| `UnitySceneManager` | `NucleusSceneManager` |
| `UnityPacketManager` | `NucleusPacketManager` |
| `UnityMessageManager` | `NucleusMessageManager` |

Two exceptions have no Unity-side component of their own: `RpcManager` and `ViolationManager`. Reach either one through `UnityCoreManager.CoreManager` (the component that owns the session's `CoreManager`) or through `NucleusUnity.BoundCoreManager`, then take the field as in C#.

The tenth Unity component `EnsureManagers` adds, `UnityPhysicsManager`, is the odd one out in the other direction: it fronts no core manager at all. It's an inspector-side seat for physics execution settings that a physics coordinator reads directly, not a wrapper around one of the eleven fields above.

## No engine-wide settings object

There is no single settings type for a Nucleus session. Every knob - tick rate, a transport's connection settings, interest rules, scene load behavior - is a field on the manager that owns that concern. To change something, find its manager first.

## Managers are instance-scoped

None of the eleven (or thirteen, with Pro) managers are static. Each belongs to one `CoreManager`, and a `CoreManager` is just an object - a process can construct more than one, each with its own independent set of managers. This is what lets a single process host a server and a client in the same run, or run several test peers side by side, without their state colliding.
