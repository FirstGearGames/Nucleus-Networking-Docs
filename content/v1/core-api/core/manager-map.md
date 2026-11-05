---
title: "The manager map"
---

> **Using Unity?** See [The manager map](../../unity/core/manager-map.md) for the Unity component that fronts each manager.

## Each concern has one manager

`CoreManager` holds eleven managers as public fields, for the life of the session. Reach each one as a field, such as `coreManager.TransportManager`.

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

A Pro build adds two more fields. In a Free build they are absent, not null.

| Manager | Owns |
|---|---|
| `BundleManager` | Content delivered from outside the build (Addressables, a patcher, a CDN). |
| `WorldPersistenceManager` | Writing a world to disk and building it back. |

## Every setting lives on the manager that owns it

There is no single settings type. Tick rate, a transport's connection settings, interest rules and scene load behavior are each fields on the manager that owns them, so to change something, find its manager first.

None of the managers are static. Each belongs to one `CoreManager`, and a process can construct several `CoreManager`s, each with its own managers, such as a server and a client in one run or several test peers side by side.
