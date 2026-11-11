---
title: "Configuration reference"
---

> **Using Unity?** See [The Nucleus manager components](../unity/core/unity-manager-components.md) for setting the same values from the inspector.

Every setting is a public field or property on the manager that owns it. Assign it after `new CoreManager()` returns. There is no engine-wide configuration object.

## Two values cannot change after start-up

Every other setting can change at any time. These two cannot:

- **Tick rate.** `NetworkLoopManager.TickRate` is get-only, fixed by the `tickRate` argument passed when the loop starts. `DefaultTickRate` is 30. A rate below `MinimumTickRate` (5) or above `MaximumTickRate` (128) is clamped into range and logged.
- **`ServerConfiguration.MaximumConnections`** is read-only to your code. Change it with `transport.SetMaximumConnections(uint)`; Synapse applies the new cap the next time the server starts.

The step provider can change: `NetworkLoopManager.UseNetworkLoopStepProvider(INetworkLoopStepProvider)` swaps it at runtime, stopping and returning the previous one. To use your own provider from the start, pass it to the `CoreManager` constructor instead, because after construction the default provider is already stepping the loop from the thread pool.

## Only the tick rate must match between peers

Every other setting is local: a server and its clients can run different `StateInterpolation`, `EvaluationCadenceTicks`, timeout or retention values. A server and client with different `TickRate` values break replication and interpolation.

## SystemManager

| Setting | Default | Notes |
|---|---|---|
| `StateInterpolation` | 0 | Capped at `MaximumStateInterpolation` (7) when applied. |
| `GlobalRedundancy` | 0 | Only usable when the transport's default channel is unreliable. Capped at `StateInterpolation` on the server's sends. |
| `ClientRedundancy` | 3 | Extra resends a pure client adds to everything it sends upstream, on top of `GlobalRedundancy`. Not capped. |
| `StateRetentionMilliseconds` | 1000 | Capped at `MaximumStateRetentionMilliseconds` (2000). |
| `PartialStateApplyEnabled` | true | A tick that loses some of its packets applies the ones that arrived. Off, the whole tick is discarded and recovered. The receiver's choice alone. |
| `PredictionHistoryTicks` | `UnsetPredictionHistoryTicks` (0) | How many ticks of history `Predict` and `Validate` members keep. Unset, every client keeps `DefaultPredictionHistoryTicks` (64) and the server keeps two. |
| `MaximumReplayTicks` | `UnsetMaximumReplayTicks` (0) | Most ticks a reconcile replays; a longer one lands the server's values at its start tick without replaying. 0 sets no limit. |
| `ReplayHoldRadius` | `UnsetReplayHoldRadius` (0) | Client: only systems it does not control within this distance of a restored system are held during a replay. 0 holds every one. |
| `ResultValueSendEnabled` | true | Read on the controller. On, a server that finds a `Validate` result different reports which members differed and both values through `NetworkSystem.ResultMismatched`, and each member's `resultTolerance` applies. Off saves bandwidth every tick; the report then shows only that a mismatch happened, and results are compared exactly. |
| `DefaultControllerRetentionPolicy` | `ControllerRetentionPolicy.Release` | A system's own override wins, then its group's, then this. |
| `ControllerRetentionSeconds` | 120 (`DefaultControllerRetentionSeconds`) | `UnlimitedControllerRetentionSeconds` (0) removes the limit. |
| `MaximumRetainedControllerRecords` | 64 (`DefaultMaximumRetainedControllerRecords`) | |
| `HostMigrationEnabled` | false | |

## InterestManager

| Setting | Default | Notes |
|---|---|---|
| `EvaluationCadenceTicks` | 5 (`DefaultEvaluationCadenceTicks`) | How often, in ticks, a system's interest is re-evaluated per connection. |
| `MaximumControlledInterestObjects` | 1 (`DefaultMaximumControlledInterestObjects`) | `UnlimitedControlledInterestObjects` (0) measures against every controlled object. |

## SceneManager

| Setting | Default | Notes |
|---|---|---|
| `JoinPlacement` | `JoinScenePlacement.EveryOpenScene` | Where a newly authenticated client is placed. |
| `LoadRequestTimeoutSeconds` | 180 | 0 or less disables the timeout. |
| `AutomaticRequestOnBlockedSpawnEnabled` | false | |
| `SceneCarryFailure` | `SceneCarryFailureAction.SurrenderControl` | The world-wide answer. Override it per object with `NetworkSystem.SceneCarryFailureOverride`, or per case with a registered `ISceneCarryFailureResolver`. |

## RpcManager

| Setting | Default | Notes |
|---|---|---|
| `MaximumInboundRpcsPerConnectionPerDrain` | 64 (`DefaultMaximumInboundRpcsPerConnectionPerDrain`) | `UnsetMaximumInboundRpcsPerConnectionPerDrain` (0) removes the bound. |

## ServerManager

| Setting | Default | Notes |
|---|---|---|
| `AuthenticationTimeoutSeconds` | 30 | A connecting client that never authenticates is disconnected after this. `UnsetAuthenticationTimeout` (0) disables the timeout. |
| `KickTimeoutMilliseconds` | 500 | How long a kicked or refused client's link may stay open after the kick before it is closed. Overloads taking `timeoutMilliseconds` override it for one kick. |
| `ObjectPacingEnabled` | `true` | Pro only. Off, every whole object is sent on the tick it is owed. |
| `MaximumObjectKilobytesPerTick` | 50 (`DefaultMaximumObjectKilobytesPerTick`) | Pro only. The most kilobytes (1 kB is 1,024 bytes) of whole objects one client is sent per tick: new objects, and objects sent again whole after packet loss. The rest follow on later ticks. Ordinary updates to objects a client already holds are not paced. A value below 1 (`MinimumObjectKilobytesPerTick`) is read as 1, so this setting cannot switch pacing off. |

## ClientManager

| Setting | Default | Notes |
|---|---|---|
| `DisconnectResetMode` | `DisconnectResetMode.ClearReceivedWorld` | What the client keeps of its received world on disconnect. |

## ViolationManager

| Setting | Default | Notes |
|---|---|---|
| `DefaultAction` | `ViolationAction.Ignore` | A constant, used only for a violation type raised with no default of its own and no handler. `PacketTransformRejectedViolation` (Pro) is the only such type, and that raise always logs a warning. Every other type has its own default, mostly `Ignore`. |

## TransportManager

| Setting | Default | Notes |
|---|---|---|
| `DefaultChannel` | `Channel.Unreliable` | |
| `HostLoopbackDelivery` | `HostLoopbackDelivery.Immediate` | Settable only to `Immediate`; any other value is refused and logged. |
| `RoundTripTimeIntervalMilliseconds` | 1000 (`DefaultRoundTripTimeIntervalMilliseconds`) | 0 disables round-trip time measurement. |

## BundleManager

Pro only.

| Setting | Default | Notes |
|---|---|---|
| `AutomaticRequestOnBlockedSpawnEnabled` | true | A blocked spawn also asks the client for the bundle it needs, so content loads on demand. |

## Transports carry their own settings

`Transport.Configuration` and `Transport.ServerConfiguration` hold settings for a transport rather than a manager.

**`Configuration`**

| Field | Default | Notes |
|---|---|---|
| `Port` | 0 | |
| `MaximumTransmissionUnit` | 1200 | Packets longer than this are split into multiple packets. |
| `ConnectingTimeoutSeconds` | 10 | How long a client waits for the server to answer its connect. Zero falls back to `ConnectedTimeoutSeconds`. |
| `ConnectedTimeoutSeconds` | 15 | Times out a connection that has received nothing within this window. The smallest value applied is one second. |

**`ServerConfiguration`**

| Field | Default | Notes |
|---|---|---|
| `MaximumConnections` | `UnsetMaximumConnections` (0) | 0 accepts any number. Set it with `transport.SetMaximumConnections(uint)`; Synapse applies it at the next server start. |
