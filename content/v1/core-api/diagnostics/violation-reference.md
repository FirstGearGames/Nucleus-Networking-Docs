---
title: "Violation reference"
---

A violation is raised through `ViolationManager` when a peer sends something the protocol does not permit. The offending operation is always rejected. The `ViolationAction` (`Ignore` or `Kick`) only decides what happens to the `Connection` that sent it. To change an action, log a violation or watch for one, see [Violations](./violations.md).

There are twenty-two violation types. Three exist only in Pro.

## Peer-behavior violations are ignored by default

These come from state, recovery, spawning and remote calls. All default to `Ignore`.

| Type | Payload | Check first |
|---|---|---|
| `UnauthorizedMemberChangeViolation` | `SystemId` | Whether the sender controlled that `NetworkSystem` at the time. A control handoff racing a member change raises this too. |
| `PredictedMemberChangeViolation` | `SystemId` | Whether the member is really predicted. This usually means the member's transmission setup changed without the controller rebuilding. |
| `EmptyCollectionDeltaViolation` | `SystemId`, `MemberId` | Whether both builds share the same serializers. An honest sender cannot produce a collection change with no operations, so suspect a version mismatch before the sender's intent. |
| `InvalidStateAckViolation` | `AckedTick` | Whether the two peers' tick counters diverged (a restart, a save and load, a manual tick reset) before assuming a forged acknowledgment. |
| `RetentionExceededViolation` | `AckedTick` | The peer's latency against `SystemManager.StateRetentionMilliseconds`. A single raise is ordinary heavy loss. |
| `RecoveryBudgetExhaustedViolation` | `ConsecutiveSeconds`, `SecondsInLastMinute` | Raised at most once a second per Connection, for a second in which the peer was refused a repair because its `SystemManager.RecoveryBudgetFullWorlds` budget was spent. A short run is a burst of loss. A long `ConsecutiveSeconds` or a high `SecondsInLastMinute` is a peer on constant heavy loss, or one reporting losses it never had. |
| `StateLossReportFloodViolation` | `AllowedLossRepairCount` | Whether the peer just recovered from a stall, the only time an honest peer asks for several repairs at once. Repairs past the allowance are refused either way. |
| `UnexpectedStateLossReportViolation` | `Tick` | Whether a handover just changed which peer serves the sender its state. A report in flight across that change raises this honestly. The report is discarded and a warning is logged. |
| `RecoveryUnconfirmedViolation` | `UnconfirmedServeCount` | Whether the peer's connection is losing the recovery itself before assuming it is stalling on purpose. |
| `UnauthorizedSpawnViolation` | `SystemId`, `SystemBundleId`, `SystemLocalId` | A client re-sending a system the server just despawned does not raise this, so a raise means the id was never one the server despawned. |
| `RpcSendPermissionViolation` | `SystemId` | Whether permission was revoked while calls were in flight. An honest client raises this on that race alone. |
| `RpcFloodViolation` | `ReceivedRpcCount`, `AllowedRpcCount` | `RpcManager.MaximumInboundRpcsPerConnectionPerDrain` against what the client honestly sends in one drain. |

## Unreadable data kicks the client in a release build

`MalformedDataViolation` fires on the server when reading data a client sent throws. The data is not applied.

- In a release build it defaults to `Kick` and logs `Sent data the server could not read.` as a warning.
- In a debug build (`#if DEBUG`) it is raised with `Ignore` and no log line, and the exception is logged instead.
- It is never raised on a client, for data with no known sender, for a server Connection, or for a host's own client. There the exception is logged and nobody is kicked.

| Type | Payload | Check first |
|---|---|---|
| `MalformedDataViolation` | `Kind` (`State`, `FullBody`, `Recovery`, `ClientState`, `Message`, `Rpc`), `SystemId` (zero when not for a system) | Whether both builds share the same serializers and member layout for that `Kind`. A version mismatch looks exactly like a forged packet. Run a debug build to see the exception. |

## Crossing a client limit kicks the client

`ClientLimitViolation` fires on the server only, while `ServerManager.ClientLimits` has `Enabled` set, when a client crosses one of those limits. The packet is discarded unread. A size limit raises it once per refused packet. A rate limit raises it once per one-second window and discards the rest of that client's packets in the window. A host's own client is exempt. It defaults to `Kick` and logs a warning.

| Type | Payload | Check first |
|---|---|---|
| `ClientLimitViolation` | `Kind` (`PacketBytes`, `SplitPacketBytes`, `PacketsPerSecond`, `BytesPerSecond`), `MeasuredValue`, `MaximumValue`, `Channel` | `MeasuredValue` against `MaximumValue` and what the game honestly sends at its busiest. A `PacketBytes` or `SplitPacketBytes` limit too close to the largest honest packet refuses honest split packets, so set `MaximumPacketBytes` at least one transmission unit above it. |

## Protocol-direction violations

These fire when a client sends a bundle or scene request, or reports a load or release the server never asked for. An unmodified client cannot produce any of the four, so they default to `Kick`.

| Type | Payload | Check first |
|---|---|---|
| `UnexpectedBundleRequestViolation` | `BundleId` | Custom code calling the bundle-request path on the wrong side. |
| `UnsolicitedBundleReportViolation` | `BundleId`, `IsLoadReported` | Whether the server requested that bundle load, or recorded the client holding it before an unload report. A mismatched build id looks identical to a forged report. |
| `UnexpectedSceneRequestViolation` | `SceneHandle`, `IsLoadRequested` | Custom code calling the scene-request path on the wrong side. |
| `UnsolicitedSceneReportViolation` | `SceneHandle`, `IsLoadReported` | Whether the server requested that load or release. A handle never requested and never held, including the unset handle, lands here too. |

## Three violations exist only in Pro

These types, and their events on `ViolationManager`, do not exist in a Free build.

| Type | Payload | Default | Check first |
|---|---|---|---|
| `PacketTransformRejectedViolation` | `Channel`, `PayloadByteCount` | `ViolationManager.DefaultAction` (`Ignore`), and always logs a warning | Whether the peer runs the same `IPacketTransform` configuration. Stray packets from anything else that reaches the port raise this too, so it is not evidence of an attack. |
| `UnauthorizedDespawnViolation` | `SystemId` | `Ignore` | Whether the client and server builds agree on that prefab's removal policy. Version skew raises this honestly. |
| `UnsolicitedLeaseAcknowledgementViolation` | none | `Kick` | Whether the client build matches the server's. An honest client acknowledges only the predicted spawn top-ups the server sent it. |

## A clamped lag compensation view is ignored by default

`LagCompensationViewClampedViolation` exists in every edition, but only lag compensation (Pro) raises it. A lag-compensated query raises it, at most once per query, when the shooter's view is older than the rewind window or newer than anything the server has recorded. The view is clamped into range and the shot is still judged. See [The rewind window and the view clamp](../lag-compensation/the-rewind-window.md).

| Type | Payload | Default | Check first |
|---|---|---|---|
| `LagCompensationViewClampedViolation` | `ReportedTick`, `ClampedTick` | `Ignore` | The shooter's latency against `LagCompensationManager.MaximumRewindMilliseconds`. A single raise is a link that spiked. A steady stream is a very slow link, or a client asking to be judged against the oldest world it can get. |

## Judge a raise before you kick for it

An honest peer can raise the `Ignore` types through a race (a control handoff, a permission revocation, a recovery re-serve) or ordinary loss (`RetentionExceededViolation`, `RecoveryUnconfirmedViolation`, `RecoveryBudgetExhaustedViolation`, `StateLossReportFloodViolation`, `PacketTransformRejectedViolation`). Do not kick for a single raise of those.

An unmodified client never raises the four protocol-direction violations. If one fires, first check your own code for a request or report sent from the wrong side, then suspect a crafted client.
