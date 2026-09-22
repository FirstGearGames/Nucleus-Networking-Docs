---
title: "NetworkSystem reference"
---

## Identity

A `NetworkSystem` carries two kinds of identity: the network Id every peer agrees on, and the platform Id that ties it to an engine object.

| Member | Type | Meaning |
|---|---|---|
| `Id` | `uint` | The Id unique to the network for this instance. `UnsetId` (`0`) until the system is started. |
| `PlatformId` | `uint` | The Id of the object for the running platform this system belongs to: a scene object's identifier within its scene, or a dynamic prefab's local identifier within its shard. `UnsetPlatformId` (`0`) until assigned. |
| `PrefabBundleId` | `ushort` | The content bundle owning this system's prefab, pairing with `PlatformId`. Meaningful only for a dynamically spawned prefab; zero is the base build's default shard. |
| `RequiredBundleId` | `ushort` | The bundle a client must hold before this system may spawn for it. Falls back to `PrefabBundleId` when no override is set. |
| `SetRequiredBundleId(ushort)` | method | Overrides `RequiredBundleId` without touching `PrefabBundleId`, so the wire identity of the prefab is unaffected. |
| `UnsetRequiredBundleId` | `const ushort` | `ushort.MaxValue`, **not** `0` like the other Unset constants — zero is a valid requirement, naming the base build. |
| `IsSceneObject` | `bool` | True when `PlatformId` identifies a scene object rather than a dynamically spawned prefab. |
| `SceneHandle` | `uint` | The live scene instance this system belongs to. `UnsetSceneHandle` (`0`) when it belongs to no authority-opened scene. |
| `GroupId` | `uint` | The Id of the `NetworkSystemGroup` this system belongs to. `UnsetGroupId` (`0`) when ungrouped. |
| `ParentId` | `uint` | The `Id` of the system this one is parented to. `UnsetParentId` (an alias of `UnsetId`) when parented to nothing. |

```csharp
if (system.RequiredBundleId != NetworkSystem.UnsetRequiredBundleId)
{
    // An explicit override is in effect, distinct from PrefabBundleId.
}
```

`RequiredBundleId` is authority-side only: it feeds interest resolution and is never replicated, so reading or setting it costs no bandwidth.

## Lifecycle

`State` is a `NetworkSystemState`:

| Value | Meaning |
|---|---|
| `Starting` | Accepted but not yet live. Normally transient; a start too late for the current tick's state flush holds here until the next tick increments. |
| `Started` | Live and networked. |
| `Stopping` | A stop has been accepted; the actual stop happens at the end of the tick. |
| `Stopped` | Not networked. |

`IsStarted` is `State is NetworkSystemState.Started`.

What each identity read is worth during a transition:

- **Starting**: `IsStarted` is false. If the start was deferred past the tick's state flush, `Id` is still `UnsetId` and the rest of the identity (`PlatformId`, `GroupId`, `SceneHandle`) is not yet assigned — all of it is stamped together when the system reaches `Started`.
- **Stopping**: `IsStarted` is false, but `Id`, `PlatformId`, `GroupId`, `SceneHandle` and `ParentId` still hold their last live values. Nothing clears them until the despawn completes at end of tick and the system returns to its pool.

## Role reads

| Member | Meaning |
|---|---|
| `IsServerStarted` | Whether the local peer runs the server. |
| `IsClientStarted` | Whether the local peer runs an authenticated client. |
| `IsHostStarted` | Whether the local peer runs as a host (a started server alongside an authenticated local client). |
| `CoreManager` | The `CoreManager` managing this system. Every other manager (transport, interest, RPC, systems) is reached from here. |

In host mode, `IsServerStarted` and `IsClientStarted` are both true at once.

```csharp
if (system.IsServerStarted)
{
    // Authority-only logic.
}
```

## Composition

| Member | Meaning |
|---|---|
| `ComponentCount` | The number of `NetworkComponent`s attached to this system. |
| `TryGetComponent<T0>(out T0 component)` | Retrieves a contained `NetworkComponent` of type `T0`, such as a transform component. Returns false when none is attached. |
| `GroupMemberCount` | The number of members this system's group currently holds. Zero for an ungrouped system. On the authority this is the live group count; on a receiver it is the count the full header carried. |

```csharp
if (system.TryGetComponent(out MyTransformComponent transform))
{
    // Read or write members on the component the system rented.
}
```

## Diagnostics

`NetworkSystemExtensions.AsString(this NetworkSystem)` builds a human-readable one-liner for logging: state, platform id, group id, and id. It returns `"IsNull"` when called on a null reference, so it is safe to log without a null check.

```csharp
Logger<MyType>.LogInformation($"System: [{system.AsString()}]");
```

## Where the rest lives

This page indexes identity, lifecycle, role and composition. The rest of `NetworkSystem`'s surface is documented in its own category:

| Category | Covers |
|---|---|
| Control | `ControllerConnectionId` and who drives the system. |
| Write access | `StateWriteAccess` and per-member write permissions. |
| Interest | Observer registration and what a connection is served. |
| RPCs | `IRpcScope`, `RpcSendAccess`, and remote procedure calls scoped to a system. |
| Inputs | `NetworkInputComponent` and upstream input serialization. |
| Reconcile | `ReconcileRequired` and correcting predicted state. |
