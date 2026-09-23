---
title: "Configuration reference"
---

There is no engine-wide configuration object. Every setting is a public field or property on the manager that owns it, assigned after `new CoreManager()` returns. This page lists them by manager, with defaults and whether each can still change after start-up.

> **Using Unity?** See [The Nucleus manager components](../unity/core/unity-manager-components.md) for setting the same values from the inspector.

## Construction-only values

Most settings can change at any time. Two cannot, because the engine builds fixed-size structures around them at construction:

- **Tick rate.** `NetworkLoopManager.TickRate` is get-only, fixed by the `tickRate` argument passed when the loop starts. `DefaultTickRate` is 30. A requested rate below `MinimumTickRate` (5) or above `MaximumTickRate` (128) is clamped into range and logged, not rejected.
- **`ServerConfiguration.MaximumConnections`** is a readonly field on the transport's server configuration struct, set once when that struct is constructed.

The step provider is not on this list. `NetworkLoopManager.UseNetworkLoopStepProvider(INetworkLoopStepProvider)` swaps it at runtime, stopping the previous provider and returning it. To use your own provider from the start, pass it to the `CoreManager` constructor instead: swapped in after construction, it replaces a default provider that has already been stepping the loop from the thread pool.

## SystemManager

| Setting | Default | Notes |
|---|---|---|
| `StateInterpolation` | 0 | Capped at `MaximumStateInterpolation` (7) when applied. |
| `Redundancy` | 0 | Only usable when the transport's default channel is unreliable. |
| `StateRetentionMilliseconds` | 1000 | Capped at `MaximumStateRetentionMilliseconds` (2000). |
| `PredictionHistoryTicks` | `UnsetPredictionHistoryTicks` (0) | Leaves the default history ring in place when unset. |
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

## ClientManager

| Setting | Default | Notes |
|---|---|---|
| `DisconnectResetMode` | `DisconnectResetMode.ClearReceivedWorld` | What the client keeps of its received world on disconnect. |
| `DefaultServerNoticeAction` | `ServerNoticeAction.Log` | Used when no handler is registered for a server notice. |

## ViolationManager

| Setting | Default | Notes |
|---|---|---|
| `DefaultAction` | `ViolationAction.Log` | A constant. Used only when a violation type is raised with no default of its own and no handler is registered; `PacketTransformRejectedViolation` (Pro) is the one such type. Every other type carries its own default, mostly `Ignore`. |

## TransportManager

| Setting | Default | Notes |
|---|---|---|
| `DefaultChannel` | `Channel.Unreliable` | |
| `HostLoopbackDelivery` | `HostLoopbackDelivery.Immediate` | Settable only to `Immediate`; any other value is refused and logged. The alternative exists only for the engine's own tests. |
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
| `ConnectingTimeoutSeconds` | 10 | Synapse does not apply this yet. An unanswered connect times out after `ConnectedTimeoutSeconds` instead. |
| `ConnectedTimeoutSeconds` | 15 | Least applied value is one second. Times out a connection that has received no remote data within this window. |

**`ServerConfiguration`**

| Field | Default | Notes |
|---|---|---|
| `MaximumConnections` | `UnsetMaximumConnections` (0) | Readonly; set only when the struct is constructed. |

## Local vs. shared values

Most manager settings are purely local: a server and its clients can each run different `StateInterpolation`, `EvaluationCadenceTicks`, timeout, or retention values without breaking the connection, because each peer only governs its own side of the exchange.

Tick rate is the exception that must match. A server and client running different `TickRate` values are ticking at different real-world speeds, which the replication and interpolation built on top of the tick assume does not happen.

## Not a setting

`RemoteTimeoutType` is declared in `Nucleus.Managers.Core` but nothing in the engine reads it. Setting it has no effect.
