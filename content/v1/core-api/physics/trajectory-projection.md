---
title: "Trajectory projection"
---

## Project a body forward with TrajectoryProjector

`TrajectoryProjector` is a static, engine-independent class that projects a body's position, velocity and rotation forward by any number of ticks in one call. The result equals stepping the body that many ticks with Euler integration, gravity and linear drag.

`TrajectoryProjector` does not cap `ticksAhead`. `PhysicsConvergence.Step` clamps its own `ticksToProject` to `Settings.MaximumProjectionSeconds`, or `PredictionMaximumProjectionSeconds` for a locally predicted body, before projecting. Call `TrajectoryProjector` directly with any `ticksAhead` you need, for example to lead a freshly spawned body or to show where a body will be.

```csharp
public static Vector3 ProjectPosition(float tickDelta, float ticksAhead, Vector3 position, Vector3 velocity, Vector3 gravity, float drag)
```

Projects a position. `ticksAhead` can be fractional. A `drag` of zero or below projects without drag. Throws `ArgumentOutOfRangeException` if `ticksAhead` is negative.

```csharp
public static Vector3 ProjectVelocity(float tickDelta, float ticksAhead, Vector3 velocity, Vector3 gravity, float drag)
```

Projects a linear velocity under the same gravity and drag, with the same negative-`ticksAhead` check.

```csharp
public static Quaternion ProjectRotation(float tickDelta, float ticksAhead, Quaternion rotation, Vector3 angularVelocity)
```

Projects a rotation along a constant angular velocity, given as an axis scaled by radians per second. A zero angular velocity returns the input unchanged.

```csharp
public static PhysicsSnapshot ProjectSnapshot(in PhysicsSnapshot physicsSnapshot, float tickDelta, float ticksAhead, Vector3 gravity, float drag, GravityProjection gravityProjection)
```

Projects a whole `PhysicsSnapshot`, the same as the three methods above with gravity resolved through `gravityProjection`. A sleeping snapshot is returned untouched.

```csharp
public static Vector3 ExtractRotationVector(Quaternion fromRotation, Quaternion toRotation)
```

The inverse of `ProjectRotation`: the shortest-arc rotation between two orientations, as a world-space axis-angle vector in radians. Divide it by the seconds it spans to get an angular velocity for `ProjectRotation`, or multiply it by a per-second gain to get a correcting angular velocity. A near-identity arc returns `Vector3.Zero`.

## Choose a GravityProjection

```csharp
public enum GravityProjection : byte
{
    Apply = 0,
    None = 1,
    Auto = 2,
}
```

- **Apply**: gravity is always applied.
- **None**: gravity is never applied.
- **Auto**: gravity is applied only when the snapshot is already descending fast enough to be a real fall. A slow or rising snapshot projects without gravity, so a resting body is not projected into the ground. It looks only at the snapshot's descent speed, not at any grounded flag or collision state.

On Unity's `NetworkRigidbody`, **Gravity Enabled** maps to `Auto` when checked and `None` when unchecked, and **Maximum Projection Time** sets `Settings.MaximumProjectionSeconds`.
