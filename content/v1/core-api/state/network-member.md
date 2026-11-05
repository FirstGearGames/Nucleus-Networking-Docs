---
title: "NetworkMember"
---

`NetworkMember<T0>` is one replicated value on a `NetworkComponent`. Write access and `IsReplicated` live on its base type, `NetworkMemberBase`.

## Read the value

| Member | Description |
| --- | --- |
| `Value` | Gets or sets the current value. Changes are compared once per tick, not on every set, so assigning the same value costs nothing beyond the write itself. |
| `PreviousValue` | The value held immediately before the current one, or `default(T0)` if none has been committed. |
| `InterpolatedValue` | A smoothed value that animates from `PreviousValue` to `Value` across the member's send interval, then holds at `Value`. See below. |

## Read past values by tick

```csharp
public bool TryGetValueByTick(uint tick, out T0 value);
```

Returns true when the member still holds a value written on that tick. A member is written only on ticks it changes, so a tick between two writes has no value of its own, and an old enough tick is no longer held. An unpredicted member keeps two values; a predicted one keeps its prediction history (see [Predicted members and prediction history](../control/prediction-history-and-predicted-members.md)).

```csharp
public bool TryGetValueAtOrBeforeTick(uint tick, out T0 value);
```

Returns the newest value written at or before the tick, so it answers for ticks between writes. Returns false only when every value the member still holds is newer.

```csharp
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap);
```

Returns the value before the current one and the number of ticks between the two writes, for deriving a rate of change (a velocity from position changes, for example) instead of replicating it. Returns false, with `tickGap` set to `0`, unless both values have been written and the current one is strictly newer.

## Construct a member

```csharp
public NetworkMember(
    CompressionLevel deltaCompressionLevel = CompressionLevel.Tight,
    bool isAutomaticPoolingEnabled = false,
    MemberRole role = MemberRole.Replicate,
    float accuracy = float.NaN,
    float interpolationSnapThreshold = float.NaN,
    SendInterval sendInterval = SendInterval.Normal,
    TransmissionMode transmissionMode = TransmissionMode.Interval,
    bool isExtrapolationEnabled = true,
    byte correctionSmoothingTicks = 0,
    bool isCarriedForward = true,
    float resultTolerance = 0f);
```

Pass arguments by name at the field declaration, for example `NetworkMember<T> _x = new(role: MemberRole.Validate);`.

| Argument | Construction-time only? | Meaning |
| --- | --- | --- |
| `deltaCompressionLevel` | Yes | The compression level for this member's value. Defaults to `CompressionLevel.Tight`. |
| `isAutomaticPoolingEnabled` | Yes | Returns dropped `IPoolResettable` past values to their pool. When true, the member owns instances assigned to `Value`: rent them from `ResettableObjectPool<T0>` and never keep or change an instance after assigning it. See [What a member can hold](./member-value-types.md). |
| `role` | Yes | `MemberRole.Replicate` (default): an ordinary member; received values apply as they arrive. `MemberRole.Predict`: client state, a per-tick value the simulation reads (a move direction, a jump press), written by whoever controls the system and sent upstream by a controlling client every tick; see [Client state](../control/client-state-components.md). `MemberRole.Validate`: a predicted result that the controlling client computes ahead of the server; the server simulates the same tick, checks the client's result against its own without applying it, and orders a reconcile when they differ. Its value is only as precise as its `accuracy`. On a client that does not control the system, any role but `Replicate` is held at the server's values while a reconcile replays. See [Predicted members and prediction history](../control/prediction-history-and-predicted-members.md). |
| `accuracy` | Construction default only | The accuracy the value is sent at. `float.NaN` (default) uses the type's default accuracy. A per-call accuracy passed to `Initialize` still overrides it. Coarser values save bandwidth on quantities that tolerate more error than position. |
| `interpolationSnapThreshold` | Yes | The distance beyond which `InterpolatedValue` snaps to `Value` instead of animating. `float.NaN` (default) never snaps. Only for numeric types with a registered tolerance comparer. |
| `sendInterval` | No, see `SetSendInterval` | How often a changed member sends while `TransmissionMode.Interval` is in force. `SendInterval.Normal` sends every tick. |
| `transmissionMode` | No, see `SetTransmissionMode` | `TransmissionMode.Interval` (default) sends changes paced to `sendInterval`. `TransmissionMode.Divine` (Pro) projects motion instead, for values that move predictably. |
| `isExtrapolationEnabled` | No, see `SetExtrapolationEnabled` | Whether receivers keep the value moving through the sender's silence, in either mode. `true` (default) favors staying live when an update is lost; `false` holds still until told and favors accuracy. See [How often a member is sent](./send-pacing.md). |
| `correctionSmoothingTicks` | Yes | On a client that predicts the member, how many ticks `InterpolatedValue` takes to glide from the value shown before a reconcile to the corrected one, while `Value` is already correct. `0` (default) shows the correction at once. |
| `isCarriedForward` | Yes | For a `MemberRole.Predict` member only. `false` keeps it at its default when `NetworkComponent.TryGetLastState(false)` carries the previous tick's client state across a tick whose client state did not arrive, for a value that must not repeat, such as a jump press. Ignored for other roles. |
| `resultTolerance` | Yes | For a predicted member only: how far its predicted value may be from the server's before it counts as a misprediction, for a value a replay cannot reproduce exactly, such as one physics moves. `0` (default) compares at `accuracy`. Applies only while `SystemManager.IsResultValueSendEnabled` is on (the default); with it off, results are compared exactly. |

## InterpolatedValue animates across the send interval

`InterpolatedValue` animates each arrival across the member's send interval: one tick for a member sent every tick, the whole span for a member paced to `Short` or `Long`.

When `PreviousValue` and `Value` are farther apart than `interpolationSnapThreshold`, `InterpolatedValue` returns `Value` directly, so a teleport is not swept across.

## Change settings at runtime

Three settings can change after construction:

```csharp
public void SetSendInterval(SendInterval sendInterval);
public void SetTransmissionMode(TransmissionMode transmissionMode);
public void SetExtrapolationEnabled(bool isExtrapolationEnabled);
```

`SetReplicates(bool isReplicated)` on `NetworkMemberBase` sets whether the member is sent at all. Do not call it: Nucleus calls it for a member marked `ReplicationIgnoreAttribute`, and calling it yourself makes this peer send something different from what its peers expect to read.

## Find which client wrote a member

```csharp
public bool TryGetWritingClient(out Connections.Connection connection);
```

Defined on `NetworkMemberBase`. Returns the client whose write landed on this member on the current tick. Call it from `NetworkComponent.OnMembersChanged` under `MemberChangeDirection.Read`. It returns false:

- under `MemberChangeDirection.Write`;
- on a later tick;
- for a server write, or a local write on either peer;
- after the writing client has disconnected.

## Learn more about accuracy, pacing and write access

- [Compression, Accuracy and Per-Type Registrations](../wire/compression-accuracy-and-registrations.md)
- [How often a member is sent](./send-pacing.md)
- [Letting clients set members](./state-write-access.md)
