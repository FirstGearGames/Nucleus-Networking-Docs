---
title: "Violation reference"
---

## What a violation is

A violation is a struct implementing `IViolation`, raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected regardless of what happens next; the violation only decides the `ViolationAction` taken against the `Connection` that sent it: `Log`, `Ignore`, or `Kick`. Register a `ViolationHandler<T0>` to override the default action per type, or subscribe a `ViolationDetectedHandler<T0>` (or `IViolationObserver`) to be told about one without changing the outcome.

There are fifteen shipped violation types. Two exist only in Pro.

## Peer-behavior violations

These fire from state application, spawning, and RPC dispatch. All default to `Ignore`.

| Type | Payload | Check first |
|---|---|---|
| `UncontrolledStateChangeViolation` | `SystemId` | Whether the sender actually holds control of that `NetworkSystem` right now; control handoffs racing a state send look identical to this from the receiving side. |
| `PredictedStateChangeViolation` | `SystemId` | Whether the member is really predicted; a controller never serializes a predicted member's state, so this usually means the member's transmission setup changed without the controller rebuilding. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | A compliant sender cannot produce a collection delta with no operations, so first suspect a diverged serializer pair between the two builds, not the sender's intent. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the two peers' tick counters have actually diverged (a restart, a save/load, a manual tick reset) rather than assuming a forged ack. |
| `RetentionExceededViolation` | `AckedTick` | The peer's latency against `SystemManager.StateRetentionMilliseconds`; a single raise is ordinary heavy loss, not abuse. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether the peer's connection is dropping the recovery serve itself (packet loss eating the recovery, not just the state it was fixing) before assuming it is stalling on purpose. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | Whether the server just despawned that system id and the client's own recovery pass re-served it as a full before learning of the despawn; that path raises nothing, so a raise here means the id was never one the server despawned. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls already sent were still in flight; a well-behaved client reaches this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client actually needs to send in one drain, before assuming a flood attempt. |

## Protocol-direction violations

These fire when a client answers about a bundle or scene it was never asked about. The server drives every load and release with a reliable request; nothing in the engine sends these messages upstream, so a well-behaved client cannot produce any of the four. They default to `Kick`.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Nothing on a well-behaved client sends this upstream; if it fires, look for custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server actually requested that bundle load, or actually recorded the client holding it before an unload report; a mismatched build id here looks identical to a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Nothing on a well-behaved client sends this upstream; look for custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server actually requested that load or release; a scene handle that was never requested and never recorded held (including the unset handle) lands here too. |

## Pro-only violations

`PacketTransformRejectedViolation` and `UnauthorizedDespawnViolation` do not exist in a Free build; their events live on Pro partials of `ViolationManager`.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | No explicit default is passed at the raise site, so it takes `ViolationManager.DefaultAction`, which is `Log`, not `Ignore`. | Whether the peer is running the same `IPacketTransform` configuration; a stray packet from something that is not this game reaches the port too, so this is not evidence of an attack against a legitimate peer. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds actually agree on that prefab's removal policy; a version skew between them reaches this honestly. |

## Reading a violation you just saw

Most types default to `Ignore` or `Log` because a well-behaved peer can reach them through an ordinary race (a control handoff, a revocation, a recovery re-serve) or ordinary loss (`RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `PacketTransformRejectedViolation`). Treat a single raise of any of those as lossy-edge noise and do not kick for it.

The four protocol-direction violations are different: no engine path on a compliant client produces them at all, which is why they default to `Kick`. A raise there means either a deliberately crafted client or your own code driving the request/report path from the wrong side - check the latter first.
