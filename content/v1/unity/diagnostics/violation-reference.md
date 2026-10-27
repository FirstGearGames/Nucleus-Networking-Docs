---
title: "Violation reference"
---

## What a violation is

A violation is a struct implementing `IViolation`, raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected regardless of what happens next; the violation only decides the `ViolationAction` taken against the `Connection` that sent it: `Ignore` or `Kick`. Logging is separate from the action, carried on `ViolationContext<T0>.Log`, a `LogEntry` the raise site may seed and the deciding handler may change or clear. Register a `ViolationHandler<T0>` to override the default action per type, or subscribe a `ViolationDetectedHandler<T0>` (or `IViolationObserver`) to be told about one without changing the outcome.

There are twenty-two shipped violation types. Three exist only in Pro.

## Peer-behavior violations

These fire from state application, state repair, spawning, and RPC dispatch. All default to `Ignore`.

| Type | Payload | Check first |
|---|---|---|
| `UnauthorizedMemberChangeViolation` | `SystemId` | Whether the sender actually holds control of that `NetworkSystem` right now; control handoffs racing a member change look identical to this from the receiving side. |
| `PredictedMemberChangeViolation` | `SystemId` | Whether the member is really predicted; a controller never serializes a predicted member's value, so this usually means the member's transmission setup changed without the controller rebuilding. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | A compliant sender cannot produce a collection delta with no operations, so first suspect a diverged serializer pair between the two builds, not the sender's intent. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the two peers' tick counters have actually diverged (a restart, a save/load, a manual tick reset) rather than assuming a forged ack. |
| `RetentionExceededViolation` | `AckedTick` | The peer's latency against `SystemManager.StateRetentionMilliseconds`; a single raise is ordinary heavy loss, not abuse. |
| `RecoveryBudgetExhaustedViolation` | `ConsecutiveSeconds`, `SecondsInLastMinute` | Both counts before the single raise: it fires at most once a second per Connection, only for a second in which the server refused that peer a repair because its budget under `SystemManager.RecoveryBudgetFullWorlds` was spent. A short run is a burst of loss outlasting the bank, while a long `ConsecutiveSeconds` or a high `SecondsInLastMinute` is a peer on constant heavy loss or one reporting losses it never had. |
| `StateLossReportFloodViolation` | `AllowedLossRepairCount` | Whether the peer just recovered from a stall; an honest peer names at most one lost tick per tick it applies, and only after a stall does it ask for several at once. The repairs past the allowance are refused either way. |
| `UnexpectedStateLossReportViolation` | `Tick` | Whether a handover just changed which peer serves the sender its state; a report already in flight across that change reaches this honestly. The report is discarded and a warning is logged. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether the peer's connection is dropping the recovery serve itself (packet loss eating the recovery, not just the state it was fixing) before assuming it is stalling on purpose. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | Whether the server just despawned that system id and the client's own recovery pass re-served it as a full before learning of the despawn; that path raises nothing, so a raise here means the id was never one the server despawned. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls already sent were still in flight; a well-behaved client reaches this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client actually needs to send in one drain, before assuming a flood attempt. |

## Malformed-data violation

`MalformedDataViolation` fires on the server when reading data a client sent throws, so the data is not applied. A well-behaved client never sends data the server cannot read, so it defaults to `Kick` in a release build and logs `Sent data the server could not read.` as a warning. A debug build (`#if DEBUG`) raises it with `Ignore` and no log line, and the read site logs the exception instead, since there the usual cause is a serializer under development. It is never raised on a client, for data with no known sender, for a server Connection (a host that dialled its own address reads from one as a client), or for a host's own client; in those cases the read site logs the exception and nobody is kicked, so a host never drops its own link or its own player over a bad read.

| Type | Payload | Check first |
|---|---|---|
| `MalformedDataViolation` | `Kind` (`State`, `FullBody`, `Recovery`, `ClientState`, `Message`, `Rpc`), `SystemId` (zero when not for a system) | Whether both builds share the same serializers and member layout for that `Kind`; a version mismatch between client and server builds reads exactly like a forged packet. Run a debug build to see the exception. |

## Client limit violation

`ClientLimitViolation` fires on the server only, and only while `ServerManager.ClientLimits` has `Enabled` set, when a client crosses one of those limits. The packet that crossed it is discarded unread. A size limit raises it once per refused packet; a rate limit raises it once per one-second window and discards the rest of that client's packets in the window without raising it again. A host's own client is exempt. It defaults to `Kick` and logs a warning, since the server chose the limits and an honest client is built to stay under them.

| Type | Payload | Check first |
|---|---|---|
| `ClientLimitViolation` | `Kind` (`PacketBytes`, `SplitPacketBytes`, `PacketsPerSecond`, `BytesPerSecond`), `MeasuredValue`, `MaximumValue`, `Channel` | `MeasuredValue` against `MaximumValue` and what the game honestly sends at its busiest. A `PacketBytes` or `SplitPacketBytes` limit set too close to the largest honest packet refuses honest split packets, so set `MaximumPacketBytes` at least one transmission unit above it. |

## Protocol-direction violations

These fire when a client answers about a bundle or scene it was never asked about. The server drives every load and release with a reliable request; nothing in the engine sends these messages upstream, so a well-behaved client cannot produce any of the four. They default to `Kick`.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Nothing on a well-behaved client sends this upstream; if it fires, look for custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server actually requested that bundle load, or actually recorded the client holding it before an unload report; a mismatched build id here looks identical to a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Nothing on a well-behaved client sends this upstream; look for custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server actually requested that load or release; a scene handle that was never requested and never recorded held (including the unset handle) lands here too. |

## Pro-only violations

`PacketTransformRejectedViolation`, `UnauthorizedDespawnViolation` and `UnsolicitedLeaseAcknowledgementViolation` do not exist in a Free build; their events live on Pro partials of `ViolationManager`.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | No explicit default is passed at the raise site, so it takes `ViolationManager.DefaultAction` (`Ignore`), and because it is the plain framework default it always logs a warning. | Whether the peer is running the same `IPacketTransform` configuration; a stray packet from something that is not this game reaches the port too, so this is not evidence of an attack against a legitimate peer. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds actually agree on that prefab's removal policy; a version skew between them reaches this honestly. |
| `UnsolicitedLeaseAcknowledgementViolation` | none | `Kick` | Whether the client build matches the server's. An honest client acknowledges only the predicted spawn top-ups the server sent it, so anything else is a modified client. |

## Lag compensation violation

`LagCompensationViewClampedViolation` exists in every edition, but only lag compensation (Pro) raises it: a lag-compensated query raises it, at most once per query, when the shooter's view is older than the rewind window or newer than anything the server has recorded. The view is clamped into range and the shot is still judged. See [UnityLagCompensationManager](../lag-compensation/unity-lag-compensation-manager.md#the-view-clamp-violation).

| Type | Payload | Default | Check first |
|---|---|---|---|
| `LagCompensationViewClampedViolation` | `ReportedTick`, `ClampedTick` | `Ignore` | The shooter's latency against `LagCompensationManager.MaximumRewindMilliseconds`; a single raise is a link that spiked, while a steady stream is either a very slow link or a client asking to be judged against the oldest world it can get. |

## Reading a violation you just saw

Most types default to `Ignore` and stay silent unless something sets `Log` because a well-behaved peer can reach them through an ordinary race (a control handoff, a revocation, a recovery re-serve) or ordinary loss (`RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `RecoveryBudgetExhaustedViolation`, `StateLossReportFloodViolation`, `PacketTransformRejectedViolation`). Treat a single raise of any of those as lossy-edge noise and do not kick for it.

The four protocol-direction violations are different: no engine path on a compliant client produces them at all, which is why they default to `Kick`. A raise there means either a deliberately crafted client or your own code driving the request/report path from the wrong side - check the latter first.
