---
title: "TransformComponent"
---

> **Using Unity?** See [NetworkTransform](../../unity/state/network-transform.md).

`TransformComponent` is the engine-neutral replicated pose of an object: position, rotation, and scale. It declares no space of its own — whichever adapter binds it decides whether the values mean world or parent-local, and that choice is expressed by which subclass a system carries, not by a flag on the component.

## Members

| Member | Type | Compression | Transmission mode |
|---|---|---|---|
| `Position` | `NetworkMember<Vector3>` | `CompressionLevel.Aggressive` | `TransmissionModeDefaults.Motion` |
| `Rotation` | `NetworkMember<Quaternion>` | default | `TransmissionModeDefaults.Motion` |
| `Scale` | `NetworkMember<Vector3>` | default | `TransmissionModeDefaults.Motion` |

`Vector3` and `Quaternion` are `System.Numerics` types. `TransformComponent` never touches an engine's own vector or rotation type; an adapter converts at the boundary.

```csharp
public readonly NetworkMember<Vector3> Position = new(CompressionLevel.Aggressive, transmissionMode: TransmissionModeDefaults.Motion);
public readonly NetworkMember<Quaternion> Rotation = new(transmissionMode: TransmissionModeDefaults.Motion);
public readonly NetworkMember<Vector3> Scale = new(transmissionMode: TransmissionModeDefaults.Motion);
```

## Setting all three at once

`TransformComponent` adds three methods that push a single choice across `Position`, `Rotation`, and `Scale` together, so the whole pose replicates as one unit rather than three independently configured members:

- `SetSendInterval(SendInterval sendInterval)`
- `SetTransmissionMode(TransmissionMode transmissionMode)`
- `SetPathContinuation(PathContinuation pathContinuation)`

Apply the same value on every peer. A platform integration typically pushes a serialized interval, mode, or continuation on bind so this stays consistent without each peer configuring it by hand.

## Subclassing

`TransformComponent` is a `partial class`, meant to be subclassed by an engine adapter that binds `Position`, `Rotation`, and `Scale` to a real transform and decides what space they're measured in. A subclass's members are part of its owning system's component list, so both peers must agree on which subclass — and therefore which space — the system carries.

## `TransmissionModeDefaults.Motion`

All three members are built with `TransmissionModeDefaults.Motion` rather than a literal `TransmissionMode`. `Motion` resolves to `TransmissionMode.Interval` by default and is only raised to a projecting mode when Pro's projector registration runs at assembly load; a free build never raises it, so `Motion` resolves to `Interval` there.

Framework components use `TransmissionModeDefaults.Motion` instead of naming a mode directly because `TransmissionMode.Divine` is a Pro-only value that doesn't compile in a free build. Resolving through `Motion` keeps one source correct in both editions: divine projection where it's available, ordinary interval-paced deltas where it isn't. Game code that isn't shipping across both editions can name a `TransmissionMode` directly.
