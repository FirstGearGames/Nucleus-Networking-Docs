---
title: "TransformComponent"
---

> **Using Unity?** See [NetworkTransform](../../unity/state/network-transform.md).

`TransformComponent` replicates an object's position, rotation and scale. It has no space of its own: the engine adapter that binds it decides whether the values are world or parent-local, through which subclass the system carries rather than a flag.

## It replicates three members

| Member | Type | Compression | Transmission mode |
|---|---|---|---|
| `Position` | `NetworkMember<Vector3>` | `CompressionLevel.Aggressive` | `TransmissionModeDefaults.Motion` |
| `Rotation` | `NetworkMember<Quaternion>` | default | `TransmissionModeDefaults.Motion` |
| `Scale` | `NetworkMember<Vector3>` | default | `TransmissionModeDefaults.Motion` |

```csharp
public readonly NetworkMember<Vector3> Position = new(CompressionLevel.Aggressive, transmissionMode: TransmissionModeDefaults.Motion);
public readonly NetworkMember<Quaternion> Rotation = new(transmissionMode: TransmissionModeDefaults.Motion);
public readonly NetworkMember<Vector3> Scale = new(transmissionMode: TransmissionModeDefaults.Motion);
```

`Vector3` and `Quaternion` are `System.Numerics` types. An adapter converts to and from the engine's own types.

`TransmissionModeDefaults.Motion` is divine projection in Pro and `TransmissionMode.Interval` in Free, so framework components read correctly in both editions. Your own code can name a `TransmissionMode` directly in either edition: `TransmissionMode.Divine` compiles in Free and replicates as `Interval`.

## Set all three members at once

These apply one choice to `Position`, `Rotation` and `Scale` together:

- `SetSendInterval(SendInterval sendInterval)`
- `SetTransmissionMode(TransmissionMode transmissionMode)`
- `SetExtrapolationEnabled(bool isExtrapolationEnabled)`

A receiver adopts the sender's transmission mode and extrapolation setting, so only the send interval must be the same on every peer.

## Subclass it to bind a real transform

`TransformComponent` is a `partial class` for an engine adapter to subclass, binding the three members to a real transform and choosing their space. Both peers must carry the same subclass, and therefore the same space.
