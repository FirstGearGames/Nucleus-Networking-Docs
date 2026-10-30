---
title: "Violation reference"
---

## What a violation is

A violation is a struct implementing `IViolation`, raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected regardless of what happens next; the violation only decides the `ViolationAction` taken against the `Connection` that sent it: `Ignore` or `Kick`. Logging is separate from the action, carried on `ViolationContext<T0>.Log`, a `LogEntry` the raise site may seed and the deciding handler may change or clear. Register a `ViolationHandler<T0>` to override the default action per type, or subscribe a `ViolationDetectedHandler<T0>` (or `IViolationObserver`) to be told about one without changing the outcome.

There are twenty-two shipped violation types. Three exist only in Pro.

## Peer-behavior violations

These fire from state application and recovery, spawning, RPC dispatch, and lag compensation queries. All default to `Ignore`.

| Type | Payload | Check first |
|---|---|---|
| `UnauthorizedMemberChangeViolation` | `SystemId` | Whether the sender actually holds control of that `NetworkSystem` right now; control handoffs racing a member change look identical to this from the receiving side. |
| `PredictedMemberChangeViolation` | `SystemId` | Whether the member is really predicted; a controller never serializes a predicted member's value, so this usually means the member's transmission setup changed without the controller rebuilding. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | A compliant sender cannot produce a collection delta with no operations, so first suspect a diverged serializer pair between the two builds, not the sender's intent. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the two peers' tick counters have actually diverged (a restart, a save/load, a manual tick reset) rather than assuming a forged ack. |
| `RetentionExceededViolation` | `AckedTick`, `ConsecutiveCount` | The peer's latency against `SystemManager.StateRetentionMilliseconds`; a single raise is ordinary heavy loss, not abuse. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether the peer's connection is dropping the recovery serve itself (packet loss eating the recovery, not just the state it was fixing) before assuming it is stalling on purpose. |
| `RecoveryBudgetExhaustedViolation` | `ConsecutiveSeconds`, `SecondsInLastMinute` | The peer's packet loss. It is raised for a second in which the server refused the peer some repair because the peer had already asked for as much as it is allowed. An honest peer gets through a burst of loss without raising it, so a long run of seconds means constant heavy loss, or a peer dropping packets or reporting losses on purpose. It is raised at most once a second per Connection. |
| `StateLossReportFloodViolation` | `AllowedLossRepairCount` | Whether the peer has just come out of a stall, which lets an honest peer ask for several ticks of repair at once. The repairs past the allowance are refused either way. |
| `UnexpectedStateLossReportViolation` | `Tick` | Whether a handover changed which peer serves the sender state while the report was in flight. The report is discarded, and this type logs a warning by default. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | Whether the server just despawned that system id and the client's own recovery re-sent it before learning of the despawn; that path raises nothing, so a raise here means the id was never one the server despawned. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls already sent were still in flight; a well-behaved client reaches this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client actually needs to send in one drain, before assuming a flood attempt. |
| `LagCompensationViewClampedViolation` | `ReportedTick`, `ClampedTick` | The shooter's latency against `LagCompensationManager.MaximumRewindMilliseconds`. The shot is still judged at the clamped tick, so only a steady stream from a client on a fast link suggests it is asking to be judged against the oldest world it can. The type exists in both editions, but only Pro's lag compensation queries raise it. |

## Malformed-data violation

`MalformedDataViolation` fires on the server when reading data a client sent throws, so the data is not applied. A well-behaved client never sends data the server cannot read, so it defaults to `Kick` in a release build and logs `Sent data the server could not read.` as a warning. A debug build (`#if DEBUG`) raises it with `Ignore` and no log line, and the read site logs the exception instead, since there the usual cause is a serializer under development. It is never raised on a client, for data with no known sender, for a server Connection (a host that dialled its own address reads from one as a client), or for a host's own client; in those cases the read site logs the exception and nobody is kicked, so a host never drops its own link or its own player over a bad read.

| Type | Payload | Check first |
|---|---|---|
| `MalformedDataViolation` | `Kind` (`State`, `FullBody`, `Recovery`, `ClientState`, `Message`, `Rpc`), `SystemId` (zero when not for a system) | Whether both builds share the same serializers and member layout for that `Kind`; a version mismatch between client and server builds reads exactly like a forged packet. Run a debug build to see the exception. |

## Client-limit violation

`ClientLimitViolation` fires on the server when a client goes past one of the limits on `ServerManager.ClientLimits`, which are disabled by default, and the packet that crossed the limit is discarded unread. It defaults to `Kick` and logs a warning, since the server chose the limits and an honest client is built to stay under them. A size limit raises it once per refused packet. A rate limit raises it once per one-second window and discards the rest of that client's packets in the window. A host's own client is exempt.

| Type | Payload | Check first |
|---|---|---|
| `ClientLimitViolation` | `Kind` (`PacketBytes`, `SplitPacketBytes`, `PacketsPerSecond`, `BytesPerSecond`), `MeasuredValue`, `MaximumValue`, `Channel` | Whether the limit leaves room for what an honest client sends at its busiest. Set `ClientLimits.MaximumPacketBytes` at least one transmission unit above the largest packet a client honestly sends. |

## Protocol-direction violations

These fire when a client answers about a bundle or scene it was never asked about. The server drives every load and release with a reliable request; nothing in the engine sends these messages upstream, so a well-behaved client cannot produce any of the four. They default to `Kick`.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Nothing on a well-behaved client sends this upstream; if it fires, look for custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server actually requested that bundle load, or actually recorded the client holding it before an unload report; a mismatched build id here looks identical to a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Nothing on a well-behaved client sends this upstream; look for custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server actually requested that load or release; a scene handle that was never requested and never recorded held (including the unset handle) lands here too. |

## Pro-only violations

`PacketTransformRejectedViolation`, `UnauthorizedDespawnViolation` and `UnsolicitedLeaseAcknowledgementViolation` do not exist in a Free build, and neither do their events on `ViolationManager`.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | No explicit default is passed at the raise site, so it takes `ViolationManager.DefaultAction` (`Ignore`), and because it is the plain framework default it always logs a warning. | Whether the peer is running the same `IPacketTransform` configuration; a stray packet from something that is not this game reaches the port too, so this is not evidence of an attack against a legitimate peer. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds actually agree on that prefab's removal policy; a version skew between them reaches this honestly. |
| `UnsolicitedLeaseAcknowledgementViolation` | none | `Kick` | Whether the client build matches the server's. An honest client acknowledges only the predicted spawn top-ups the server sent it, so anything else is a modified client. |

## Reading a violation you just saw

Most types default to `Ignore` and stay silent unless something sets `Log` because a well-behaved peer can reach them through an ordinary race (a control handoff, a revocation, a recovery re-serve) or ordinary loss (`RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `PacketTransformRejectedViolation`). Treat a single raise of any of those as lossy-edge noise and do not kick for it.

The four protocol-direction violations are different: an unmodified client never raises them, and they default to `Kick`. A raise there means either a deliberately crafted client or your own code driving the request/report path from the wrong side - check the latter first.
