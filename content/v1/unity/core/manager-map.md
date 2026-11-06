---
title: "The manager map"
---

> **Driving the core API directly?** See [The manager map](../../core-api/core/manager-map.md).

## Each concern has one manager

`CoreManager` holds eleven managers as public fields, such as `coreManager.TransportManager`. Every setting lives on the manager that owns its concern; there is no single settings object, so to change something, find its manager first.

| Manager | Owns | Unity component |
|---|---|---|
| `NetworkLoopManager` | The tick loop: tick rate and the steps that drive a tick forward. | `UnityNetworkLoopManager` |
| `TransportManager` | The transports a session sends and receives over. | `UnityTransportManager` |
| `ServerManager` | Server-side session state. | `UnityServerManager` |
| `ClientManager` | Client-side session state. | `UnityClientManager` |
| `SystemManager` | Networked systems: spawning, ownership, and their lifecycle. | `UnitySystemManager` |
| `InterestManager` | What each peer is allowed to see. | `UnityInterestManager` |
| `SceneManager` | Scene load, stacking, and per-scene state. | `UnitySceneManager` |
| `PacketManager` | Packet framing and dispatch. | `UnityPacketManager` |
| `MessageManager` | Messages sent between peers. | `UnityMessageManager` |
| `RpcManager` | Remote procedure calls. | None |
| `ViolationManager` | Detecting and acting on protocol violations. | None |

`BundleManager` (content delivered from outside the build, such as Addressables, a patcher or a CDN) and `WorldPersistenceManager` (writing a world to disk and building it back) exist only in Pro. In a Free build, `CoreManager` has no such fields at all.

`UnityPhysicsManager` is the one component that fronts no core manager. It holds physics execution settings; see [Manager components reference](./unity-manager-components.md).

## Reach a manager from a script

- Through a component's `Nucleus*` property, for example `unityTransportManager.NucleusTransportManager`.
- Through `UnityCoreManager.CoreManager` or `NucleusUnity.BoundCoreManager`, then the field, for example `NucleusUnity.BoundCoreManager.RpcManager`. Use this for `RpcManager` and `ViolationManager`, which have no component.
