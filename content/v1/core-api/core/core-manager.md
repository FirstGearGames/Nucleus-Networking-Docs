---
title: "Creating a CoreManager"
---

> **Using Unity?** See [The Nucleus Core Manager component](../../unity/core/unity-core-manager.md).

`CoreManager` is the root of a Nucleus session. Constructing one starts the session: when the constructor returns, every manager exists and the network loop is ticking. There is no separate `Initialize` or `Start` call.

```csharp
private CoreManager _coreManager = new();
```

## Pass the tick rate and loop provider to the constructor

```csharp
public CoreManager(uint tickRate = NetworkLoopManager.DefaultTickRate, INetworkLoopStepProvider? networkLoopStepProvider = null)
```

- `tickRate` is the number of network ticks per second, fixed for the session. Values outside `NetworkLoopManager.MinimumTickRate` through `NetworkLoopManager.MaximumTickRate` are clamped into range and logged. It cannot change after construction.
- `networkLoopStepProvider` drives the network loop's steps. Leave it `null` to get the default provider, which steps the loop from the thread pool on a timer.

Supply your own `INetworkLoopStepProvider` here, not after construction. A provider passed to the constructor means the default never runs. Installed afterwards, the default has already been stepping the loop from the thread pool while your setup code ran, racing it. See [Driving the loop yourself](./custom-loop-step-provider.md).

## Reach every manager through its field

Every build has these eleven `readonly` fields:

| Field | Type |
|---|---|
| `NetworkLoopManager` | `NetworkLoopManager` |
| `TransportManager` | `TransportManager` |
| `ServerManager` | `ServerManager` |
| `ClientManager` | `ClientManager` |
| `SystemManager` | `SystemManager` |
| `InterestManager` | `InterestManager` |
| `SceneManager` | `Scenes.SceneManager` |
| `PacketManager` | `PacketManager` |
| `MessageManager` | `MessageManager` |
| `RpcManager` | `RpcManager` |
| `ViolationManager` | `ViolationManager` |

A Pro build adds two fields, which are not `readonly`:

| Field | Type |
|---|---|
| `BundleManager` | `BundleManager` |
| `WorldPersistenceManager` | `WorldPersistenceManager` |

In a Free build these two fields do not exist at all, so there is no null to check. `BundleManager` is for content delivered from outside the build (Addressables, a patcher, a CDN); without it a build can only spawn what shipped inside it. `WorldPersistenceManager` writes a world to disk and builds it back; without it a world lives only as long as the process holding it.

There is no engine-wide settings object. Each setting is a field on the manager it configures, documented on that manager's own page.

## Use Instance only when there is one CoreManager

```csharp
public static CoreManager Instance { get; private set; }
public static bool EnsureSetInstance(CoreManager coreManager)
```

- The first `CoreManager` constructed takes `Instance` and keeps it until it tears down. The slot then passes to the next live `CoreManager`, or becomes `null` if none remain. It never names a torn-down manager.
- `EnsureSetInstance` points the slot at a specific live `CoreManager`. It returns `false` and leaves the slot unchanged for `null` or an already deinitialized `CoreManager`.

You can run several `CoreManager`s in one process, such as a host pair or a two-peer test. Each owns its own complete set of managers, and none of their state is shared. Pass the one you mean explicitly instead of reading `Instance`, which can only name one of them.
