---
title: "Creating a CoreManager"
---

> **Using Unity?** See [The Nucleus Core Manager component](../../unity/core/unity-core-manager.md).

`CoreManager` is the root of a Nucleus session. Construct one and the session is running; there is no separate `Initialize` or `Start` call.

```csharp
private CoreManager _coreManager = new();
```

That single line is a complete bootstrap: by the time the constructor returns, every manager exists, the managers know about each other, and the network loop is ticking.

## The constructor

```csharp
public CoreManager(uint tickRate = NetworkLoopManager.DefaultTickRate, INetworkLoopStepProvider? networkLoopStepProvider = null)
```

Both arguments are optional.

- `tickRate` is the number of network ticks the session runs per second, fixed for the session's lifetime. Values outside `NetworkLoopManager.MinimumTickRate` through `NetworkLoopManager.MaximumTickRate` are clamped into range and logged. Every rate-derived value the managers hold is baked from this during construction, so it cannot change afterward.
- `networkLoopStepProvider` drives the network loop's steps. Leave it `null` to get the default provider, which steps the loop from the thread pool on a timer.

Supply your own `INetworkLoopStepProvider` here, not after construction. Nothing steps the loop until the constructor's last line, so a provider passed to the constructor means the default provider never runs at all, and the managers built above it register into a loop that is standing still while they do. Installing a provider after construction instead leaves the default provider driving the loop from the thread pool for the whole of that bring-up — a second thread writing the loop's collections while your code is still writing them too. This is why a host that runs its own loop names its provider in the constructor call rather than swapping one in later.

## What construction builds, and in what order

The constructor builds every manager, gives each one a chance to find the others once the whole set exists, and only then starts the loop, so the loop never steps against a session that is only half built. `NetworkLoopManager` is built first because it owns the clamped tick rate, and every manager built after it bakes rate-derived values from that.

Teardown unwinds this in reverse: each manager's `Deinitialize` runs from the last-constructed manager back to the first, because a manager built later typically registered handlers onto managers built earlier.

## The manager fields

Every build exposes these eleven `readonly` fields:

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

### Pro-only fields

A Pro build adds two more:

| Field | Type |
|---|---|
| `BundleManager` | `BundleManager` |
| `WorldPersistenceManager` | `WorldPersistenceManager` |

In a Free build, the fields do not exist on `CoreManager` at all, so there is no null placeholder to check against. `BundleManager` is for content delivered from outside the build (Addressables, a patcher, a CDN); without it a build can only spawn what shipped inside it. `WorldPersistenceManager` is for putting a world on disk and building it back; without it a world lives exactly as long as the process holding it. Unlike the other manager fields, these two are not `readonly`.

## Instance

```csharp
public static CoreManager Instance { get; private set; }
```

`Instance` is a first-write-wins convenience for the common single-manager case: the first `CoreManager` constructed takes the slot and keeps it until it tears down, at which point the slot passes to the next live `CoreManager`, or becomes `null` if none remain. It can only ever name a live manager — a torn-down one is never left sitting in the slot.

```csharp
public static bool EnsureSetInstance(CoreManager coreManager)
```

`EnsureSetInstance` re-points the slot to a specific live `CoreManager`. It returns `false` and leaves the slot untouched if you pass `null` or a `CoreManager` that has already been deinitialized; otherwise it returns `true`.

A process that only ever runs one `CoreManager` can read `Instance` freely. A process running several at once — a host pair, a two-peer test — should pass the `CoreManager` it means explicitly instead, since `Instance` can only ever name one of them.

## Several CoreManagers in one process

Constructing more than one `CoreManager` in the same process is normal and supported; nothing about construction assumes there is only one. Each `CoreManager` owns its own complete set of managers — its own `TransportManager`, `ServerManager`, `NetworkLoopManager`, and so on — and none of that state is shared between instances. What is shared across every `CoreManager` in the process is the static registry that resolves `Instance` and the live-manager list `EnsureSetInstance` and teardown walk; that bookkeeping is process-wide, the managers themselves are not.

## Where configuration lives

There is no engine-wide settings object. Each knob belongs to the manager it configures — the tick rate lives on `NetworkLoopManager`, transport configuration lives on `TransportManager`, and so on for the rest of the fields above. Configuring a session means setting fields on the specific manager that owns the behavior you want to change, documented on that manager's own reference page.
