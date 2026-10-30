---
title: "NetworkMember"
---

## NetworkMember is the scalar building block of a component

`NetworkMember<T0>` is the scalar building block a generated `NetworkComponent` declares its replicated fields with. It keeps recent past values for `T0`, exposes the current, previous, and interpolated views of that value, and owns the construction-time settings for its compression, pacing, and transmission mode. The non-generic behaviour (write access, `IsReplicated`) lives on its base type, `NetworkMemberBase`.

## Reading the value

| Member | Description |
| --- | --- |
| `Value` | Gets or sets the current value. Equality against the prior committed value is checked once per tick, not on every set, so a noop assignment costs nothing beyond the write itself. |
| `PreviousValue` | The value held immediately before the current one. Returns `default(T0)` if no prior value has been committed. |
| `InterpolatedValue` | A smoothed value that animates from `PreviousValue` to `Value` across the member's own send interval, then holds at `Value`. See Interpolation below. |

## Reading past values by tick

`Value` and `PreviousValue` cover the common case. For a caller that needs a specific tick, or needs to derive a rate of change, past values are also queryable directly:

```csharp
public bool TryGetValueByTick(uint tick, out T0 value);
```

Returns true and outputs the value when the member still holds a value written on the supplied tick. A member is written only on the ticks it changes, so a tick between two writes has no value of its own, and an old enough tick is no longer held. An unpredicted member keeps two values; a predicted one keeps the prediction history (see [Predicted members and prediction history](../control/prediction-history-and-predicted-members.md)).

```csharp
public bool TryGetValueAtOrBeforeTick(uint tick, out T0 value);
```

Returns the value the member held as of the supplied tick: the newest value written at or before it. This answers for the ticks between two writes, and is false only when every value the member still holds is newer.

```csharp
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap);
```

Returns the value committed before the current one, together with the number of ticks between the two writes. Intended for an owner that derives a rate of change (a velocity from position changes, for example) instead of replicating it directly. Returns false, with `tickGap` set to `0`, unless both values have been written and the current one is strictly newer.

## Construction

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

All eleven arguments are supplied by name at the field declaration, e.g. `NetworkMember<T> _x = new(role: MemberRole.Validate);`.

| Argument | Construction-time only? | Meaning |
| --- | --- | --- |
| `deltaCompressionLevel` | Yes | The compression level for this member's value. Defaults to `CompressionLevel.Tight`. |
| `isAutomaticPoolingEnabled` | Yes | Returns dropped `IPoolResettable` past values to their pool through `NetworkTypePoolReturner<T0>`. When true, the member owns instances assigned to `Value`: rent them from `ResettableObjectPool<T0>` and never retain or mutate an instance after assigning it. |
| `role` | Yes | What the member is for. `MemberRole.Replicate` (the default) makes it an ordinary member: inbound values apply as they arrive. `MemberRole.Predict` makes it client state, a per-tick value the simulation reads (a move direction, a jump press), written by whoever controls the system and sent upstream by a controlling client every tick; see [Client state](../control/client-state-components.md). `MemberRole.Validate` makes it a predicted result: the controlling client computes it ahead of the server and sends it upstream only for the server to check, never to apply, the server simulates the same tick and orders a reconcile when its result differs, and its value is rounded to its accuracy on every write. On a client that does not control the system, any role other than `Replicate` is held at the server's values while a reconcile replays. See [Predicted members and prediction history](../control/prediction-history-and-predicted-members.md). |
| `accuracy` | Construction default only | The accuracy the member's value is sent at. `float.NaN` (the default) defers to the per-type default accuracy. A per-call accuracy passed to `Initialize` still overrides it, and coarser values trade precision for bandwidth on quantities that tolerate more error than position. |
| `interpolationSnapThreshold` | Yes | The distance beyond which `InterpolatedValue` snaps to `Value` instead of animating from `PreviousValue`. `float.NaN` (the default) disables snapping. Usable only on numeric types with a registered tolerance comparer. |
| `sendInterval` | No, see `SetSendInterval` | The span between sends while `TransmissionMode.Interval` is in force. `SendInterval.Normal` sends every tick. |
| `transmissionMode` | No, see `SetTransmissionMode` | The transmission strategy: `TransmissionMode.Interval` (the default) sends changes paced to `sendInterval`; `TransmissionMode.Divine` (Pro) projects motion instead, for values that tend to move predictably. |
| `isExtrapolationEnabled` | No, see `SetExtrapolationEnabled` | Whether receivers keep the value moving through the sender's silence, under either mode. `true` (the default) favors staying live when an update is lost; `false` holds still until told and favors staying accurate. Under `TransmissionMode.Interval`, `true` costs a tiny overhead on each update plus one extra update each time the value stops; `false` costs nothing extra. See [How Often a Member Is Sent](./send-pacing.md). |
| `correctionSmoothingTicks` | Yes | How many ticks `InterpolatedValue` takes to glide from the value shown before a reconcile to the corrected one, on a client that predicts the member, while `Value` is already correct. `0` (the default) shows the correction at once. |
| `isCarriedForward` | Yes | For a `MemberRole.Predict` member only: `false` keeps it at its default when `NetworkComponent.TryGetLastState(false)` carries the previous tick's client state across a tick whose client state did not arrive, for a value that must not repeat, such as a jump press. Ignored for every other role. |
| `resultTolerance` | Yes | For a predicted member only: how far its predicted value may sit from the server's before it counts as a misprediction, for a value a replay cannot reproduce exactly, such as one physics moves. `0` (the default) compares at `accuracy`. The server applies it only while the controller sends its result values (`SystemManager.IsResultValueSendEnabled`, on by default); a result checked by its hash alone is compared exactly. |

## Interpolation

`InterpolatedValue` animates across a window sized to the member's own send interval: a member sent every tick sweeps across that single tick, and a member paced at N ticks sweeps each arrival across N. Both peers construct the member with the same interval as part of the shared component declaration, so the receiver already knows the window.

`interpolationSnapThreshold`, fixed at construction, is what cuts a teleport instead of sweeping it: when `PreviousValue` and `Value` are found apart by more than the threshold, `InterpolatedValue` returns `Value` directly rather than animating across the discontinuity.

## Runtime overrides

The three construction-time doors above with a runtime override can be re-authored after construction, typically from a platform integration pushing a serialized value on bind:

```csharp
public void SetSendInterval(SendInterval sendInterval);
public void SetTransmissionMode(TransmissionMode transmissionMode);
public void SetExtrapolationEnabled(bool isExtrapolationEnabled);
```

`SetReplicates(bool isReplicated)`, on `NetworkMemberBase`, sets whether the member is sent to other peers at all. Do not call it yourself: Nucleus calls it for a member declared with `ReplicationIgnoreAttribute`, and calling it by hand desynchronizes what this peer sends from what its peers expect to read.

## Attributing a write

```csharp
public bool TryGetWritingClient(out Connections.Connection connection);
```

Resolves the client that wrote this member on the current tick, defined on `NetworkMemberBase`. It is narrow by design: it is meaningful only from inside a read raise, called from `NetworkComponent.OnMembersChanged` under `MemberChangeDirection.Read`, while the tick that applied the write is still current. Called under `MemberChangeDirection.Write` it reports nothing, because that raise describes what this peer is about to send, never a client's inbound write. Asked on a later tick, or after the writing client has disconnected, it also returns false.

## See also

For how `accuracy` trades precision against bandwidth, how `sendInterval` and `TransmissionMode` interact with pacing more generally, and the write-access rules `TryGetWritingClient` sits inside of, see the accuracy, pacing, and write-access reference pages.
