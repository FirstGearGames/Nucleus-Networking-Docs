---
title: "Violation reference"
---

A violation is a struct implementing `IViolation`, raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected. The violation only decides the `ViolationAction` taken against the sending `Connection`: `Ignore` or `Kick`.

- Logging is separate from the action: `ViolationContext<T0>.Log` is a `LogEntry` the raise site may seed and a deciding handler may change or clear.
- Register a `ViolationHandler<T0>` to override a type's default action.
- Subscribe a `ViolationDetectedHandler<T0>`, or an `IViolationObserver`, to be told about a violation without changing the outcome.

There are twenty-two shipped violation types. Three exist only in Pro.

## Read a violation you just saw

Most types default to `Ignore` and stay silent unless something sets `Log`, because an honest peer can reach them through an ordinary race (a control handoff, a revocation, a recovery re-send) or ordinary loss (`RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `PacketTransformRejectedViolation`). Do not kick for a single raise of those.

The four protocol-direction violations default to `Kick`, because an unmodified client never raises them. A raise means either a crafted client or your own code driving the request or report path from the wrong side. Check your own code first.

## Peer-behavior violations default to Ignore

These come from state, spawning, remote calls and lag compensation.

| Type | Payload | Check first |
|---|---|---|
| `UnauthorizedMemberChangeViolation` | `SystemId` | Whether the sender really controls that `NetworkSystem` right now; a control handoff racing a member change looks the same. |
| `PredictedMemberChangeViolation` | `SystemId` | Whether the member is really predicted. This usually means the member's transmission setup changed without the controller being rebuilt. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | Whether the two builds' serializers differ; a compliant sender cannot produce an empty collection change. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the two peers' tick counters really diverged (a restart, a save and load, a manual tick reset) before assuming a forgery. |
| `RetentionExceededViolation` | `AckedTick`, `ConsecutiveCount` | The peer's latency against `SystemManager.StateRetentionMilliseconds`. A single raise is ordinary heavy loss. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether packet loss is eating the peer's recovery itself before assuming it is stalling on purpose. |
| `RecoveryBudgetExhaustedViolation` | `ConsecutiveSeconds`, `SecondsInLastMinute` | The peer's packet loss. It is raised, at most once a second per `Connection`, for each second the server refused the peer some repair because it had already asked for its allowance. An honest peer gets through a burst of loss without it, so a long run means constant heavy loss, or a peer dropping packets or reporting losses on purpose. |
| `StateLossReportFloodViolation` | `AllowedLossRepairCount` | Whether the peer just came out of a stall, which lets an honest peer ask for several ticks of repair at once. Repairs past the allowance are refused either way. |
| `UnexpectedStateLossReportViolation` | `Tick` | Whether a handover changed which peer serves the sender while the report was in flight. The report is discarded, and this type logs a warning by default. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | Whether that id was ever one the server despawned. A client re-sending a spawn the server just despawned raises nothing, so a raise means it was not. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls were still in flight; an honest client reaches this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client really needs to send in one drain. |
| `LagCompensationViewClampedViolation` | `ReportedTick`, `ClampedTick` | The shooter's latency against `LagCompensationManager.MaximumRewindMilliseconds`. The shot is still judged at the clamped tick, so only a steady stream from a client on a fast link suggests abuse. The type exists in both editions, but only Pro raises it. |

## Unreadable client data raises MalformedDataViolation

`MalformedDataViolation` fires on the server when reading data a client sent throws, and the data is not applied.

- In a release build it defaults to `Kick` and logs `Sent data the server could not read.` as a warning.
- In a debug build (`#if DEBUG`) it is `Ignore` with no log line, and the read site logs the exception instead.
- It is never raised on a client, for data with no known sender, for a server `Connection` (a host that dialled its own address reads from one as a client), or for a host's own client. There the read site logs the exception and nobody is kicked.

| Type | Payload | Check first |
|---|---|---|
| `MalformedDataViolation` | `Kind` (`State`, `FullBody`, `Recovery`, `ClientState`, `Message`, `Rpc`), `SystemId` (zero when not for a system) | Whether both builds share the same serializers and members for that `Kind`; mismatched builds look exactly like a forged packet. Run a debug build to see the exception. |

## Exceeding a client limit raises ClientLimitViolation

`ClientLimitViolation` fires on the server when a client exceeds one of the limits on `ServerManager.ClientLimits`, which are off by default. The packet that crossed the limit is discarded unread. It defaults to `Kick` and logs a warning. A size limit raises it once per refused packet; a rate limit raises it once per one-second window and discards the rest of that client's packets in the window. A host's own client is exempt.

| Type | Payload | Check first |
|---|---|---|
| `ClientLimitViolation` | `Kind` (`PacketBytes`, `SplitPacketBytes`, `PacketsPerSecond`, `BytesPerSecond`), `MeasuredValue`, `MaximumValue`, `Channel` | Whether the limit leaves room for what an honest client sends at its busiest. Set `ClientLimits.MaximumPacketBytes` at least one transmission unit above the largest packet a client honestly sends. |

## Protocol-direction violations default to Kick

These fire when a client answers about a bundle or scene it was never asked about.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server really requested that bundle load, or recorded the client holding it before an unload report. A mismatched build looks the same as a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server really requested that load or release. A handle never requested or recorded held, including the unset handle, lands here too. |

## Three violations exist only in Pro

These types, and their events on `ViolationManager`, do not exist in a Free build.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | `ViolationManager.DefaultAction` (`Ignore`), always with a logged warning. | Whether the peer runs the same `IPacketTransform` configuration. Stray packets from anything else reach the port too, so this is not evidence of an attack. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds agree on that prefab's removal policy; mismatched builds reach this honestly. |
| `UnsolicitedLeaseAcknowledgementViolation` | none | `Kick` | Whether the client build matches the server's. An honest client acknowledges only the predicted spawn top-ups the server sent it. |
