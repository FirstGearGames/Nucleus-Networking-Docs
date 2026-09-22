---
title: "FishNet to Nucleus name map"
---

## Read this first

This table shows where FishNet concepts and Nucleus concepts line up. It is not an alias list and it does not import FishNet names into Nucleus. Nucleus has its own vocabulary; write Nucleus names in Nucleus code, not FishNet ones translated in place. Some rows also mark where the shapes genuinely differ, not just the names.

## Objects and scripts

| FishNet | Nucleus |
|---|---|
| `NetworkObject` | `NetworkSystem` in the core, `NetworkSystemObject` in the Unity integration |
| `NetworkBehaviour` | `NucleusBehaviour<T>` (Unity), layered over `MonoBehaviour` plus `NetworkSystemObject` plus `NetworkComponent` |

These are not one-to-one. A FishNet `NetworkObject` is one networked identity per `GameObject`. A Nucleus `NetworkSystem` is not tied to a `GameObject` at all in the core, and in Unity one `GameObject`'s `NetworkSystemObject` can link several `NetworkSystem`s at once, each carrying its own `NetworkComponent`.

## Replicated state

| FishNet | Nucleus |
|---|---|
| `SyncVar<T>` | `NetworkMember<T0>` |
| `SyncList<T>` | `NetworkListMember<T0>` |
| `SyncDictionary<TKey, TValue>` | `NetworkDictionaryMember<T0, T1>` |
| `SyncHashSet<T>` | `NetworkHashSetMember<T0>` |
| *(no FishNet counterpart)* | `NetworkArrayMember<T0>` |
| *(no FishNet counterpart)* | `NetworkQueueMember<T0>` |
| `OnChange` (per-member callback) | `NetworkComponent.OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)` |

`OnMembersChanged` is component-wide, not per-member: it fires once per component with a flag mask of which members changed, and a `MemberChangeDirection` (`Write` or `Read`) saying which side of the wire the raise is reporting. There is no per-member changed event; this is a different shape, not a missing feature.

## Ownership and calls

| FishNet | Nucleus |
|---|---|
| `Owner` / `IsOwner` | `ControllingClient` / `IsController(ControllerType.Client)` |
| `GiveOwnership(connection)` | `SetController(connection)` |
| `RemoveOwnership()` | `SetController(null)` |
| `[ServerRpc]` / `[ObserversRpc]` / `[TargetRpc]` | an `IRpc` struct sent with `SendRpc<T0>(RpcTarget, Channel, T0, RpcSelfDelivery)` and an `RpcTarget` (`RpcTarget.Server`, `RpcTarget.Observers`, `RpcTarget.ObserversExcept(...)`, `RpcTarget.To(connection)`) |
| `RequireOwnership` | `RpcSendAccess` |
| `IBroadcast` | `IMessage` |

There are no attribute-driven RPCs in Nucleus. A remote call is a plain struct implementing `IRpc`, sent explicitly through `SendRpc` with a target and channel, rather than a method decorated with an attribute. That is a design choice, not a gap.

`ControllerType` also has a `Server` and an `AnyController` value alongside `Client`, for checking whether the local peer is the server, the controlling client, or either.

## Managers and infrastructure

| FishNet | Nucleus |
|---|---|
| `TimeManager` | `NetworkLoopManager` |
| `InstanceFinder` | `CoreManager.Instance` (core) or `NucleusUnity.BoundCoreManager` (Unity) |
| `ObserverCondition` | `IInterestCondition` |
| `Authenticator` | `IClientAuthenticator` |
| `NetworkConnection` | `Connection` |
| `ClientId` | `Connection.Id` |
| kicking a client | `ServerManager.KickClient(connection)` |

`CoreManager.Instance` is a real static slot, set the first time a `CoreManager` is constructed and guarded by `EnsureSetInstance` for a process that wants to name a different one as the instance later. `NucleusUnity.BoundCoreManager` is the Unity-side equivalent, bound by the integration's bootstrap.

Both slots name exactly one manager. A process running more than one `CoreManager` at a time — a host pair in the same process, a two-peer test — has more than one valid manager and no slot can name both. In that situation, resolve and pass the `CoreManager` explicitly instead of reading the static.

## Identical on both sides

These read the same in Nucleus as in FishNet; no rename to look up.

- `Channel.Reliable`, `Channel.Unreliable`
- `IsServerStarted`
- `IsClientStarted`
- `IsHostStarted`

## No migration tool

There is no automated FishNet-to-Nucleus converter. Port code by hand, using this map to find the replacement concept, then write it in Nucleus's own shape rather than FishNet's.
