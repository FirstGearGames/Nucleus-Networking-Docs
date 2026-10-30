---
title: "Configuration reference"
---

There is no engine-wide configuration object. Every setting is a public field or property on the manager that owns it, assigned after `new CoreManager()` returns. This page lists them by manager, with defaults and whether each can still change after start-up.

> **Using Unity?** See [The Nucleus manager components](../unity/core/unity-manager-components.md) for setting the same values from the inspector.

## Construction-only values

Most settings can change at any time. Two are exceptions:

- **Tick rate.** `NetworkLoopManager.TickRate` is get-only, fixed by the `tickRate` argument passed when the loop starts. `DefaultTickRate` is 30. A requested rate below `MinimumTickRate` (5) or above `MaximumTickRate` (128) is clamped into range and logged, not rejected.
- **`ServerConfiguration.MaximumConnections`** is read-only to your code. Change it with `transport.SetMaximumConnections(uint)`, and Synapse applies the new cap the next time the server starts.

The step provider is not on this list. `NetworkLoopManager.UseNetworkLoopStepProvider(INetworkLoopStepProvider)` swaps it at runtime, stopping the previous provider and returning it. To use your own provider from the start, pass it to the `CoreManager` constructor instead: swapped in after construction, it replaces a default provider that has already been stepping the loop from the thread pool.

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
| `IsResultValueSendEnabled` | true | Read on the controller: sends `Validate` result values beside the hash so `NetworkSystem.ResultMismatched` can name what differed. Off keeps the hash alone. |
| `DefaultControllerRetentionPolicy` | `ControllerRetentionPolicy.Release` | Resolved most specific first: a system's own override, then its group's, then this. |
| `ControllerRetentionSeconds` | 120 (`DefaultControllerRetentionSeconds`) | `UnlimitedControllerRetentionSeconds` (0) removes the limit. |
| `MaximumRetainedControllerRecords` | 64 (`DefaultMaximumRetainedControllerRecords`) | |
| `HostMigrationEnabled` | false | |

## InterestManager

| Setting | Default | Notes |
|---|---|---|
| `EvaluationCadenceTicks` | 5 (`DefaultEvaluationCadenceTicks`) | How often, in ticks, a system's interest is re-evaluated per connection. |
| `MaximumControlledInterestObjects` | 1 (`DefaultMaximumControlledInterestObjects`) | `UnlimitedControlledInterestObjects` (0) measures against every controlled object. |
| `MaximumSpawnsPerTick` | 500 (`DefaultMaximumSpawnsPerTick`) | Pro only. Caps how many spawns a peer is admitted per tick; the rest queue and drain over following ticks. |

## SceneManager

| Setting | Default | Notes |
|---|---|---|
| `JoinPlacement` | `JoinScenePlacement.EveryOpenScene` | Where a newly authenticated client is placed. |
| `LoadRequestTimeoutSeconds` | 180 | A value of 0 or less disables the timeout. |
| `AutomaticRequestOnBlockedSpawnEnabled` | false | |
| `SceneCarryFailure` | `SceneCarryFailureAction.SurrenderControl` | The world-wide answer; overridable per object via `NetworkSystem.SceneCarryFailureOverride` and per case via a registered `ISceneCarryFailureResolver`. |

## RpcManager

| Setting | Default | Notes |
|---|---|---|
| `MaximumInboundRpcsPerConnectionPerDrain` | 64 (`DefaultMaximumInboundRpcsPerConnectionPerDrain`) | `UnsetMaximumInboundRpcsPerConnectionPerDrain` (0) removes the bound. |

## ServerManager

| Setting | Default | Notes |
|---|---|---|
| `AuthenticationTimeoutSeconds` | 30 | `UnsetAuthenticationTimeout` (0) disables the timeout; a connecting client that never authenticates is disconnected after this. |
| `KickTimeoutMilliseconds` | 500 | How long a kicked or refused client's link may stay open after its kick before it is closed outright. Overloads that take a `timeoutMilliseconds` override it for one kick. |

## ClientManager

| Setting | Default | Notes |
|---|---|---|
| `DisconnectResetMode` | `DisconnectResetMode.ClearReceivedWorld` | What the client keeps of its received world on disconnect. |

## ViolationManager

| Setting | Default | Notes |
|---|---|---|
| `DefaultAction` | `ViolationAction.Ignore` | A constant. Used only when a violation type is raised with no default of its own and no handler is registered; `PacketTransformRejectedViolation` (Pro) is the one such type, and that raise always logs a warning. Every other type carries its own default, mostly `Ignore`. |

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
| `AutomaticRequestOnBlockedSpawnEnabled` | true | A blocked spawn also asks the client for the bundle it needs, so content hotloads on demand. |

## Per-transport structs

`Transport.Configuration` and `Transport.ServerConfiguration` hold settings specific to a transport rather than to a manager.

**`Configuration`**

| Field | Default | Notes |
|---|---|---|
| `Port` | 0 | |
| `MaximumTransmissionUnit` | 1200 | Packets longer than this are split into multiple packets. |
| `ConnectingTimeoutSeconds` | 10 | How long a client waits for the server to answer its connect. Zero falls back to `ConnectedTimeoutSeconds`. |
| `ConnectedTimeoutSeconds` | 15 | Least applied value is one second. Times out a connection that has received no remote data within this window. |

**`ServerConfiguration`**

| Field | Default | Notes |
|---|---|---|
| `MaximumConnections` | `UnsetMaximumConnections` (0) | Accepts any number at 0. Set it with `transport.SetMaximumConnections(uint)`; Synapse applies it at the next server start. |

## Local vs. shared values

Most manager settings are purely local: a server and its clients can each run different `StateInterpolation`, `EvaluationCadenceTicks`, timeout, or retention values without breaking the connection, because each peer only governs its own side of the exchange.

Tick rate is the exception that must match. A server and client running different `TickRate` values are ticking at different real-world speeds, which the replication and interpolation built on top of the tick assume does not happen.
