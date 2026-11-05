---
title: "Registering hitboxes"
---

> **Using Unity?** See [Making an object hittable](../../unity/lag-compensation/making-an-object-hittable.md), where `NetworkHitboxRoot` does all of this for you.

## Register one hitbox root per object

Call `LagCompensationManager.TryRegisterHitboxRoot` with:

- the `NetworkSystem` the hitboxes belong to, one root per system;
- an `IHitboxPoseSource` that writes the hitboxes' world poses each recorded tick;
- a `HitboxDefinition` for each hitbox, its fixed shape in its own unscaled frame, in the order the pose source writes them.

```csharp
HitboxDefinition[] hitboxDefinitions =
[
    new(HitboxShape.Capsule, radius: 0.3f, size: Vector3.Zero, height: 1.8f, layer: 8),
    new(HitboxShape.Sphere, radius: 0.15f, size: Vector3.Zero, height: 0f, layer: 9),
];

bool isRegistered = coreManager.LagCompensationManager.TryRegisterHitboxRoot(networkSystem, soldierHitboxes, hitboxDefinitions);
```

The definitions are copied, so you may reuse the array. A root holds 1 to `LagCompensationManager.MaximumHitboxesPerRoot` (64) hitboxes.

`TryRegisterHitboxRoot` returns `false`:

- with a logged error, when the system or pose source is `null`, the hitbox count is out of range, or the system already has a root;
- without an error, when this peer is not running a server. Register once the server is running, for example when the system starts on the server;
- in a free build, logging once that lag compensation is not available.

The root's history length comes from `MaximumRewindMilliseconds` at registration; see [The rewind window and the view clamp](./the-rewind-window.md).

## Describe each hitbox

| Shape | Described by |
| --- | --- |
| `Sphere` | `Radius` |
| `Box` | `Size`, the full size on each axis |
| `Capsule` | `Radius` and `Height`, the full height including both rounded ends, along the hitbox's own up axis |
| `Circle` | `Radius`, in the XY plane |
| `Box2D` | `Size`, reading X and Y only, in the XY plane |
| `Capsule2D` | `Radius` and `Height`, along the hitbox's own up axis, in the XY plane |

The constructor is `HitboxDefinition(HitboxShape shape, float radius, Vector3 size, float height, byte layer = 0)`; fields a shape does not use are ignored. `Layer` runs from 0 to 31, and a larger value wraps into that range. A query's layer mask, one bit per layer, chooses which layers it can hit, so you can keep heads, bodies and shields on separate layers.

Scale is not part of the definition. It is recorded with every pose, so a hitbox that grows or shrinks is judged at its size on the tick asked about.

## Write every hitbox's pose every tick

`IHitboxPoseSource` has one method:

```csharp
public ulong WriteHitboxPoses(Span<HitboxPose> hitboxPoses);
```

It is called on the network loop thread, once per recorded tick, with one `HitboxPose` slot per hitbox in registration order. It must not allocate. For each hitbox, write:

- `Position`: the world position of the hitbox's center, including any offset from what it follows.
- `Rotation`: the world rotation. A capsule's length runs along its own up axis, so turn the rotation onto a capsule lying along another axis.
- `Scale`: the absolute world scale in the hitbox's own frame. For a capsule, Y is the scale along its length and X and Z the two across it.

Return a mask with bit `i` set when hitbox `i` is active this tick. An inactive hitbox is recorded but never hit on that tick. Still write every hitbox's pose every tick, active or not, because a shot judged between two ticks uses both ticks' poses.

```csharp
using System;
using System.Numerics;
using Nucleus.Managers.LagCompensation;

public sealed class SoldierHitboxes : IHitboxPoseSource
{
    public Vector3 Position;
    public Quaternion Rotation = Quaternion.Identity;
    public bool IsDowned;

    public ulong WriteHitboxPoses(Span<HitboxPose> hitboxPoses)
    {
        // The body capsule, centered 0.9 m above the soldier's feet.
        hitboxPoses[0].Position = Position + Vector3.Transform(new Vector3(0f, 0.9f, 0f), Rotation);
        hitboxPoses[0].Rotation = Rotation;
        hitboxPoses[0].Scale = Vector3.One;

        // The head sphere, 1.65 m up.
        hitboxPoses[1].Position = Position + Vector3.Transform(new Vector3(0f, 1.65f, 0f), Rotation);
        hitboxPoses[1].Rotation = Rotation;
        hitboxPoses[1].Scale = Vector3.One;

        // A downed soldier is recorded but cannot be hit.
        return IsDowned ? 0UL : 0b11UL;
    }
}
```

A source that throws is logged and loses only its own slot for that tick; every other root is still recorded.

## 2D hitboxes lie in the XY plane

A 2D game registers `Circle`, `Box2D` and `Capsule2D` hitboxes and judges them with the 2D queries. Write a 2D pose in the plane: a `Position` with a Z of zero and a `Rotation` about the Z axis only. Only the X and Y of `Scale` are read; for a 2D capsule, X is the scale across it. See [2D queries](./rewound-queries.md#2d-queries) for how 2D and 3D hitboxes mix.

## End a recording

The engine unregisters a system that stops or returns to its pool. Call `TryUnregisterHitboxRoot(networkSystem)` only to stop recording a system that keeps running; it returns `true` when the system had a root. Either way, what was recorded stays readable until it leaves the rewind window.

## A grouped object registers once

Register one root for a grouped object, under one member, not one per member, or a single shot reports each hitbox once for every root that recorded it. When there is a choice, use the member carrying the object's `TransformComponent`, so a target sent on an interval is judged where it was drawn.
