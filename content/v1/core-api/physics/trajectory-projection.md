---
title: "Trajectory projection"
---

## TrajectoryProjector

`TrajectoryProjector` is a static, engine-independent class that projects a physics body's position, velocity, and rotation forward by an arbitrary number of ticks. It is closed-form: the result equals what a stepped simulation would reach after that many ticks of Euler integration with gravity and linear drag, computed in one call rather than by looping a tick at a time. It has no upper bound on how far ahead it will project; nothing in the class itself caps `ticksAhead`.

### ProjectPosition

```csharp
public static Vector3 ProjectPosition(float tickDelta, float ticksAhead, Vector3 position, Vector3 velocity, Vector3 gravity, float drag)
```

Projects a position forward by `ticksAhead` ticks. `ticksAhead` can be fractional; a fractional value projects partially into the tick it lands in. `drag` at zero or below projects without drag. Throws `ArgumentOutOfRangeException` if `ticksAhead` is negative.

### ProjectVelocity

```csharp
public static Vector3 ProjectVelocity(float tickDelta, float ticksAhead, Vector3 velocity, Vector3 gravity, float drag)
```

Projects a linear velocity forward the same number of ticks, under the same gravity and drag. Same negative-`ticksAhead` guard as `ProjectPosition`.

### ProjectRotation

```csharp
public static Quaternion ProjectRotation(float tickDelta, float ticksAhead, Quaternion rotation, Vector3 angularVelocity)
```

Projects a rotation forward along a constant angular velocity, given as an axis scaled by radians per second. A zero angular velocity returns the input rotation unchanged.

### ProjectSnapshot

```csharp
public static PhysicsSnapshot ProjectSnapshot(in PhysicsSnapshot physicsSnapshot, float tickDelta, float ticksAhead, Vector3 gravity, float drag, GravityProjection gravityProjection)
```

The one-call form: projects a full `PhysicsSnapshot` (position, rotation, linear velocity, angular velocity) forward by `ticksAhead` ticks, resolving gravity participation through `gravityProjection` before calling `ProjectPosition`, `ProjectVelocity`, and `ProjectRotation` internally. This is what the convergence follower calls each tick.

A sleeping snapshot (`physicsSnapshot.IsSleeping`) is returned untouched — no projection math runs on it.

### ExtractRotationVector

```csharp
public static Vector3 ExtractRotationVector(Quaternion fromRotation, Quaternion toRotation)
```

The inverse of `ProjectRotation`: given two orientations, returns the shortest-arc rotation between them as a world-space axis-angle vector in radians. Dividing the result by the seconds it spans gives an angular velocity that `ProjectRotation` consumes directly; multiplying it by a per-second gain gives the angular velocity that closes the gap as a correction. A degenerate (near-identity) arc returns `Vector3.Zero`.

## GravityProjection

```csharp
public enum GravityProjection : byte
{
    Apply = 0,
    None = 1,
    Auto = 2,
}
```

Controls whether `TrajectoryProjector` folds gravity into a projection.

- **Apply** — gravity is always applied.
- **None** — gravity is never applied.
- **Auto** — gravity is applied only when the snapshot is already descending fast enough to be a real fall, not solver jitter or quantization noise on a resting or supported body. A slow or upward-moving snapshot projects without gravity even under `Auto`, so a resting body is not projected into the ground.

`Auto` is a black-box test against the snapshot's own descent speed; it does not read a "grounded" flag or any collision state.

## Who calls this, and who clamps it

`TrajectoryProjector` takes `ticksAhead` as given and projects that far, unbounded. The cap comes from the caller: `PhysicsConvergence.Step` computes a maximum projection time — `Settings.MaximumProjectionSeconds` normally, or `PredictionMaximumProjectionSeconds` for a locally predicted body — divides it by `tickDelta` to get a tick count, and clamps the requested `ticksToProject` into `[0, maximumTicks]` before ever calling `ProjectSnapshot`. The projector itself never sees or enforces that limit.

This split is what lets the projector serve other callers directly, without inheriting convergence's clamp: a spawn-time lead (projecting a freshly received snapshot forward by the ticks already elapsed since it was sent), a diagnostic that reports where a body will be N ticks from now, or a visual predictor that projects further ahead than convergence would ever allow for smoothing purposes. Any of these call `ProjectSnapshot` (or the individual `ProjectPosition`/`ProjectVelocity`/`ProjectRotation` methods) with whatever `ticksAhead` and `GravityProjection` fit the use, independent of `PhysicsConvergence`.

## Unity: Gravity Enabled and Maximum Projection Time

On `ProjectedRigidbody`, the **Gravity Enabled** inspector checkbox and **Maximum Projection Time** field are the two knobs over this math. Gravity Enabled maps to `GravityProjection.Auto` when checked and `GravityProjection.None` when unchecked. Maximum Projection Time is the seconds value passed as `Settings.MaximumProjectionSeconds`, which `PhysicsConvergence.Step` uses to clamp `ticksToProject` for a proxy body — a predicted body ignores it and uses its own round-trip-spanning maximum instead. Neither field exposes anything beyond what `TrajectoryProjector` and `GravityProjection` do here; the inspector is a thin front end over this same projection.
