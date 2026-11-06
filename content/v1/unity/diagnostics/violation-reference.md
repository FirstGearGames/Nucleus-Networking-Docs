---
title: "Violation reference"
---

A violation is raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected. The violation only decides the `ViolationAction` taken against the sending `Connection`: `Ignore` or `Kick`. Logging is separate, set through `ViolationContext<T0>.Log`. To change or watch the outcome, see [Handling violations in Unity](./handling-violations-in-unity.md).

There are twenty-two violation types.

## Peer-behavior violations default to Ignore

| Type | Payload | Check first |
|---|---|---|
| `UnauthorizedMemberChangeViolation` | `SystemId` | Whether the sender controls that `NetworkSystem` right now. A control handoff racing a member change looks the same. |
| `PredictedMemberChangeViolation` | `SystemId` | Whether the member is really predicted. A controller never sends a predicted member's value, so the member's transmission setup probably changed without the controller being rebuilt. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | A compliant sender cannot produce a collection delta with no operations, so suspect two builds whose serializers differ before suspecting the sender. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the peers' tick counters diverged (a restart, a save and load, a manual tick reset) before assuming a forged acknowledgment. |
| `RetentionExceededViolation` | `AckedTick` | The peer's latency against `SystemManager.StateRetentionMilliseconds`. A single raise is ordinary heavy loss. |
| `RecoveryBudgetExhaustedViolation` | `ConsecutiveSeconds`, `SecondsInLastMinute` | Both counts. It is raised at most once a second per Connection, for a second in which the server refused that peer a repair because its budget under `SystemManager.RecoveryBudgetFullWorlds` was spent. A short run is a burst of loss; a long `ConsecutiveSeconds` or a high `SecondsInLastMinute` is a peer on constant heavy loss, or one reporting losses it never had. |
| `StateLossReportFloodViolation` | `AllowedLossRepairCount` | Whether the peer just recovered from a stall, the only time an honest peer reaches this. Repairs past the allowance are refused either way. |
| `UnexpectedStateLossReportViolation` | `Tick` | Whether a handover just changed which peer serves the sender its state. A report already in flight across that change reaches this honestly. The report is discarded and a warning is logged. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether packet loss is eating the recovery itself before assuming the peer is stalling on purpose. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | A client still sending state for an object the server just despawned does not raise this, so a raise means the id was never one the server despawned. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls were in flight. A well-behaved client reaches this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client needs to send in one drain. |

## Unreadable client data raises MalformedDataViolation

`MalformedDataViolation` is raised on the server when reading data a client sent throws, so the data is not applied.

- In a release build it defaults to `Kick` and logs `Sent data the server could not read.` as a warning.
- In a debug build (`#if DEBUG`) it is `Ignore` with no line, and the exception is logged instead.
- It is never raised on a client, for data with no known sender, for a server Connection (a host that dialled its own address reads from one as a client), or for a host's own client. There the exception is logged and nobody is kicked.

| Type | Payload | Check first |
|---|---|---|
| `MalformedDataViolation` | `Kind` (`State`, `FullBody`, `Recovery`, `ClientState`, `Message`, `Rpc`), `SystemId` (zero when not for a system) | Whether both builds share the same serializers and member layout for that `Kind`. A client and server built from different versions look exactly like a forged packet. Run a debug build to see the exception. |

## A client over its limits raises ClientLimitViolation

`ClientLimitViolation` is raised on the server only, while `ServerManager.ClientLimits` has `Enabled` set, when a client crosses a limit. The packet that crossed it is discarded unread. A size limit raises it once per refused packet. A rate limit raises it once per one-second window and silently discards the rest of that client's packets in the window. A host's own client is exempt. It defaults to `Kick` and logs a warning.

| Type | Payload | Check first |
|---|---|---|
| `ClientLimitViolation` | `Kind` (`PacketBytes`, `SplitPacketBytes`, `PacketsPerSecond`, `BytesPerSecond`), `MeasuredValue`, `MaximumValue`, `Channel` | `MeasuredValue` against `MaximumValue` and what the game honestly sends at its busiest. Set `MaximumPacketBytes` at least one transmission unit above the largest honest packet, or honest split packets are refused. |

## Protocol-direction violations default to Kick

The server drives every bundle and scene load and release. Nothing in the engine sends these upstream, so an unmodified client never raises them. When one fires, first check your own code for a request or report sent from the wrong side.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server requested that bundle load, or recorded the client holding it before an unload report. A mismatched build id looks the same as a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server requested that load or release. A handle never requested and never recorded as held, including the unset handle, lands here too. |

## Three violations exist only in Pro

`PacketTransformRejectedViolation`, `UnauthorizedDespawnViolation` and `UnsolicitedLeaseAcknowledgementViolation`, and their events on `ViolationManager`, do not exist in a Free build.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | `ViolationManager.DefaultAction` (`Ignore`), and always logs a warning | Whether the peer runs the same `IPacketTransform` configuration. Stray packets from something other than this game reach the port too, so this alone is not evidence of an attack. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds agree on that prefab's removal policy. Version skew reaches this honestly. |
| `UnsolicitedLeaseAcknowledgementViolation` | none | `Kick` | Whether the client build matches the server's. An honest client acknowledges only the predicted spawn top-ups the server sent it. |

## Lag compensation raises LagCompensationViewClampedViolation

`LagCompensationViewClampedViolation` exists in every edition, but only lag compensation (Pro) raises it, at most once per query, when the shooter's view is older than the rewind window or newer than anything the server has recorded. The view is clamped into range and the shot is still judged. See [UnityLagCompensationManager](../lag-compensation/unity-lag-compensation-manager.md#the-view-clamp-violation).

| Type | Payload | Default | Check first |
|---|---|---|---|
| `LagCompensationViewClampedViolation` | `ReportedTick`, `ClampedTick` | `Ignore` | The shooter's latency against `LagCompensationManager.MaximumRewindMilliseconds`. A single raise is a link that spiked; a steady stream is a very slow link, or a client asking to be judged against the oldest world it can get. |

## Do not kick for a single loss-related raise

Most types default to `Ignore` because an honest peer can reach them through a race (a control handoff, a revocation, a recovery re-serve) or through loss: `RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `RecoveryBudgetExhaustedViolation`, `StateLossReportFloodViolation` and `PacketTransformRejectedViolation`. Treat a single raise of these as noise.
