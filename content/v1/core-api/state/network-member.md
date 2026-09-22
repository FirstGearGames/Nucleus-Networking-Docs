---
title: "NetworkMember"
---

## What it is

`NetworkMember<T0>` is the scalar building block a generated `NetworkComponent` declares its replicated fields with. It stores a sparse ring of past values for `T0`, exposes the current, previous, and interpolated views of that value, and owns the construction-time knobs that decide how it is compressed, paced, and projected on the wire. The non-generic behaviour (write access, `IsReplicated`) lives on its base type, `NetworkMemberBase`.

## Reading the value

| Member | Description |
| --- | --- |
| `Value` | Gets or sets the current value. A set mutates the live ring head and notifies the framework. Equality against the prior committed value is checked at serialize time inside the change examination, not on every set, so a noop assignment costs nothing beyond the write itself. |
| `PreviousValue` | The value held in the ring slot immediately before the live one. Returns `default(T0)` if no prior value has been committed. |
| `InterpolatedValue` | A smoothed value that animates from `PreviousValue` to `Value` across the member's own send interval, then holds at `Value`. See Interpolation below. |

## Reading the ring directly

`Value` and `PreviousValue` cover the common case. For a caller that needs a specific tick, or needs to derive a rate of change, the ring is also queryable directly:

```csharp
public bool TryGetValueByTick(uint tick, out T0 value);
```

Returns true and outputs the value when a ring slot tagged with the supplied tick still holds it. The ring is sparse and only a few slots deep, so an old enough tick simply is not there anymore.

```csharp
public bool TryGetPreviousValueAndTickGap(out T0 previousValue, out uint tickGap);
```

Returns the value committed to the slot before the live one, together with the tick span between the two slots. Intended for an owner that derives a rate of change (a velocity from position deltas, for example) instead of replicating it directly. Returns false, with `tickGap` set to `0`, unless both slots hold a written value and the live slot is strictly newer.

## Construction

```csharp
public NetworkMember(
    CompressionLevel deltaCompressionLevel = CompressionLevel.Tight,
    bool isAutomaticPoolingEnabled = false,
    bool isPredicted = false,
    float accuracy = float.NaN,
    float interpolationSnapThreshold = float.NaN,
    SendInterval sendInterval = SendInterval.Normal,
    TransmissionMode transmissionMode = TransmissionMode.Interval,
    PathContinuation pathContinuation = PathContinuation.Implied);
```

All eight arguments are supplied by name at the field declaration, e.g. `NetworkMember<T> _x = new(isPredicted: true);`.

| Argument | Construction-time only? | Meaning |
| --- | --- | --- |
| `deltaCompressionLevel` | Yes | The compression level used when delta-encoding this member's value. Defaults to `CompressionLevel.Tight`. |
| `isAutomaticPoolingEnabled` | Yes | Returns dropped `IPoolResettable` ring occupants to their pool through `NetworkTypePoolReturner<T0>`. When true, the member owns instances assigned to `Value`: rent them from `ResettableObjectPool<T0>` and never retain or mutate an instance after assigning it. |
| `isPredicted` | Yes | Includes this member in client-side prediction: excluded from the controller's upstream state, compare-gated against the controller's own ring history on inbound server outcomes, rewound and replayed on divergence. |
| `accuracy` | Construction default only | The wire accuracy for delta encoding, loss recovery, and lossy serialization. `float.NaN` (the default) defers to the per-type default accuracy. A per-call accuracy passed to `Initialize` still overrides it, and coarser values trade precision for bandwidth on quantities that tolerate more error than position. |
| `interpolationSnapThreshold` | Yes | The distance beyond which `InterpolatedValue` snaps to `Value` instead of animating from `PreviousValue`. `float.NaN` (the default) disables snapping. Usable only on numeric types with a registered tolerance comparer. |
| `sendInterval` | No — see `SetSendInterval` | The span between deltas while `TransmissionMode.Interval` is in force. `SendInterval.Normal` sends every tick. |
| `transmissionMode` | No — see `SetTransmissionMode` | The transmission strategy: `TransmissionMode.Interval` (the default) encodes ordinary deltas paced to `sendInterval`; `TransmissionMode.Divine` (Pro) projects motion instead, for values that tend to move predictably. |
| `pathContinuation` | No — see `SetPathContinuation` | Tunes how a `Divine` member behaves when a packet is lost: `PathContinuation.Implied` (the default) favors staying live, `PathContinuation.Announced` favors staying accurate. Ignored under `TransmissionMode.Interval`. |

## Interpolation

`InterpolatedValue` animates across a window sized to the member's own send interval: a member sent every tick sweeps across that single tick, and a member paced at N ticks sweeps each arrival across N. Both peers construct the member with the same interval as part of the shared component declaration, so the receiver knows the window without the sender naming it on the wire.

`interpolationSnapThreshold`, fixed at construction, is what cuts a teleport instead of sweeping it: when `PreviousValue` and `Value` are found apart by more than the threshold, `InterpolatedValue` returns `Value` directly rather than animating across the discontinuity.

## Runtime overrides

The three construction-time doors above with a runtime override can be re-authored after construction, typically from a platform integration pushing a serialized value on bind:

```csharp
public void SetSendInterval(SendInterval sendInterval);
public void SetTransmissionMode(TransmissionMode transmissionMode);
public void SetPathContinuation(PathContinuation pathContinuation);
```

`SetReplicates(bool isReplicated)`, on `NetworkMemberBase`, sets whether the member is sent to other peers at all. It is called only by generated code, emitted beside a member's `Initialize` call and only for a member declared with `ReplicationIgnoreAttribute`; calling it by hand desynchronizes what this peer sends from what its peers expect to read.

## Attributing a write

```csharp
public bool TryGetWritingClient(out Connections.Connection connection);
```

Resolves the client that wrote this member on the current tick, defined on `NetworkMemberBase`. It is narrow by design: it is meaningful only from inside a read raise, called from `NetworkComponent.OnMembersChanged` under `MemberChangeDirection.Read`, while the tick that applied the write is still current. Called under `MemberChangeDirection.Write` it reports nothing, because that raise describes what this peer is about to send, never a client's inbound write. Asked on a later tick, or after the writing client has disconnected, it also returns false.

## See also

For how `accuracy` trades precision against bandwidth, how `sendInterval` and `TransmissionMode` interact with pacing more generally, and the write-access rules `TryGetWritingClient` sits inside of, see the accuracy, pacing, and write-access reference pages.
