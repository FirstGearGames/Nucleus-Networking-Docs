---
title: "Registering hitboxes"
---

> **Using Unity?** See [Making an object hittable](../../unity/lag-compensation/making-an-object-hittable.md), where `NetworkHitboxRoot` does all of this for you.

## A root is one object's set of hitboxes

The engine knows nothing about transforms, meshes or colliders. A networked object that can be hit registers one **hitbox root** with `LagCompensationManager.TryRegisterHitboxRoot`, giving it three things:

- the `NetworkSystem` the hitboxes belong to, one root per system;
- an `IHitboxPoseSource` that writes the hitboxes' world poses whenever the server records a tick;
- a `HitboxDefinition` for each hitbox, the fixed shape in its own unscaled frame, in the order the pose source writes them.

```csharp
HitboxDefinition[] hitboxDefinitions =
[
    new(HitboxShape.Capsule, radius: 0.3f, size: Vector3.Zero, height: 1.8f, layer: 8),
    new(HitboxShape.Sphere, radius: 0.15f, size: Vector3.Zero, height: 0f, layer: 9),
];

bool isRegistered = coreManager.LagCompensationManager.TryRegisterHitboxRoot(networkSystem, soldierHitboxes, hitboxDefinitions);
```

The definitions are copied, so the caller may reuse the array. A root holds between 1 and `LagCompensationManager.MaximumHitboxesPerRoot` (64) hitboxes, which is the width of the per-tick active mask.

`TryRegisterHitboxRoot` returns `false`, with a logged error, when the system or pose source is `null`, when the hitbox count is out of range, or when the system already has a root. It returns `false` without an error when this peer is not running a server, because only a server records; register once the server is running, for example when the system starts on the server. In a free build it returns `false` and logs once that lag compensation is not available.

How far back a root's history reaches is sized from `MaximumRewindMilliseconds` when the root registers; see [The rewind window and the view clamp](./the-rewind-window.md).

## Describing a hitbox

`HitboxShape` has three 3D shapes and three 2D shapes, each of which a query can test exactly:

| Shape | Described by |
| --- | --- |
| `Sphere` | `Radius` |
| `Box` | `Size`, the full size on each axis |
| `Capsule` | `Radius` and `Height`, the full height including both rounded ends, along the hitbox's own up axis |
| `Circle` | `Radius`, in the XY plane |
| `Box2D` | `Size`, reading X and Y only, in the XY plane |
| `Capsule2D` | `Radius` and `Height`, along the hitbox's own up axis, in the XY plane |

`HitboxDefinition`'s constructor is `HitboxDefinition(HitboxShape shape, float radius, Vector3 size, float height, byte layer = 0)`; a field a shape does not use is ignored. `Layer` runs from 0 to 31, and a larger value wraps into that range. A query's layer mask, one bit per layer, chooses which layers it can hit, so a game can keep heads, bodies and shields on separate layers.

Scale is not part of the definition. It is recorded with every pose, so a hitbox whose object grows or shrinks is judged at the size it had on the tick being asked about.

## Writing poses

`IHitboxPoseSource` has one method:

```csharp
public ulong WriteHitboxPoses(Span<HitboxPose> hitboxPoses);
```

It is called on the network loop thread, once per recorded tick, with one `HitboxPose` slot per registered hitbox in registration order. It must not allocate. For each hitbox, write:

- `Position`, the world position of the hitbox's center, including any offset from whatever it follows;
- `Rotation`, the world rotation; a capsule's length runs along its own up axis, so a capsule lying along another axis turns its recorded rotation onto it;
- `Scale`, the absolute world scale in the hitbox's own frame; for a capsule, Y is the scale along its length and X and Z the two across it.

Return a mask with bit `i` set when hitbox `i` is active on this tick. An inactive hitbox is recorded but never hit on that tick. Write every hitbox's pose every tick even when it is inactive: a shot judged between two ticks blends both ticks' poses, and the bounding test that culls roots covers inactive hitboxes for that reason.

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

A 2D game registers `Circle`, `Box2D` and `Capsule2D` hitboxes and judges them with the 2D queries. A 2D shape is the slice the plane Z = 0 cuts through the matching 3D shape, so it is tested with the same exact math. Write its pose in that plane: a `Position` whose Z is zero and a `Rotation` about the Z axis only. It reads the X and Y of its `Scale`, and for a 2D capsule X is the one scale across it.

2D and 3D hitboxes are kept apart the way Unity keeps its 2D and 3D physics apart: a 3D query never touches a 2D hitbox, and a 2D query touches 3D hitboxes only when the game allows it. See [2D queries](./rewound-queries.md#2d-queries).

## Ending a recording

A system that stops or returns to its pool is unregistered by the engine. Call `TryUnregisterHitboxRoot(networkSystem)` only to stop recording a system that keeps running; it returns `true` when the system had a root. Either way, what was already recorded stays readable until it leaves the rewind window, so a shot fired just before the change is still judged fairly.

## A grouped object registers once

A grouped object's members share the object's hitboxes. Register one root for the whole object, under one member, rather than one per member, or a single shot will report each hitbox once for every root that recorded it. The member carrying the object's `TransformComponent` is the right one when there is a choice, because a target whose position is sent on an interval is judged where its transform was drawn, and only that member knows the interval. See [How lag compensation works](./how-lag-compensation-works.md#grouped-objects-are-recorded-once).
