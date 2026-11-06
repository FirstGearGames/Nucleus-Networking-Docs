---
title: "Compression, Accuracy and Per-Type Registrations"
---

## Choose a compression level

`CompressionLevel` has four values:

- **Aggressive**: the most compact for small changes. Less efficient on mid-range values. Use it for a quantity that mostly sits still and moves in small steps.
- **Tight**: balanced across the common range of change sizes.
- **Loose**: suited to values that can be large or jump around.
- **Uncompressed**: no compression.

`CompressionLevelExtensions.IsLooseOrUncompressed(this CompressionLevel)` returns true for `Loose` or `Uncompressed`.

The defaults differ by place:

| Where | Default |
|---|---|
| `NetworkMember<T0>` constructor, `deltaCompressionLevel` | `CompressionLevel.Tight` |
| Every `Writer.Write*` method, `compressionLevel` | `CompressionLevel.Loose`, so `writer.WriteInt32(value)` is Loose unless you pass a level |
| `Writer.DeltaCompressionLevel`, the writer's fallback | `CompressionLevel.Tight` |

## Set accuracy per member

`NetworkMember<T0>`'s constructor also takes `accuracy`, `float.NaN` by default, which uses the type's default:

- `Writer.DefaultFloatingAccuracyAsSingle`: `1/1000`, the default for `float`, `double` and `decimal`.
- `Writer.MinimumFloatingAccuracyAsSingle`: `1/100000`, the finest accuracy allowed.
- `Writer.DefaultQuaternionAccuracyAsSingle`: `1/1000`, the default for `Quaternion` members.

Give a coarser accuracy, such as `0.01f`, to a value that tolerates more error, like a velocity. An accuracy passed to `Initialize` overrides the one given at construction.

Accuracy is also the change threshold: a change smaller than `accuracy` is not sent. A velocity with `0.01f` stops reporting movement smaller than that.

## Choose a DeltaCheckMode

Every delta write method (`TryWriteDeltaInt32`, `TryWriteDeltaSingle`, `TryWriteDeltaBoolean` and so on) takes a `DeltaCheckMode`:

- **Checked**: writes only if the value changed.
- **Unchecked**: always writes, skipping the comparison. Use it when you already know the write is needed.
