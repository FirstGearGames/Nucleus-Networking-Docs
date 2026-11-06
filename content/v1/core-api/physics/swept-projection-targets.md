---
title: "Swept projection targets"
---

## Replace the projected target with IProjectionTargetProvider

By default `PhysicsConvergence.Step` projects the latest server snapshot forward with `TrajectoryProjector`, which ignores any geometry in the way. Set `PhysicsConvergence.TargetProvider` to an `IProjectionTargetProvider` and the follower steers onto whatever target it returns instead:

```csharp
public interface IProjectionTargetProvider
{
    void ComputeTarget(IPhysicsBody physicsBody, in PhysicsSnapshot remotePhysicsSnapshot, float tickDelta,
        float ticksToProject, GravityProjection gravityProjection, out PhysicsSnapshot targetPhysicsSnapshot);
}
```

`TargetProvider` is `null` by default in the core API. In Unity, `NetworkRigidbody` always installs `SweptTargetProvider(UnitySweepProvider.Shared)` on every body it binds.

## Stop a projected body at geometry with SweptTargetProvider

`SweptTargetProvider` projects the snapshot the ordinary way, then sweeps the body's shape from the old position to the projected one using an `ISweepProvider`. On a blocking hit, the target stops at the hit position, so it never lands past geometry in the way.

```csharp
public sealed class SweptTargetProvider : IProjectionTargetProvider
{
    public float MinimumSweepDistance = 0.05f;
    public bool ReflectEnabled;
    public float Restitution = 0.6f;

    public SweptTargetProvider(ISweepProvider sweepProvider) { ... }
}
```

- **MinimumSweepDistance** (`0.05f`): projections shorter than this skip the sweep.
- **ReflectEnabled** (off): reflects the velocity at a stopped target about the contact normal, scaled by `Restitution`. Accurate only for simple bouncy shapes.
- **Restitution** (`0.6f`): the bounciness used when `ReflectEnabled` is on.

Install it on the follower:

```csharp
convergence.TargetProvider = new SweptTargetProvider(mySweepProvider);
```

The sweep provider comes from your engine integration (see [Adapting your engine](./adapting-your-engine.md)). In Unity it is `UnitySweepProvider`, built on `Rigidbody.SweepTest`.

Each sweep is an extra collision query per physics step. Turn it on when a projected proxy can be carried through something it should hit: fast bodies, thin walls or floors, or any proxy that visibly tunnels through a surface. A slow body in open space gains nothing.

## Write your own provider

Implement `IProjectionTargetProvider` directly when stop-at-first-contact is not what you want, for example to ignore certain layers. The provider must return a valid position and rotation, and the linear and angular velocity that `PhysicsConvergence.Step` assigns straight onto the body.
