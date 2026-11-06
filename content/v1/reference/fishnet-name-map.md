---
title: "FishNet to Nucleus name map"
---

This map shows where FishNet and Nucleus concepts line up. It is not an alias list: write Nucleus names in Nucleus code. Some rows mark where the shapes differ, not just the names. There is no automated converter; port code by hand and write it in Nucleus's own shape.

## Map objects and scripts

| FishNet | Nucleus |
|---|---|
| `NetworkObject` | `NetworkSystem` in the core, `NetworkSystemObject` in the Unity integration |
| `NetworkBehaviour` | `NucleusBehaviour<T>` (Unity), layered over `MonoBehaviour` plus `NetworkSystemObject` plus `NetworkComponent` |

A FishNet `NetworkObject` is one networked identity per `GameObject`. A Nucleus `NetworkSystem` is not tied to a `GameObject` in the core, and in Unity one `GameObject`'s `NetworkSystemObject` can link several `NetworkSystem`s, each carrying its own `NetworkComponent`.

## Map replicated state

| FishNet | Nucleus |
|---|---|
| `SyncVar<T>` | `NetworkMember<T0>` |
| `SyncList<T>` | `NetworkListMember<T0>` |
| `SyncDictionary<TKey, TValue>` | `NetworkDictionaryMember<T0, T1>` |
| `SyncHashSet<T>` | `NetworkHashSetMember<T0>` |
| *(no FishNet counterpart)* | `NetworkArrayMember<T0>` |
| *(no FishNet counterpart)* | `NetworkQueueMember<T0>` |
| `OnChange` (per-member callback) | `NetworkComponent.OnMembersChanged(ulong memberFlags, MemberChangeDirection memberChangeDirection)` |

`OnMembersChanged` fires once per component, with a flag mask of which members changed and a `MemberChangeDirection` (`Write` or `Read`) saying which side the change came from. There is no per-member changed event.

## Map ownership and calls

| FishNet | Nucleus |
|---|---|
| `Owner` / `IsOwner` | `ControllingClient` / `IsController(ControllerType.Client)` |
| `GiveOwnership(connection)` | `SetController(connection)` |
| `RemoveOwnership()` | `SetController(null)` |
| `[ServerRpc]` / `[ObserversRpc]` / `[TargetRpc]` | an `IRpc` struct sent with `TrySendRpc<T0>(RpcTarget, Channel, T0, RpcSelfDelivery)` and an `RpcTarget` (`RpcTarget.Server`, `RpcTarget.Observers`, `RpcTarget.ObserversExcept(...)`, `RpcTarget.To(connection)`) |
| `RequireOwnership` | `RpcSendAccess` |
| `IBroadcast` | `IMessage` |

Nucleus has no attribute-driven RPCs. A remote call is a plain struct implementing `IRpc`, sent with `TrySendRpc`.

`ControllerType` also has `Server` and `AnyController`, for checking whether the local peer is the server, the controlling client, or either.

## Map managers and infrastructure

| FishNet | Nucleus |
|---|---|
| `TimeManager` | `NetworkLoopManager` |
| `InstanceFinder` | `CoreManager.Instance` (core) or `NucleusUnity.BoundCoreManager` (Unity) |
| `ObserverCondition` | `IInterestCondition` |
| `Authenticator` | `IClientAuthenticator` |
| `NetworkConnection` | `Connection` |
| `ClientId` | `Connection.Id` |
| kicking a client | `ServerManager.KickClient(connection)` |

`CoreManager.Instance` is set when the first `CoreManager` is constructed, and `EnsureSetInstance` can point it at another. `NucleusUnity.BoundCoreManager` is the Unity equivalent. Each names one manager, so a process running several, such as a host pair or a two-peer test, should pass the `CoreManager` explicitly.

## Some names are the same in both

- `Channel.Reliable`, `Channel.Unreliable`
- `IsHostStarted`, on a `NucleusBehaviour` as well as on `TransportManager` and `NetworkSystem`

`IsServerStarted` and `IsClientStarted` exist on `TransportManager` and `NetworkSystem`, but not on a `NucleusBehaviour`. Inside a script, use `IsStarted(Invoker.Server)` or `IsStarted(Invoker.Client)`.
