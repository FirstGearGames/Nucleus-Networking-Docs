---
title: "Compression, Accuracy and Per-Type Registrations"
---

## Compression levels

`CompressionLevel` controls how compactly a value is sent. Four values:

- **Aggressive**: the most compact for small, well-predicted changes. Costs efficiency on mid-range values.
- **Tight**: balanced, performing well across the common range of change sizes. This is the default a network member uses.
- **Loose**: suited to values that can be large.
- **Uncompressed**: no compression at all.

`CompressionLevelExtensions.IsLooseOrUncompressed(this CompressionLevel)` returns true for `Loose` or `Uncompressed`.

### Where it's set

Three places, and they don't share a default:

- `NetworkMember<T0>`'s constructor takes `deltaCompressionLevel`, defaulting to `CompressionLevel.Tight`. This is the level the member uses for its own delta writes.
- Every `Writer.Write*` method takes a `compressionLevel` parameter that defaults to `CompressionLevel.Loose`, not `Tight`. A direct call — `writer.WriteInt32(value)` — is Loose unless you pass a level explicitly.
- `Writer.DeltaCompressionLevel` is the stream-wide default the writer falls back to; it also defaults to `Tight`.

Pick the level per member based on what the value looks like: `Aggressive` for a quantity that mostly sits still and moves in small steps, `Loose` or `Uncompressed` for something that jumps around or must not be compressed.

## Wire accuracy

`NetworkMember<T0>`'s constructor also takes `accuracy` (`float.NaN` by default). NaN defers to the per-type default:

- `Writer.DefaultFloatingAccuracyAsSingle` — `1/1000`, the default for `float`/`double`/`decimal`.
- `Writer.MinimumFloatingAccuracyAsSingle` — `1/100000`, the floor any accuracy must respect.
- `Writer.DefaultQuaternionAccuracyAsSingle` — `1/1000`, the default for `Quaternion` members.

Set a coarser accuracy (e.g. `0.01f`) at the field declaration for quantities that tolerate more error than position — a velocity is the usual example. A per-call accuracy passed to `Initialize` still overrides the construction-time value.

### Accuracy is also the change threshold

Accuracy doesn't only control how precisely a value arrives: it also decides whether a change is sent at all. `Writer.TryWriteDeltaSingle` (and the double and decimal equivalents) only write when the difference between the previous and next value exceeds `accuracy`. A coarser accuracy means the member goes quiet more often: a velocity given `0.01f` stops reporting movement smaller than that.

## DeltaCheckMode

Every delta write method (`TryWriteDeltaInt32`, `TryWriteDeltaSingle`, `TryWriteDeltaBoolean`, and so on) takes a `DeltaCheckMode`:

- **Checked** — data is only written if the value changed.
- **Unchecked** — data is always written, regardless of whether it changed.

`Checked` is what lets a delta write emit nothing on an unchanged tick. `Unchecked` forces the write every time, skipping the change comparison entirely — useful where the caller already knows a write belongs on the wire and the comparison would be wasted work.
