---
title: "NetworkSystem reference"
---

## Identify a system

| Member | Type | Meaning |
|---|---|---|
| `Id` | `uint` | The network identity, unique across the network. `UnsetId` (`0`) until the system starts. |
| `PlatformId` | `uint` | The engine object this system links to: a scene object's identifier within its scene, or a dynamic prefab's local identifier within its shard. `UnsetPlatformId` (`0`) until assigned, and always for a system with no engine object. |
| `PrefabBundleId` | `ushort` | The content bundle owning this system's prefab. Meaningful only for a dynamically spawned prefab; zero is the base build. |
| `RequiredBundleId` | `ushort` | The bundle a client must hold before this system may spawn for it. Falls back to `PrefabBundleId` when no override is set. Server-side only; clients never receive it. |
| `SetRequiredBundleId(ushort)` | method | Overrides `RequiredBundleId` without changing `PrefabBundleId`. |
| `UnsetRequiredBundleId` | `const ushort` | `ushort.MaxValue`, **not** `0` like the other Unset constants, because zero is a valid requirement naming the base build. |
| `IsSceneObject` | `bool` | True when `PlatformId` names a scene object that already exists on every peer, rather than a prefab a receiver must instantiate. |
| `SceneHandle` | `uint` | The live scene instance this system belongs to. `UnsetSceneHandle` (`0`) when it belongs to the scene the peer booted into rather than one the server opened. |
| `GroupId` | `uint` | The `NetworkSystemGroup` this system belongs to. `UnsetGroupId` (`0`) when ungrouped. |
| `ParentId` | `uint` | The `Id` of the system this one is parented to, such as a crate riding a vehicle. `UnsetParentId` (an alias of `UnsetId`) at the root of its scene. |

## Track its lifecycle

`State` is a `NetworkSystemState`. `IsStarted` is true only while `State` is `Started`.

| Value | Meaning |
|---|---|
| `Starting` | Accepted but not yet live. A start accepted late in a tick stays here until the next tick. |
| `Started` | Live and networked. |
| `Stopping` | A stop was accepted; it takes effect at the end of the tick. |
| `Stopped` | Not networked. |

What the identity members hold during a transition:

- **Starting**: if the start was deferred to the next tick, `Id` is still `UnsetId` and `PlatformId`, `GroupId` and `SceneHandle` are not yet assigned. All are set together when the system reaches `Started`.
- **Stopping**: `Id`, `PlatformId`, `GroupId`, `SceneHandle` and `ParentId` keep their last live values until the end of the tick.

## Check the local peer's role

These answer "is the server, client or host running here", not "do I control this object". For control, use `IsController(ControllerType)`.

| Member | Meaning |
|---|---|
| `IsServerStarted` | The local peer runs the server. |
| `IsClientStarted` | The local peer runs an authenticated client. |
| `IsHostStarted` | The local peer runs a server and an authenticated local client. Both `IsServerStarted` and `IsClientStarted` are then true. |
| `CoreManager` | The `CoreManager` managing this system, which reaches every other manager. |

## Read its components

| Member | Meaning |
|---|---|
| `ComponentCount` | The number of `NetworkComponent`s attached. |
| `TryGetComponent<T0>(out T0 component)` | The first attached component of type `T0`. Returns false when none is attached. |
| `TryGetComponent<T0>(byte componentId, out T0 component)` | The component at a component Id, when it is of type `T0`. The Id is the order the component was added in, the same on every peer. |
| `MaximumComponentCount` | The most components one system can hold: 31. |
| `GroupMemberCount` | The number of members in this system's group, or zero when ungrouped. On a client it is the count received when the group arrived. |

[What a system is](./what-is-a-system.md) shows how to walk every component of a repeated type.

## Log a system

`NetworkSystemExtensions.AsString(this NetworkSystem)` returns a one-line summary of state, platform id, group id and id. It returns `"IsNull"` for a null reference, so it needs no null check.

```csharp
Logger<MyType>.LogInformation($"System: [{system.AsString()}]");
```

## Find the rest of its surface

| Category | Covers |
|---|---|
| Control | `ControllerConnectionId` and who drives the system. |
| Write access | `MemberWriteAccess` and per-member write permissions. |
| Interest | Observer registration and what a connection is served. |
| RPCs | `IRpcScope`, `RpcSendAccess`, and remote calls scoped to a system. |
| Client state | `MemberRole.Predict` members, sent by the controlling client every tick. |
| Reconcile | `ReconcileRequired`, `ResultMismatched`, the simulation callbacks and correcting predicted state. |
